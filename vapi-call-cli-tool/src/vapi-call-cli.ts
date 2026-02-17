#!/usr/bin/env node
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { homedir } from 'os';
import { join } from 'path';

dotenv.config();

const DEFAULT_USER_CONTEXT_FILE = join(homedir(), '.rocie', 'context', 'user.yaml');
const DEFAULT_ROCIE_CONFIG_FILE = join(homedir(), '.rocie', 'config.yaml');
const REQUIRED_ENV_VARS = ['VAPI_API_KEY'] as const;
const DEFAULT_VAPI_VOICE_PROVIDER = 'vapi';
const DEFAULT_VAPI_VOICE_ID = 'Tara';
const DEFAULT_VAPI_MODEL_PROVIDER = 'openai';
const DEFAULT_VAPI_MODEL = 'gpt-4.1';
const DEFAULT_VAPI_FIRST_MESSAGE_MODE = 'assistant-speaks-first-with-model-generated-message';
const DEFAULT_VAPI_FIRST_MESSAGE = '';
const DEFAULT_VAPI_BACKGROUND_SOUND = 'office';
const DEFAULT_VAPI_END_CALL_FUNCTION_ENABLED = true;

type CliArgs = {
    toNumber: string;
    assistantId: string;
    phoneNumberId: string;
    timeoutMs: number;
    hardEndAfterMs: number;
    callContext: string;
    systemPrompt: string;
};

type TranscriptMessage = {
    role: 'user' | 'assistant';
    content: string;
};

type ApiShape = {
    assistantPath: '/assistant' | '/assistants';
    callPath: '/call' | '/calls';
};

