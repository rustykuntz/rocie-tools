import { WebSocket } from 'ws';
import { OpenAIConfig } from '../../types.js';
import {
    OPENAI_REALTIME_MODEL,
    OPENAI_TURN_DETECTION,
    OPENAI_VAD_PREFIX_PADDING_MS,
    OPENAI_VAD_SILENCE_DURATION_MS,
    OPENAI_VAD_THRESHOLD,
    SHOW_TIMING_MATH
} from '../../config/constants.js';

/**
 * Service for handling OpenAI API interactions
 */
export class OpenAIWsService {
    private webSocket: WebSocket | null = null;
    private readonly config: OpenAIConfig;
    private readonly useGaSessionSchema: boolean;

    /**
     * Create a new OpenAI service
     * @param config Configuration for the OpenAI API
     */
    constructor(config: OpenAIConfig) {
        this.config = config;
        const schema = (process.env.OPENAI_SESSION_SCHEMA || 'ga').toLowerCase();
        this.useGaSessionSchema = schema !== 'legacy';
    }

    private buildTurnDetection(type: string): Record<string, unknown> {
        const turnDetection: Record<string, unknown> = { type };
        if (type === 'server_vad') {
            turnDetection.threshold = OPENAI_VAD_THRESHOLD;
            turnDetection.prefix_padding_ms = OPENAI_VAD_PREFIX_PADDING_MS;
            turnDetection.silence_duration_ms = OPENAI_VAD_SILENCE_DURATION_MS;
        }
        return turnDetection;
    }

    private buildWebSocketUrl(): string {
        const websocketUrl = new URL(this.config.websocketUrl);
        websocketUrl.searchParams.set('model', OPENAI_REALTIME_MODEL);
        return websocketUrl.toString();
    }

    private getGaOutputVoice(): string | { id: string } {
        const voiceId = (process.env.OPENAI_VOICE_ID || '').trim();
        if (voiceId) {
            return { id: voiceId };
        }
        return this.config.voice;
    }

    /**
     * Initialize the WebSocket connection to OpenAI
     * @param onMessage Callback for handling messages from OpenAI
     * @param onOpen Callback for when the connection is opened
     * @param onError Callback for handling errors
     */
    public initialize(
        onMessage: (data: WebSocket.Data) => void,
        onOpen: () => void,
        onError: (error: Error) => void
    ): void {
        if (!OPENAI_REALTIME_MODEL) {
            onError(new Error('Missing required env var: OPENAI_REALTIME_MODEL'));
            return;
        }

        const headers: Record<string, string> = {
            Authorization: `Bearer ${this.config.apiKey}`,
        };

        if (!this.useGaSessionSchema) {
            headers['OpenAI-Beta'] = 'realtime=v1';
        }

        this.webSocket = new WebSocket(this.buildWebSocketUrl(), {
            headers
        });

        this.webSocket.on('open', onOpen);
        this.webSocket.on('message', onMessage);
        this.webSocket.on('error', onError);
        this.webSocket.on('close', () => onError(new Error('OpenAI WebSocket closed')));
    }

    /**
     * Initialize the session with OpenAI
     * @param callContext The context for the call
     */
    public initializeSession(callContext: string): void {
        if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
            return;
        }

        if (!this.useGaSessionSchema && (process.env.OPENAI_VOICE_ID || '').trim()) {
            console.warn('OPENAI_VOICE_ID is only supported with OPENAI_SESSION_SCHEMA=ga. Ignoring voice id in legacy mode.');
        }

        const transcriptionLanguage = (process.env.OPENAI_TRANSCRIPTION_LANGUAGE || '').trim();
        const gaTranscription: Record<string, unknown> = { model: 'whisper-1' };
        if (transcriptionLanguage) {
            gaTranscription.language = transcriptionLanguage;
        }

