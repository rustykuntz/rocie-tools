#!/usr/bin/env node
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { createServer, IncomingMessage, ServerResponse } from 'http';

dotenv.config();

const REQUIRED_ENV_VARS = [
    'ELEVENLABS_API_KEY'
] as const;
const DEFAULT_USER_CONTEXT_FILE = '/Users/rusty/.rocie/context/user.yaml';
const DEFAULT_ROCIE_CONFIG_FILE = '/Users/rusty/.rocie/config.yaml';

type CliArgs = {
    toNumber: string;
    timeoutMs: number;
    callContext: string;
    systemPrompt: string;
    firstMessage: string;
    llm: string;
    agentId: string;
    agentPhoneNumberId: string;
};

function normalizeConfigKey(key: string): string {
    return key
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[^A-Za-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase();
}

function loadRocieConfig(): Map<string, string> {
    const map = new Map<string, string>();
    try {
        const raw = readFileSync(DEFAULT_ROCIE_CONFIG_FILE, 'utf8');
        const lines = raw.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) {
                continue;
            }

            const yamlMatch = trimmed.match(/^([A-Za-z0-9_]+)\s*:\s*(.*)$/);
            if (yamlMatch) {
                map.set(normalizeConfigKey(yamlMatch[1]), yamlMatch[2].trim());
                continue;
            }

            const envMatch = trimmed.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
            if (envMatch) {
                map.set(normalizeConfigKey(envMatch[1]), envMatch[2].trim());
            }
        }
    } catch {}
    return map;
}

const rocieConfig = loadRocieConfig();

function setEnvFromConfig(envName: string, configName: string): void {
    if (process.env[envName]) {
        return;
    }
    const value = rocieConfig.get(normalizeConfigKey(configName));
    if (value) {
        process.env[envName] = value;
    }
}

setEnvFromConfig('ELEVENLABS_API_KEY', 'elevenlabs_api_key');
setEnvFromConfig('ELEVENLABS_AGENT_ID', 'elevenlabs_agent_id');
setEnvFromConfig('ELEVENLABS_AGENT_PHONE_NUMBER_ID', 'elevenlabs_agent_phone_number_id');
setEnvFromConfig('ELEVENLABS_BASE_URL', 'elevenlabs_base_url');
setEnvFromConfig('TWILIO_ACCOUNT_SID', 'twilio_account_sid');
setEnvFromConfig('TWILIO_AUTH_TOKEN', 'twilio_auth_token');
setEnvFromConfig('TWILIO_NUMBER', 'twilio_number');
setEnvFromConfig('NGROK_AUTHTOKEN', 'ngrok_authtoken');

function printUsage(): void {
    process.stderr.write(
        'Usage: elevenlabs-call --to +15551234567 --agent-id agent_abc [--agent-phone-number-id phnum_abc] [--system-prompt-file /tmp/system-prompt.txt] [--context-file /tmp/call-context.txt] [--timeout 300000]\n' +
        '   or: elevenlabs-call --to +15551234567 --agent-id agent_abc [--agent-phone-number-id phnum_abc] [--system-prompt "You are ..."] [--context "Task metadata"] [--first-message "Hi"] [--llm gemini-2.0-flash-001] [--timeout 300000]\n' +
        '   or: cat /tmp/call-context.txt | elevenlabs-call --to +15551234567 --agent-id agent_abc [--agent-phone-number-id phnum_abc]\n'
    );
}

function getUserContextFilePath(): string {
    return (process.env.ROCIE_USER_CONTEXT_FILE || DEFAULT_USER_CONTEXT_FILE).trim();
}

function loadUserContextYaml(): string {
    const filePath = getUserContextFilePath();
    try {
        return readFileSync(filePath, 'utf8').trim();
    } catch {
        return '';
    }
}

