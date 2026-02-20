import { WebSocket } from 'ws';
import { CallState } from '../../types.js';
import { LOG_EVENT_TYPES, SHOW_TIMING_MATH } from '../../config/constants.js';

/**
 * Service for processing OpenAI events
 */
export class OpenAIEventService {
    private readonly callState: CallState;
    private readonly onEndCallTool: (callId: string | null, args: Record<string, unknown>) => void;
    private readonly onSendAudioToTwilio: (payload: string) => void;
    private readonly onSendMarkToTwilio: () => void;
    private readonly onTruncateResponse: () => void;
    private readonly onSessionUpdated: (response: any) => void;
    private readonly useGaSessionSchema: boolean;
    private gaNeedsPcmToMulawTranscode = false;
    private gaAudioDeltaType: 'response.audio.delta' | 'response.output_audio.delta' | null = null;
    private lastAssistantAudioMs = new Map<string, number>();

    /**
     * Create a new OpenAI event processor
     * @param callState The state of the call
     * @param onEndCallTool Callback for model end_call tool invocation
     * @param onSendAudioToTwilio Callback for sending audio to Twilio
     * @param onSendMarkToTwilio Callback for sending mark events to Twilio
     * @param onTruncateResponse Callback for truncating the response
     * @param onSessionUpdated Callback for when session settings are acknowledged
     */
    constructor(
        callState: CallState,
        onEndCallTool: (callId: string | null, args: Record<string, unknown>) => void,
        onSendAudioToTwilio: (payload: string) => void,
        onSendMarkToTwilio: () => void,
        onTruncateResponse: () => void,
        onSessionUpdated: (response: any) => void
    ) {
        this.callState = callState;
        this.onEndCallTool = onEndCallTool;
        this.onSendAudioToTwilio = onSendAudioToTwilio;
        this.onSendMarkToTwilio = onSendMarkToTwilio;
        this.onTruncateResponse = onTruncateResponse;
        this.onSessionUpdated = onSessionUpdated;
        const schema = (process.env.OPENAI_SESSION_SCHEMA || 'ga').toLowerCase();
        this.useGaSessionSchema = schema !== 'legacy';
    }

    /**
     * Process an OpenAI message
     * @param data The message data
     */
    public processMessage(data: WebSocket.Data): void {
        try {
            const response = JSON.parse(data.toString());

            if (LOG_EVENT_TYPES.includes(response.type)) {
                // console.log(`Received event: ${response.type}`, response);
            }

            this.processEvent(response);
        } catch (error) {
            console.error('Error processing OpenAI message:', error, 'Raw message:', data);
        }
    }

    /**
     * Process an OpenAI event
     * @param response The event data
     */
    private processEvent(response: any): void {
        switch (response.type) {
        case 'conversation.item.input_audio_transcription.completed':
            this.handleTranscriptionCompleted(response.transcript);
            break;
        case 'response.audio_transcript.done':
            if (!this.useGaSessionSchema) {
                this.handleAudioTranscriptDone(response.transcript);
            }
            break;
        case 'response.output_audio_transcript.done':
            if (this.useGaSessionSchema) {
                this.handleAudioTranscriptDone(response.transcript);
            }
            break;
        case 'response.audio.delta':
            if (response.delta && this.shouldHandleAudioDelta('response.audio.delta')) {
                this.handleAudioDelta(response);
            }
            break;
        case 'response.output_audio.delta':
            if (response.delta && this.shouldHandleAudioDelta('response.output_audio.delta')) {
                this.handleAudioDelta(response);
            }
            break;
        case 'response.output_item.done':
            this.handleOutputItemDone(response.item);
            break;
        case 'input_audio_buffer.speech_started':
            this.onTruncateResponse();
            break;
        case 'session.updated':
            this.updateGaAudioFormatState(response);
            this.onSessionUpdated(response);
            break;
        case 'error':
            console.error('OpenAI realtime error event:', response);
            break;
        }
    }

    /**
     * Handle a transcription completed event
     * @param transcription The transcription text
     */
    private handleTranscriptionCompleted(transcription: string): void {
        if (!transcription) {
            return;
        }

        this.callState.conversationHistory.push({
            role: 'user',
            content: transcription
        });
    }

    /**
     * Handle an audio transcript done event
     * @param transcript The transcript text
     */
    private handleAudioTranscriptDone(transcript: string): void {
        if (!transcript) {
            return;
        }

        this.callState.conversationHistory.push({
            role: 'assistant',
            content: transcript
        });
    }

