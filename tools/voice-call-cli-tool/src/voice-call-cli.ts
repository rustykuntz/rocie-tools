#!/usr/bin/env node
import dotenv from 'dotenv';
import ngrok from '@ngrok/ngrok';
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { isPortInUse } from './utils/execution-utils.js';

// Node 25 compatibility for legacy twilio dep chain expecting buffer.SlowBuffer.
const require = createRequire(`${process.cwd()}/voice-call-cli-bootstrap.cjs`);
const bufferModule = require('buffer');
if (!bufferModule.SlowBuffer) {
    bufferModule.SlowBuffer = bufferModule.Buffer;
}

dotenv.config();

const REQUIRED_ENV_VARS = [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'OPENAI_API_KEY',
    'OPENAI_REALTIME_MODEL',
    'NGROK_AUTHTOKEN',
    'TWILIO_NUMBER'
] as const;

type CliArgs = {
    toNumber: string;
    timeoutMs: number;
    callContext: string;
    voice: string;
    voiceId: string;
};

function printUsage(): void {
    process.stderr.write(
        'Usage: voice-call --to +15551234567 --context-file /tmp/call-context.txt [--voice marin] [--voice-id voice_abc] [--timeout 300000]\n' +
        '   or: voice-call --to +15551234567 --context "Call objective text" [--voice marin] [--voice-id voice_abc] [--timeout 300000]\n' +
        '   or: cat context.txt | voice-call --to +15551234567 [--voice marin] [--voice-id voice_abc] --timeout 300000\n'
    );
}

function parseArgs(argv: string[]): CliArgs {
    let toNumber = '';
    let timeoutMs = 300000;
    let contextFromArg = '';
    let contextFile = '';
    let voice = '';
    let voiceId = '';

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--help' || arg === '-h') {
            printUsage();
            process.exit(0);
        }
        if (arg === '--to') {
            toNumber = argv[i + 1] || '';
            i += 1;
            continue;
        }
        if (arg === '--timeout') {
            const raw = argv[i + 1] || '';
            const parsed = Number(raw);
            if (!Number.isFinite(parsed) || parsed <= 0) {
                throw new Error('Invalid --timeout value');
            }
            timeoutMs = parsed;
            i += 1;
            continue;
        }
        if (arg === '--context') {
            contextFromArg = argv[i + 1] || '';
            i += 1;
            continue;
        }
        if (arg === '--context-file') {
            contextFile = argv[i + 1] || '';
            i += 1;
            continue;
        }
        if (arg === '--voice') {
            voice = (argv[i + 1] || '').trim();
            i += 1;
            continue;
        }
        if (arg === '--voice-id') {
            voiceId = (argv[i + 1] || '').trim();
            i += 1;
            continue;
        }
        throw new Error(`Unknown argument: ${arg}`);
    }

    if (!toNumber) {
        throw new Error('--to is required');
    }

    let callContext = '';
    if (contextFromArg) {
        callContext = contextFromArg;
    } else if (contextFile) {
        callContext = readFileSync(contextFile, 'utf8');
    } else if (!process.stdin.isTTY) {
        callContext = readFileSync(0, 'utf8');
    }

    if (!callContext.trim()) {
        throw new Error('Call context is required (--context, --context-file, or stdin)');
    }

    return { toNumber, timeoutMs, callContext, voice, voiceId };
}

function validateEnvironmentVariables(): void {
    for (const envVar of REQUIRED_ENV_VARS) {
        if (!process.env[envVar]) {
            throw new Error(`Missing required env var: ${envVar}`);
        }
    }
}

function setupPort(): number {
    const PORT = process.env.PORT || '3004';
    process.env.PORT = PORT;
    return parseInt(PORT, 10);
}

async function setupNgrokTunnel(portNumber: number): Promise<string> {
    const listener = await ngrok.forward({
        addr: portNumber,
        authtoken_from_env: true
    });

    const twilioCallbackUrl = listener.url();
    if (!twilioCallbackUrl) {
        throw new Error('Failed to obtain ngrok URL');
    }
    return twilioCallbackUrl;
}

async function run(): Promise<void> {
    let server: { stop: () => Promise<void> } | null = null;
    try {
        const args = parseArgs(process.argv.slice(2));
        if (args.voice) {
            process.env.OPENAI_VOICE = args.voice;
        }
        if (args.voiceId) {
            process.env.OPENAI_VOICE_ID = args.voiceId;
        }

        validateEnvironmentVariables();

        const portNumber = setupPort();
        if (await isPortInUse(portNumber)) {
            throw new Error(`Port ${portNumber} is already in use`);
        }

        const [{ default: twilio }, { TwilioCallService }, { VoiceServer }, { CallSessionManager }, { callTracker }] = await Promise.all([
            import('twilio'),
            import('./services/twilio/call.service.js'),
            import('./servers/voice.server.js'),
            import('./handlers/openai.handler.js'),
            import('./services/call-tracker.js')
        ]);

        const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        const sessionManager = new CallSessionManager(twilioClient);
        const twilioCallService = new TwilioCallService(twilioClient);

        const twilioCallbackUrl = await setupNgrokTunnel(portNumber);
        server = new VoiceServer(twilioCallbackUrl, sessionManager);
        server.start();

        const callSid = await twilioCallService.makeCall(twilioCallbackUrl, args.toNumber, args.callContext);
        const transcript = await callTracker.waitForCall(callSid, args.timeoutMs);

        process.stdout.write(JSON.stringify({ status: 'completed', callSid, transcript }) + '\n');
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stdout.write(JSON.stringify({ status: 'error', message }) + '\n');
        process.exitCode = 1;
    } finally {
        try {
            await ngrok.disconnect();
        } catch {}
        try {
            await server?.stop();
        } catch {}
    }
}

run();