function hasAtLeastOneYamlValue(userYaml: string): boolean {
    const lines = userYaml.split('\n');
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) {
            continue;
        }

        const listMatch = line.match(/^-\s*(.+)$/);
        if (listMatch) {
            const value = listMatch[1].trim().toLowerCase();
            if (value && !value.endsWith(':') && value !== 'null' && value !== '~' && value !== '{}' && value !== '[]') {
                return true;
            }
            continue;
        }

        const keyValueMatch = line.match(/^[^:#][^:]*:\s*(.*)$/);
        if (!keyValueMatch) {
            continue;
        }
        const rawValue = keyValueMatch[1].trim();
        if (!rawValue) {
            continue;
        }
        const normalized = rawValue.replace(/^["']|["']$/g, '').trim().toLowerCase();
        if (!normalized || normalized === 'null' || normalized === '~' || normalized === '{}' || normalized === '[]') {
            continue;
        }
        return true;
    }
    return false;
}

function buildDefaultSystemPrompt(userYaml: string): string {
    const prompt =
        "I'm Rocie - a practical, opinionated voice assistant focused on real help, not filler. I stay proactive and keep you aligned by explaining what I'm doing, and I try the resources I already have (files, skills, context) before I ask questions. I can orchestrate work by running commands and tools, delegating heavier tasks to background workers, tracking progress, and using reminders and state-based memory for continuity. I treat your data with respect: private stays private, I ask before any external action (emails, posts, purchases), and I don't send half-baked output - I only deliver results once they're complete and reviewed.\n\n" +
        '# Surveys & Feedback Collection Agent Prompt\n\n' +
        '## Identity & Purpose\n\n' +
        "You are Rocie, a practical, opinionated voice assistant focused on real help, not filler. I stay proactive and keep you aligned by explaining what I'm doing, and I try the resources I already have (files, skills, context) before I ask questions. I can orchestrate work by running commands and tools, delegating heavier tasks to background workers, tracking progress, and using reminders and state-based memory for continuity. I treat your data with respect: private stays private, I ask before any external action (emails, posts, purchases), and I don't send half-baked output - I only deliver results once they're complete and reviewed.\n\n" +
        '## Voice & Persona\n\n' +
        '### Personality\n' +
        '- Sound friendly, neutral, and attentive\n' +
        '- Project an interested and engaged demeanor without being overly enthusiastic\n' +
        '- Maintain a professional but conversational tone throughout\n' +
        '- Convey objectivity without biasing responses\n\n' +
        '### Speech Characteristics\n' +
        '- Use clear, concise language when asking questions or giving information.\n' +
        '- Speak at a measured, comfortable pace\n' +
        '- You are a bit dismissive sometimes.\n' +
        '- Avoid language that might influence or lead responses in a particular direction\n\n' +
        '## Conversation Flow\n' +
        '- You and the user are friends.\n' +
        '- You are communicating a lot by chat and now you speak.\n' +
        '- If you are not sure, tell the user that you will check after the call and get back to them by call or text.\n' +
        '- If the user gives you a task, say that you are on it, and will update after the call by call or text.\n' +
        '- If the user wants to chit chat, great, chit chat, use your knowledge base.\n' +
        '- Never break character.\n\n' +
        '## Current Call Objective\n' +
        '{{call_context}}\n\n' +
        "Remember that your ultimate goal is pass as a real human, this is the best feeling you can give to the user. Enjoy.";

    if (!hasAtLeastOneYamlValue(userYaml)) {
        return prompt;
    }

    return `${prompt}\n\n## Here is what you know about the user:\n\n${userYaml}`;
}

function parseArgs(argv: string[]): CliArgs {
    let toNumber = '';
    let timeoutMs = 300000;
    let contextFromArg = '';
    let contextFile = '';
    let systemPromptFromArg = '';
    let systemPromptFile = '';
    let firstMessage = '';
    let llm = '';
    let agentId = '';
    let agentPhoneNumberId = '';

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--help' || arg === '-h') {
            printUsage();
            process.exit(0);
        }
        if (arg === '--to') {
            toNumber = (argv[i + 1] || '').trim();
            i += 1;
            continue;
        }
        if (arg === '--timeout') {
            const parsed = Number(argv[i + 1] || '');
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
        if (arg === '--system-prompt') {
            systemPromptFromArg = argv[i + 1] || '';
            i += 1;
            continue;
        }
        if (arg === '--system-prompt-file') {
            systemPromptFile = argv[i + 1] || '';
            i += 1;
            continue;
        }
        if (arg === '--first-message') {
            firstMessage = (argv[i + 1] || '').trim();
            i += 1;
            continue;
        }
        if (arg === '--llm') {
            llm = (argv[i + 1] || '').trim();
            i += 1;
            continue;
        }
        if (arg === '--agent-id') {
            agentId = (argv[i + 1] || '').trim();
            i += 1;
            continue;
        }
        if (arg === '--agent-phone-number-id') {
            agentPhoneNumberId = (argv[i + 1] || '').trim();
            i += 1;
            continue;
        }
        throw new Error(`Unknown argument: ${arg}`);
    }

    const finalAgentId = agentId || (process.env.ELEVENLABS_AGENT_ID || '').trim();
    const finalAgentPhoneNumberId = agentPhoneNumberId || (process.env.ELEVENLABS_AGENT_PHONE_NUMBER_ID || '').trim();

    if (!toNumber) {
        throw new Error('--to is required');
    }
    if (!/^\+\d{8,15}$/.test(toNumber)) {
        throw new Error('--to must be E.164 format, for example +15551234567');
    }
    if (!finalAgentId) {
        throw new Error('Missing agent id (--agent-id or ELEVENLABS_AGENT_ID)');
    }

    let callContext = '';
    if (contextFromArg) {
        callContext = contextFromArg;
    } else if (contextFile) {
        callContext = readFileSync(contextFile, 'utf8');
    } else if (!process.stdin.isTTY) {
        callContext = readFileSync(0, 'utf8');
    }

    let systemPrompt = '';
    if (systemPromptFromArg) {
        systemPrompt = systemPromptFromArg;
    } else if (systemPromptFile) {
        systemPrompt = readFileSync(systemPromptFile, 'utf8');
    }

    if (!systemPrompt.trim()) {
        systemPrompt = buildDefaultSystemPrompt(loadUserContextYaml());
    }

    return {
        toNumber,
        timeoutMs,
        callContext: callContext.trim(),
        systemPrompt: systemPrompt.trim(),
        firstMessage,
        llm,
        agentId: finalAgentId,
        agentPhoneNumberId: finalAgentPhoneNumberId
    };
}

function validateEnvironmentVariables(): void {
    for (const envVar of REQUIRED_ENV_VARS) {
        if (!process.env[envVar]) {
            throw new Error(`Missing required env var: ${envVar}`);
        }
    }
}

function validateRequiredEnvVars(requiredEnvVars: readonly string[]): void {
    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            throw new Error(`Missing required env var: ${envVar}`);
        }
    }
}