        const instructions = `${callContext}\n\n## Call Control\n- When the conversation goal is complete or the callee asks to end, call the end_call tool.\n- Before calling end_call, say one short closing line.`;
        const legacyTooling = {
            input_audio_transcription: {
                model: 'whisper-1'
            },
            tools: [
                {
                    type: 'function',
                    name: 'end_call',
                    description: 'End the active phone call when the conversation is complete or the callee requests to end.',
                    parameters: {
                        type: 'object',
                        properties: {
                            reason: {
                                type: 'string',
                                description: 'Short reason for ending the call.'
                            }
                        },
                        additionalProperties: false
                    }
                }
            ],
            tool_choice: 'auto'
        };
        const gaTooling = {
            tools: legacyTooling.tools,
            tool_choice: legacyTooling.tool_choice
        };

        const gaTurnDetection = this.buildTurnDetection(OPENAI_TURN_DETECTION);
        const legacyTurnDetectionType = OPENAI_TURN_DETECTION === 'semantic_vad' ? 'server_vad' : OPENAI_TURN_DETECTION;
        const legacyTurnDetection = this.buildTurnDetection(legacyTurnDetectionType);

        const sessionUpdate = this.useGaSessionSchema
            ? {
                type: 'session.update',
                session: {
                    type: 'realtime',
                    model: OPENAI_REALTIME_MODEL,
                    output_modalities: ['audio'],
                    audio: {
                        input: {
                            format: { type: 'audio/pcmu' },
                            turn_detection: gaTurnDetection,
                            transcription: gaTranscription
                        },
                        output: {
                            format: { type: 'audio/pcmu' },
                            voice: this.getGaOutputVoice()
                        }
                    },
                    instructions,
                    ...gaTooling
                }
            }
            : {
                type: 'session.update',
                session: {
                    turn_detection: legacyTurnDetection,
                    input_audio_format: 'g711_ulaw',
                    output_audio_format: 'g711_ulaw',
                    voice: this.config.voice,
                    instructions,
                    modalities: ['text', 'audio'],
                    temperature: this.config.temperature,
                    ...legacyTooling
                }
            };

        this.webSocket.send(JSON.stringify(sessionUpdate));
    }

    /**
     * Ask the model to start a response
     */
    public requestResponse(): void {
        if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
            return;
        }

        this.webSocket.send(JSON.stringify({ type: 'response.create' }));
    }

    /**
     * Close the WebSocket connection
     */
    public close(): void {
        if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
            this.webSocket.close();
        }
    }

    /**
     * Forward audio data to OpenAI
     * @param audioPayload The audio payload to forward
     */
    public sendAudio(audioPayload: string): void {
        if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
            return;
        }

        const audioAppend = {
            type: 'input_audio_buffer.append',
            audio: audioPayload
        };

        this.webSocket.send(JSON.stringify(audioAppend));
    }

    /**
     * Return function-call output to OpenAI
     * @param callId The function call ID
     * @param output The output payload
     */
    public sendFunctionCallOutput(callId: string, output: Record<string, unknown>): void {
        if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN || !callId) {
            return;
        }

        this.webSocket.send(JSON.stringify({
            type: 'conversation.item.create',
            item: {
                type: 'function_call_output',
                call_id: callId,
                output: JSON.stringify(output || {})
            }
        }));

        this.requestResponse();
    }

    /**
     * Truncate the assistant's response
     * @param itemId The ID of the assistant's response
     * @param elapsedTime The time elapsed since the response started
     */
    public truncateAssistantResponse(itemId: string, elapsedTime: number): void {
        if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
            return;
        }

        const truncateEvent = {
            type: 'conversation.item.truncate',
            item_id: itemId,
            content_index: 0,
            audio_end_ms: elapsedTime
        };

        if (SHOW_TIMING_MATH) {
            console.error('Sending truncation event:', JSON.stringify(truncateEvent));
        }

        this.webSocket.send(JSON.stringify(truncateEvent));
    }

    /**
     * Check if the WebSocket is connected
     */
    public isConnected(): boolean {
        return this.webSocket !== null && this.webSocket.readyState === WebSocket.OPEN;
    }
}