    /**
     * Handle output item done event
     * @param item The output item
     */
    private handleOutputItemDone(item: any): void {
        if (!item || item.type !== 'function_call' || item.name !== 'end_call') {
            return;
        }

        const args = this.safeParseArgs(item.arguments);
        this.onEndCallTool(item.call_id || null, args);
    }

    /**
     * Parse tool-call arguments
     * @param rawArgs Tool arguments as JSON string
     */
    private safeParseArgs(rawArgs: unknown): Record<string, unknown> {
        if (typeof rawArgs !== 'string' || !rawArgs.trim()) {
            return {};
        }

        try {
            const parsed = JSON.parse(rawArgs);
            if (parsed && typeof parsed === 'object') {
                return parsed as Record<string, unknown>;
            }
            return {};
        } catch {
            return {};
        }
    }

    /**
     * Handle an audio delta event
     * @param response The event data
     */
    private handleAudioDelta(response: any): void {
        const payload = this.useGaSessionSchema
            ? this.normalizeGaAudioPayload(response.delta)
            : response.delta;
        this.onSendAudioToTwilio(payload);
        // Emit a Twilio mark for each chunk so playback progress can be tracked precisely.
        this.onSendMarkToTwilio();

        if (response.item_id) {
            const raw = Buffer.from(payload, 'base64');
            const ms = Math.round((raw.length / 8000) * 1000);
            const prev = this.lastAssistantAudioMs.get(response.item_id) || 0;
            this.lastAssistantAudioMs.set(response.item_id, prev + Math.max(ms, 0));
            this.callState.lastAssistantItemId = response.item_id;
        }

        if (this.callState.responseStartTimestampTwilio === null) {
            this.callState.responseStartTimestampTwilio = this.callState.latestMediaTimestamp;
            if (SHOW_TIMING_MATH) {
                // console.log(`Setting start timestamp for new response: ${this.callState.responseStartTimestampTwilio}ms`);
            }
        }
    }

    public getAssistantAudioMs(itemId: string): number {
        return this.lastAssistantAudioMs.get(itemId) || 0;
    }

    private updateGaAudioFormatState(response: any): void {
        if (!this.useGaSessionSchema) {
            return;
        }

        const outputFormat = response?.session?.audio?.output?.format;
        const outputType = typeof outputFormat === 'string'
            ? outputFormat
            : outputFormat?.type;
        this.gaNeedsPcmToMulawTranscode = outputType === 'audio/pcm';
    }

    private shouldHandleAudioDelta(type: 'response.audio.delta' | 'response.output_audio.delta'): boolean {
        if (!this.useGaSessionSchema) {
            return type === 'response.audio.delta';
        }

        if (!this.gaAudioDeltaType) {
            this.gaAudioDeltaType = type;
        }

        return this.gaAudioDeltaType === type;
    }

    private normalizeGaAudioPayload(base64Payload: string): string {
        if (typeof base64Payload !== 'string' || !base64Payload) {
            return base64Payload;
        }

        const raw = Buffer.from(base64Payload, 'base64');
        if (!this.gaNeedsPcmToMulawTranscode) {
            return base64Payload;
        }

        const mulaw = this.pcm16le24kToMulaw8k(raw);
        return mulaw.toString('base64');
    }

    private pcm16le24kToMulaw8k(rawPcm: Buffer): Buffer {
        const sampleCount = Math.floor(rawPcm.length / 2);
        const outSampleCount = Math.floor(sampleCount / 3);
        const out = Buffer.allocUnsafe(Math.max(outSampleCount, 0));

        let outIndex = 0;
        for (let sampleIndex = 0; sampleIndex + 2 < sampleCount; sampleIndex += 3) {
            const sample = rawPcm.readInt16LE(sampleIndex * 2);
            out[outIndex] = this.linear16ToMulaw(sample);
            outIndex += 1;
        }

        return out.subarray(0, outIndex);
    }

    private linear16ToMulaw(sample: number): number {
        const MULAW_MAX = 32635;
        const MULAW_BIAS = 0x84;

        let pcm = sample;
        let sign = 0;
        if (pcm < 0) {
            pcm = -pcm;
            sign = 0x80;
        }
        if (pcm > MULAW_MAX) {
            pcm = MULAW_MAX;
        }
        pcm += MULAW_BIAS;

        let exponent = 7;
        for (let expMask = 0x4000; exponent > 0 && (pcm & expMask) === 0; expMask >>= 1) {
            exponent -= 1;
        }

        const mantissa = (pcm >> (exponent + 3)) & 0x0f;
        const mulaw = ~(sign | (exponent << 4) | mantissa);
        return mulaw & 0xff;
    }
}