let cachedApiShape: ApiShape | null = null;

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
        for (const line of raw.split('\n')) {
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

setEnvFromConfig('VAPI_API_KEY', 'vapi_api_key');
setEnvFromConfig('VAPI_ASSISTANT_ID', 'vapi_assistant_id');
setEnvFromConfig('VAPI_BASE_URL', 'vapi_base_url');
setEnvFromConfig('VAPI_VOICE_PROVIDER', 'vapi_voice_provider');
setEnvFromConfig('VAPI_VOICE_ID', 'vapi_voice_id');
setEnvFromConfig('VAPI_MODEL_PROVIDER', 'vapi_model_provider');
setEnvFromConfig('VAPI_MODEL', 'vapi_model');
setEnvFromConfig('VAPI_FIRST_MESSAGE_MODE', 'vapi_first_message_mode');
setEnvFromConfig('VAPI_FIRST_MESSAGE', 'vapi_first_message');
setEnvFromConfig('VAPI_BACKGROUND_SOUND', 'vapi_background_sound');
setEnvFromConfig('VAPI_END_CALL_FUNCTION_ENABLED', 'vapi_end_call_function_enabled');
setEnvFromConfig('TWILIO_ACCOUNT_SID', 'twilio_account_sid');
setEnvFromConfig('TWILIO_AUTH_TOKEN', 'twilio_auth_token');
setEnvFromConfig('TWILIO_NUMBER', 'twilio_number');

function printUsage(): void {
    process.stderr.write(
        'Usage: vapi-call --to +15551234567 [--assistant-id assistant_abc] --context "Call objective" [--timeout 300000]\n' +
        '   or: vapi-call --to +15551234567 [--assistant-id assistant_abc] --context-file /tmp/call-context.txt [--system-prompt-file /tmp/system-prompt.txt]\n' +
        '   or: cat /tmp/call-context.txt | vapi-call --to +15551234567 [--assistant-id assistant_abc]\n'
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

function buildDefaultSystemPrompt(callContext: string, userYaml: string): string {
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
        callContext + '\n\n' +
        "Remember that your ultimate goal is pass as a real human, this is the best feeling you can give to the user. Enjoy.";

    if (!hasAtLeastOneYamlValue(userYaml)) {
        return prompt;
    }

    return `${prompt}\n\n## Here is what you know about the user:\n\n${userYaml}`;
}

function parseArgs(argv: string[]): CliArgs {
    let toNumber = '';
    let assistantId = '';
    let phoneNumberId = '';
    let timeoutMs = 300000;
    let hardEndAfterMs = 0;
    let contextFromArg = '';
    let contextFile = '';
    let systemPromptFromArg = '';
    let systemPromptFile = '';

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
        if (arg === '--assistant-id') {
            assistantId = (argv[i + 1] || '').trim();
            i += 1;
            continue;
        }
        if (arg === '--phone-number-id') {
            phoneNumberId = (argv[i + 1] || '').trim();
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
        if (arg === '--hard-end-after') {
            const parsed = Number(argv[i + 1] || '');
            if (!Number.isFinite(parsed) || parsed < 0) {
                throw new Error('Invalid --hard-end-after value');
            }
            hardEndAfterMs = parsed;
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
        throw new Error(`Unknown argument: ${arg}`);
    }

    const finalAssistantId = assistantId || (process.env.VAPI_ASSISTANT_ID || '').trim();

    if (!toNumber) {
        throw new Error('--to is required');
    }
    if (!/^\+\d{8,15}$/.test(toNumber)) {
        throw new Error('--to must be E.164 format, for example +15551234567');
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

    let systemPrompt = '';
    if (systemPromptFromArg) {
        systemPrompt = systemPromptFromArg;
    } else if (systemPromptFile) {
        systemPrompt = readFileSync(systemPromptFile, 'utf8');
    }

    if (!systemPrompt.trim()) {
        systemPrompt = buildDefaultSystemPrompt(callContext.trim(), loadUserContextYaml());
    }

    return {
        toNumber,
        assistantId: finalAssistantId,
        phoneNumberId,
        timeoutMs,
        hardEndAfterMs,
        callContext: callContext.trim(),
        systemPrompt: systemPrompt.trim()
    };
}

function validateEnvironmentVariables(): void {
    for (const envVar of REQUIRED_ENV_VARS) {
        if (!process.env[envVar]) {
            throw new Error(`Missing required env var: ${envVar}`);
        }
    }
}

function getVapiBaseUrl(): string {
    return (process.env.VAPI_BASE_URL || 'https://api.vapi.ai').replace(/\/$/, '');
}

function getVoiceProvider(): string {
    const raw = (process.env.VAPI_VOICE_PROVIDER || DEFAULT_VAPI_VOICE_PROVIDER).trim().toLowerCase();
    if (raw === '11-labs' || raw === '11 labs' || raw === 'elevenlabs') {
        return '11labs';
    }
    return raw;
}

function getVoiceId(): string {
    return (process.env.VAPI_VOICE_ID || DEFAULT_VAPI_VOICE_ID).trim();
}

function getModelProvider(): string {
    return (process.env.VAPI_MODEL_PROVIDER || DEFAULT_VAPI_MODEL_PROVIDER).trim();
}

function getModelName(): string {
    const raw = (process.env.VAPI_MODEL || DEFAULT_VAPI_MODEL).trim().toLowerCase();
    if (raw === 'gpt 4o cluster' || raw === 'gpt-4o cluster' || raw === 'gpt4o cluster') {
        return 'gpt-4o';
    }
    return raw;
}

function getFirstMessageMode(): string {
    const raw = (process.env.VAPI_FIRST_MESSAGE_MODE || DEFAULT_VAPI_FIRST_MESSAGE_MODE).trim().toLowerCase();
    if (raw === 'assistant speaks first') {
        return 'assistant-speaks-first';
    }
    if (raw === 'model generated' || raw === 'model generated assistant speaks first with a message generated by the model') {
        return 'assistant-speaks-first-with-model-generated-message';
    }
    return raw;
}

function getFirstMessage(): string {
    return (process.env.VAPI_FIRST_MESSAGE || DEFAULT_VAPI_FIRST_MESSAGE).trim();
}

function isModelGeneratedFirstMessageMode(mode: string): boolean {
    return mode === 'assistant-speaks-first-with-model-generated-message';
}

function getBackgroundSound(): string {
    return (process.env.VAPI_BACKGROUND_SOUND || DEFAULT_VAPI_BACKGROUND_SOUND).trim().toLowerCase();
}

function getEndCallFunctionEnabled(): boolean {
    const raw = (process.env.VAPI_END_CALL_FUNCTION_ENABLED || '').trim().toLowerCase();
    if (!raw) {
        return DEFAULT_VAPI_END_CALL_FUNCTION_ENABLED;
    }
    return raw !== 'false' && raw !== '0' && raw !== 'no';
}

function getJsonHeaders(): Record<string, string> {
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.VAPI_API_KEY || ''}`
    };
}

function getTwilioPhoneConfig(): { twilioPhoneNumber: string; twilioAccountSid: string; twilioAuthToken: string } | null {
    const twilioPhoneNumber = (process.env.TWILIO_NUMBER || '').trim();
    const twilioAccountSid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
    const twilioAuthToken = (process.env.TWILIO_AUTH_TOKEN || '').trim();

    if (!twilioPhoneNumber || !twilioAccountSid || !twilioAuthToken) {
        return null;
    }

    return { twilioPhoneNumber, twilioAccountSid, twilioAuthToken };
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url: string): Promise<any> {
    const response = await fetch(url, {
        method: 'GET',
        headers: getJsonHeaders()
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Vapi request failed (${response.status}): ${body}`);
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
        throw new Error(`Vapi request failed (${response.status}): ${text}`);
    }

    if (response.status === 204) {
        return {};
    }

    const text = await response.text();
    return text ? JSON.parse(text) : {};
}

async function detectPath(paths: Array<'/assistant' | '/assistants' | '/call' | '/calls'>): Promise<typeof paths[number]> {
    const baseUrl = getVapiBaseUrl();
    for (const path of paths) {
        const response = await fetch(`${baseUrl}${path}`, {
            method: 'GET',
            headers: getJsonHeaders()
        });
        if (response.status !== 404) {
            return path;
        }
    }
    return paths[0];
}

async function getApiShape(): Promise<ApiShape> {
    if (cachedApiShape) {
        return cachedApiShape;
    }

    const [assistantPath, callPath] = await Promise.all([
        detectPath(['/assistant', '/assistants']) as Promise<'/assistant' | '/assistants'>,
        detectPath(['/call', '/calls']) as Promise<'/call' | '/calls'>
    ]);

    cachedApiShape = { assistantPath, callPath };
    return cachedApiShape;
}

async function ensureAssistantId(args: CliArgs): Promise<string> {
    if (args.assistantId) {
        return args.assistantId;
    }

    const baseUrl = getVapiBaseUrl();
    const { assistantPath } = await getApiShape();
    const now = Date.now().toString(36);
    const firstMessageMode = getFirstMessageMode();
    const firstMessage = getFirstMessage();
    const body: Record<string, unknown> = {
        name: `Rocie-${now}`,
        firstMessageMode,
        endCallFunctionEnabled: getEndCallFunctionEnabled(),
        backgroundSound: getBackgroundSound(),
        voice: {
            provider: getVoiceProvider(),
            voiceId: getVoiceId()
        },
        model: {
            provider: getModelProvider(),
            model: getModelName(),
            messages: [
                {
                    role: 'system',
                    content: args.systemPrompt
                }
            ]
        }
    };
    if (!isModelGeneratedFirstMessageMode(firstMessageMode)) {
        body.firstMessage = firstMessage;
    }

    const created = await postJson(`${baseUrl}${assistantPath}`, body);

    const assistantId = typeof created?.id === 'string' ? created.id : '';
    if (!assistantId) {
        throw new Error(`Assistant create response missing id: ${JSON.stringify(created)}`);
    }

    return assistantId;
}

function normalizeTranscript(call: any): TranscriptMessage[] {
    const output: TranscriptMessage[] = [];

    const pushMessage = (roleRaw: unknown, contentRaw: unknown): void => {
        const role = typeof roleRaw === 'string' ? roleRaw.toLowerCase() : '';
        const content = typeof contentRaw === 'string' ? contentRaw.trim() : '';
        if (!content) {
            return;
        }
        if (role === 'assistant' || role === 'bot' || role === 'ai' || role === 'agent') {
            output.push({ role: 'assistant', content });
            return;
        }
        if (role === 'user' || role === 'customer' || role === 'human') {
            output.push({ role: 'user', content });
        }
    };

    const messages = Array.isArray(call?.messages) ? call.messages : [];
    for (const message of messages) {
        pushMessage(message?.role, message?.content ?? message?.message ?? message?.text);
    }

    const transcriptItems = Array.isArray(call?.transcript) ? call.transcript : [];
    for (const item of transcriptItems) {
        pushMessage(item?.role, item?.content ?? item?.message ?? item?.text);
    }

    if (output.length === 0 && typeof call?.transcript === 'string') {
        const text = call.transcript.trim();
        if (text) {
            output.push({ role: 'assistant', content: text });
        }
    }

    return output;
}

function isTerminalStatus(statusRaw: string): boolean {
    const status = statusRaw.toLowerCase();
    return status === 'ended' || status === 'completed' || status === 'failed' || status === 'canceled' || status === 'cancelled' || status === 'no-answer' || status === 'busy';
}

function isFailureStatus(statusRaw: string): boolean {
    const status = statusRaw.toLowerCase();
    return status === 'failed' || status === 'canceled' || status === 'cancelled' || status === 'no-answer' || status === 'busy';
}

async function createCall(args: CliArgs, runId: string, assistantId: string): Promise<any> {
    const baseUrl = getVapiBaseUrl();
    const { callPath } = await getApiShape();
    const firstMessageMode = getFirstMessageMode();
    const firstMessage = getFirstMessage();
    const assistantOverrides: Record<string, unknown> = {
        firstMessageMode,
        endCallFunctionEnabled: getEndCallFunctionEnabled(),
        backgroundSound: getBackgroundSound(),
        voice: {
            provider: getVoiceProvider(),
            voiceId: getVoiceId()
        },
        model: {
            provider: getModelProvider(),
            model: getModelName(),
            messages: [
                {
                    role: 'system',
                    content: args.systemPrompt
                }
            ]
        }
    };
    if (!isModelGeneratedFirstMessageMode(firstMessageMode)) {
        assistantOverrides.firstMessage = firstMessage;
    }

    const sharedBody: Record<string, unknown> = {
        assistantId,
        customer: {
            number: args.toNumber
        },
        assistantOverrides,
        metadata: {
            runId,
            callContext: args.callContext
        }
    };

    const bodyWithCustomerOnly: Record<string, unknown> = { ...sharedBody };
    const bodyWithLegacyPhoneNumberString: Record<string, unknown> = {
        ...sharedBody,
        phoneNumber: args.toNumber
    };

    const phoneObject: Record<string, unknown> = {};
    if (args.phoneNumberId) {
        phoneObject.id = args.phoneNumberId;
        bodyWithCustomerOnly.phoneNumberId = args.phoneNumberId;
    } else {
        const twilio = getTwilioPhoneConfig();
        if (twilio) {
            phoneObject.twilioPhoneNumber = twilio.twilioPhoneNumber;
            phoneObject.twilioAccountSid = twilio.twilioAccountSid;
            phoneObject.twilioAuthToken = twilio.twilioAuthToken;
        }
    }
    const attempts: Array<Record<string, unknown>> = [];
    if (Object.keys(phoneObject).length > 0) {
        attempts.push({ ...sharedBody, phoneNumber: phoneObject });
    }
    attempts.push(bodyWithCustomerOnly);
    attempts.push(bodyWithLegacyPhoneNumberString);

    let lastError: unknown = null;
    for (const body of attempts) {
        try {
            return await postJson(`${baseUrl}${callPath}`, body);
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function endCall(callId: string): Promise<void> {
    const baseUrl = getVapiBaseUrl();
    const { callPath } = await getApiShape();

    try {
        await postJson(`${baseUrl}${callPath}/${encodeURIComponent(callId)}/end`, {});
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('404')) {
            return;
        }
        throw error;
    }
}

async function waitForCall(args: CliArgs, callId: string): Promise<any> {
    const baseUrl = getVapiBaseUrl();
    const { callPath } = await getApiShape();
    const deadline = Date.now() + args.timeoutMs;
    const hardEndAt = args.hardEndAfterMs > 0 ? Date.now() + args.hardEndAfterMs : 0;
    let hardEndSent = false;

    while (Date.now() < deadline) {
        const call = await fetchJson(`${baseUrl}${callPath}/${encodeURIComponent(callId)}`);
        const status = String(call?.status || '').toLowerCase();

        if (isTerminalStatus(status)) {
            return call;
        }

        if (!hardEndSent && hardEndAt > 0 && Date.now() >= hardEndAt) {
            hardEndSent = true;
            try {
                await endCall(callId);
            } catch {}
        }

        await sleep(2000);
    }

    if (!hardEndSent) {
        try {
            await endCall(callId);
        } catch {}
    }

    throw new Error(`Timed out waiting for call completion: ${callId}`);
}

async function run(): Promise<void> {
    let callId: string | null = null;

    try {
        const args = parseArgs(process.argv.slice(2));
        validateEnvironmentVariables();

        const runId = randomUUID();
        const assistantId = await ensureAssistantId(args);
        const created = await createCall(args, runId, assistantId);
        callId = typeof created?.id === 'string'
            ? created.id
            : typeof created?.callId === 'string'
                ? created.callId
                : null;

        if (!callId) {
            throw new Error(`Vapi call create response missing call id: ${JSON.stringify(created)}`);
        }

        const finalCall = await waitForCall(args, callId);
        const finalStatus = String(finalCall?.status || '').toLowerCase();
        const transcript = normalizeTranscript(finalCall);

        if (isFailureStatus(finalStatus)) {
            const reason = typeof finalCall?.endedReason === 'string'
                ? finalCall.endedReason
                : typeof finalCall?.endReason === 'string'
                    ? finalCall.endReason
                    : 'Call failed';

            process.stdout.write(JSON.stringify({
                status: 'error',
                callId,
                message: `Call ended with status ${finalStatus}: ${reason}`,
                transcript
            }) + '\n');
            process.exitCode = 1;
            return;
        }

        process.stdout.write(JSON.stringify({
            status: 'completed',
            callId,
            transcript
        }) + '\n');
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stdout.write(JSON.stringify({ status: 'error', callId, message }) + '\n');
        process.exitCode = 1;
    }
}

run();