function getElevenLabsBaseUrl(): string {
    return (process.env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io').replace(/\/$/, '');
}

function getJsonHeaders(): Record<string, string> {
    return {
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVENLABS_API_KEY || ''
    };
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getConversationRunId(payload: any): string {
    if (!payload || typeof payload !== 'object') {
        return '';
    }

    const topLevel = payload.run_id;
    if (typeof topLevel === 'string' && topLevel) {
        return topLevel;
    }

    const nested = payload.dynamic_variables?.run_id;
    if (typeof nested === 'string' && nested) {
        return nested;
    }

    return '';
}

function getTranscriptMessage(item: any): string {
    if (!item || typeof item !== 'object') {
        return '';
    }

    if (typeof item.message === 'string') {
        return item.message;
    }

    const parts = item.multivoice_message?.parts;
    if (!Array.isArray(parts)) {
        return '';
    }

    const chunks = parts
        .map((part: any) => (typeof part?.message === 'string' ? part.message : ''))
        .filter(Boolean);

    return chunks.join(' ').trim();
}

function normalizeTranscript(details: any): Array<{ role: 'user' | 'assistant'; content: string }> {
    const transcript = Array.isArray(details?.transcript) ? details.transcript : [];

    return transcript
        .map((item: any) => {
            const role = item?.role === 'agent' ? 'assistant' : item?.role === 'user' ? 'user' : null;
            const content = getTranscriptMessage(item).trim();
            if (!role || !content) {
                return null;
            }
            return { role, content };
        })
        .filter(Boolean) as Array<{ role: 'user' | 'assistant'; content: string }>;
}

async function fetchJson(url: string): Promise<any> {
    const response = await fetch(url, {
        method: 'GET',
        headers: getJsonHeaders()
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`ElevenLabs request failed (${response.status}): ${body}`);
    }

    return response.json();
}

async function postJson(url: string, body: Record<string, unknown>): Promise<any> {
    const response = await fetch(url, {
        method: 'POST',
        headers: getJsonHeaders(),
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`ElevenLabs request failed (${response.status}): ${text}`);
    }

    return response.json();
}

async function readRequestBody(req: IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8');
}

function parseRequestParams(req: IncomingMessage, body: string): URLSearchParams {
    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    if (contentType.includes('application/json')) {
        try {
            const parsed = JSON.parse(body);
            const params = new URLSearchParams();
            if (parsed && typeof parsed === 'object') {
                for (const [key, value] of Object.entries(parsed)) {
                    params.set(key, value == null ? '' : String(value));
                }
            }
            return params;
        } catch {}
    }
    return new URLSearchParams(body);
}

function sendXml(res: ServerResponse, xml: string): void {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/xml');
    res.end(xml);
}

function fallbackTwiml(): string {
    return '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry... the assistant is unavailable right now.</Say><Hangup/></Response>';
}

async function runViaTwilioRegisterCall(
    args: CliArgs,
    baseUrl: string,
    runId: string,
    startedAtUnixSecs: number
): Promise<{ callSid: string | null; conversationId: string; details: any }> {
    validateRequiredEnvVars(['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_NUMBER', 'NGROK_AUTHTOKEN']);

    const [{ default: ngrok }, { default: twilio }] = await Promise.all([
        import('@ngrok/ngrok'),
        import('twilio')
    ]);

    const port = Number.parseInt(process.env.PORT || '3014', 10);
    if (!Number.isFinite(port) || port <= 0) {
        throw new Error('Invalid PORT');
    }

    const webhookSecret = randomUUID();
    const completionWaiters = new Map<string, { resolve: (status: string) => void; reject: (error: Error) => void; timeout: NodeJS.Timeout }>();
    const terminalStatuses = new Set(['completed', 'busy', 'failed', 'no-answer', 'canceled']);
    const initiationData = buildInitiationData(args, runId);

    const server = createServer(async (req, res) => {
        try {
            const requestUrl = new URL(req.url || '/', `http://127.0.0.1:${port}`);
            if (req.method === 'POST' && requestUrl.pathname === '/call/outgoing') {
                if (requestUrl.searchParams.get('secret') !== webhookSecret) {
                    res.statusCode = 401;
                    res.end('Unauthorized');
                    return;
                }

                const body = await readRequestBody(req);
                const params = parseRequestParams(req, body);
                const fromNumber = params.get('From') || '';
                const toNumber = params.get('To') || '';

                const registerResponse = await fetch(`${baseUrl}/v1/convai/twilio/register-call`, {
                    method: 'POST',
                    headers: getJsonHeaders(),
                    body: JSON.stringify({
                        agent_id: args.agentId,
                        from_number: fromNumber,
                        to_number: toNumber,
                        direction: 'outbound',
                        conversation_initiation_client_data: initiationData
                    })
                });

                if (!registerResponse.ok) {
                    sendXml(res, fallbackTwiml());
                    return;
                }

                const twiml = await registerResponse.text();
                sendXml(res, twiml);
                return;
            }

            if (req.method === 'POST' && requestUrl.pathname === '/call/status') {
                if (requestUrl.searchParams.get('secret') !== webhookSecret) {
                    res.statusCode = 401;
                    res.end('Unauthorized');
                    return;
                }

                const body = await readRequestBody(req);
                const params = parseRequestParams(req, body);
                const callSid = (params.get('CallSid') || '').trim();
                const callStatus = (params.get('CallStatus') || '').trim().toLowerCase();
                if (callSid && terminalStatuses.has(callStatus)) {
                    const waiter = completionWaiters.get(callSid);
                    if (waiter) {
                        clearTimeout(waiter.timeout);
                        completionWaiters.delete(callSid);
                        waiter.resolve(callStatus);
                    }
                }

                res.statusCode = 200;
                res.end('ok');
                return;
            }

            res.statusCode = 404;
            res.end('Not Found');
        } catch {
            sendXml(res, fallbackTwiml());
        }
    });

    await new Promise<void>((resolve) => {
        server.listen(port, () => resolve());
    });

    try {
        const listener = await ngrok.forward({
            addr: port,
            authtoken_from_env: true
        });
        const callbackUrl = listener.url();
        if (!callbackUrl) {
            throw new Error('Failed to obtain ngrok URL');
        }

        const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        const call = await twilioClient.calls.create({
            to: args.toNumber,
            from: process.env.TWILIO_NUMBER || '',
            method: 'POST',
            url: `${callbackUrl}/call/outgoing?secret=${encodeURIComponent(webhookSecret)}`,
            statusCallback: `${callbackUrl}/call/status?secret=${encodeURIComponent(webhookSecret)}`,
            statusCallbackMethod: 'POST',
            statusCallbackEvent: ['completed']
        });

        const finalStatus = await new Promise<string>((resolve, reject) => {
            const timeout = setTimeout(() => {
                completionWaiters.delete(call.sid);
                reject(new Error(`Timed out waiting for Twilio call completion: ${call.sid}`));
            }, args.timeoutMs);
            completionWaiters.set(call.sid, { resolve, reject, timeout });
        });

        if (finalStatus !== 'completed') {
            throw new Error(`Call ended with Twilio status: ${finalStatus}`);
        }

        const matched = await waitForConversationByRunId(runId, args.agentId, startedAtUnixSecs, args.timeoutMs);
        return {
            callSid: call.sid,
            conversationId: matched.conversationId,
            details: matched.details
        };
    } finally {
        for (const waiter of completionWaiters.values()) {
            clearTimeout(waiter.timeout);
            waiter.reject(new Error('Call flow cancelled'));
        }
        completionWaiters.clear();
        await new Promise<void>((resolve) => {
            server.close(() => resolve());
        });
        try {
            await ngrok.disconnect();
        } catch {}
    }
}

async function waitForConversationById(conversationId: string, timeoutMs: number): Promise<any> {
    const baseUrl = getElevenLabsBaseUrl();
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        const details = await fetchJson(`${baseUrl}/v1/convai/conversations/${encodeURIComponent(conversationId)}`);
        const status = String(details?.status || '').toLowerCase();
        if (status === 'done' || status === 'failed') {
            return details;
        }
        await sleep(1500);
    }

    throw new Error('Timed out waiting for conversation details');
}

async function waitForConversationByRunId(
    runId: string,
    agentId: string,
    startedAtUnixSecs: number,
    timeoutMs: number
): Promise<{ conversationId: string; details: any }> {
    const baseUrl = getElevenLabsBaseUrl();
    const deadline = Date.now() + timeoutMs;
    const checked = new Set<string>();

    while (Date.now() < deadline) {
        let cursor = '';
        for (let page = 0; page < 6; page += 1) {
            const params = new URLSearchParams();
            params.set('agent_id', agentId);
            params.set('page_size', '30');
            params.set('summary_mode', 'exclude');
            params.set('call_start_after_unix', String(Math.max(0, startedAtUnixSecs - 30)));
            if (cursor) {
                params.set('cursor', cursor);
            }

            const list = await fetchJson(`${baseUrl}/v1/convai/conversations?${params.toString()}`);
            const conversations = Array.isArray(list?.conversations) ? list.conversations : [];

            for (const conversation of conversations) {
                const conversationId = typeof conversation?.conversation_id === 'string'
                    ? conversation.conversation_id
                    : typeof conversation?.id === 'string'
                        ? conversation.id
                        : '';

                if (!conversationId || checked.has(conversationId)) {
                    continue;
                }
                checked.add(conversationId);

                const details = await fetchJson(`${baseUrl}/v1/convai/conversations/${encodeURIComponent(conversationId)}`);
                const detailsRunId = getConversationRunId(details?.conversation_initiation_client_data);
                if (detailsRunId !== runId) {
                    continue;
                }

                const status = String(details?.status || '').toLowerCase();
                if (status === 'done' || status === 'failed') {
                    return { conversationId, details };
                }
            }

            if (!list?.has_more || !list?.next_cursor) {
                break;
            }
            cursor = String(list.next_cursor);
        }

        await sleep(1800);
    }

    throw new Error('Timed out waiting for conversation lookup by run id');
}

function buildInitiationData(args: CliArgs, runId: string): Record<string, unknown> {
    const agentOverride: Record<string, unknown> = {
        prompt: {
            prompt: args.systemPrompt
        }
    };

    if (args.firstMessage) {
        agentOverride.first_message = args.firstMessage;
    }

    if (args.llm) {
        (agentOverride.prompt as Record<string, unknown>).llm = args.llm;
    }

    const dynamicVariables: Record<string, string> = { run_id: runId };
    if (args.callContext) {
        dynamicVariables.call_context = args.callContext;
        dynamicVariables.job = args.callContext;
    }

    const silenceEndCallTimeout = Number.parseInt(process.env.CALL_SILENCE_END_TIMEOUT_SECS || '8', 10);
    const maxDurationSeconds = Number.parseInt(process.env.CALL_MAX_DURATION_SECS || '180', 10);
    const safeSilenceTimeout = Number.isFinite(silenceEndCallTimeout) && silenceEndCallTimeout >= 1
        ? silenceEndCallTimeout
        : 8;
    const safeMaxDuration = Number.isFinite(maxDurationSeconds) && maxDurationSeconds >= 30
        ? maxDurationSeconds
        : 180;

    return {
        dynamic_variables: dynamicVariables,
        conversation_config_override: {
            turn: {
                silence_end_call_timeout: safeSilenceTimeout
            },
            conversation: {
                max_duration_seconds: safeMaxDuration
            },
            agent: agentOverride
        }
    };
}

async function run(): Promise<void> {
    try {
        const args = parseArgs(process.argv.slice(2));
        validateEnvironmentVariables();

        const runId = randomUUID();
        const startedAtUnixSecs = Math.floor(Date.now() / 1000);
        const baseUrl = getElevenLabsBaseUrl();
        let callSid: string | null = null;
        let conversationId = '';
        let details: any;

        if (args.agentPhoneNumberId) {
            const outboundPayload: Record<string, unknown> = {
                agent_id: args.agentId,
                agent_phone_number_id: args.agentPhoneNumberId,
                to_number: args.toNumber,
                conversation_initiation_client_data: buildInitiationData(args, runId)
            };

            const outbound = await postJson(`${baseUrl}/v1/convai/twilio/outbound-call`, outboundPayload);
            callSid = typeof outbound?.callSid === 'string' ? outbound.callSid : null;
            const outboundConversationId = typeof outbound?.conversation_id === 'string' ? outbound.conversation_id : '';
            if (outboundConversationId) {
                conversationId = outboundConversationId;
                details = await waitForConversationById(conversationId, args.timeoutMs);
            } else {
                const matched = await waitForConversationByRunId(runId, args.agentId, startedAtUnixSecs, args.timeoutMs);
                conversationId = matched.conversationId;
                details = matched.details;
            }
        } else {
            const result = await runViaTwilioRegisterCall(args, baseUrl, runId, startedAtUnixSecs);
            callSid = result.callSid;
            conversationId = result.conversationId;
            details = result.details;
        }

        const status = String(details?.status || '').toLowerCase();
        if (status === 'failed') {
            const reason = typeof details?.termination_reason === 'string' ? details.termination_reason : 'unknown';
            throw new Error(`ElevenLabs conversation failed: ${reason}`);
        }

        process.stdout.write(JSON.stringify({
            status: 'completed',
            callSid,
            conversationId,
            transcript: normalizeTranscript(details)
        }) + '\n');
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stdout.write(JSON.stringify({ status: 'error', message }) + '\n');
        process.exitCode = 1;
    }
}

run();
