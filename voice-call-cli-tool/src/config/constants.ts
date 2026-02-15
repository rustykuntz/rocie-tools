export const LOG_EVENT_TYPES = [
    'error',
    'session.created',
    'response.audio.delta',
    'response.output_audio.delta',
    'response.audio_transcript.done',
    'response.output_audio_transcript.done',
    'conversation.item.input_audio_transcription.completed',
    'response.output_item.done',
];

export const DYNAMIC_API_SECRET = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
export const SHOW_TIMING_MATH = false;
export const VOICE = 'sage';
export const RECORD_CALLS = process.env.RECORD === 'true';
export const OPENAI_REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime';
export const OPENAI_TURN_DETECTION = process.env.OPENAI_TURN_DETECTION || 'semantic_vad';

function parseOptionalFloat(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalInt(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
}

export const OPENAI_VAD_THRESHOLD = parseOptionalFloat(process.env.OPENAI_VAD_THRESHOLD);
export const OPENAI_VAD_PREFIX_PADDING_MS = parseOptionalInt(process.env.OPENAI_VAD_PREFIX_PADDING_MS);
export const OPENAI_VAD_SILENCE_DURATION_MS = parseOptionalInt(process.env.OPENAI_VAD_SILENCE_DURATION_MS);
