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
        this.useGaSessionSchema = process.env.OPENAI_SESSION_SCHEMA === 'ga';
    }

    private buildTurnDetection(type: string): Record<string, unknown> {
        const turnDetection: Record<string, unknown> = { type };
        if (type === 'server_vad') {
            if (typeof OPENAI_VAD_THRESHOLD === 'number') {
                turnDetection.threshold = OPENAI_VAD_THRESHOLD;
            }
            if (typeof OPENAI_VAD_PREFIX_PADDING_MS === 'number') {
                turnDetection.prefix_padding_ms = OPENAI_VAD_PREFIX_PADDING_MS;
            }
            if (typeof OPENAI_VAD_SILENCE_DURATION_MS === 'number') {
                turnDetection.silence_duration_ms = OPENAI_VAD_SILENCE_DURATION_MS;
            }
        }
        return turnDetection;
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
        const headers: Record<string, string> = {
            Authorization: `Bearer ${this.config.apiKey}`,
        };
        // Current Twilio websocket integrations are typically on the legacy realtime event schema.
        if (!this.useGaSessionSchema) {
            headers['OpenAI-Beta'] = 'realtime=v1';
        }

        this.webSocket = new WebSocket(this.config.websocketUrl, {
            headers
        });

        this.webSocket.on('open', onOpen);
        this.webSocket.on('message', onMessage);
        this.webSocket.on('error', onError);
    }

    /**
     * Initialize the session with OpenAI
     * @param callContext The context for the call
     */
    public initializeSession(callContext: string): void {
        if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
            return;
        }

        const instructions = `${callContext}\n\n## Call Control\n- When the conversation goal is complete or the callee asks to end, call the end_call tool.\n- Before calling end_call, say one short closing line.`;
        const commonTooling = {
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
                            turn_detection: gaTurnDetection
                        },
                        output: {
                            format: { type: 'audio/pcmu' },
                            voice: this.config.voice
                        }
                    },
                    instructions,
                    temperature: this.config.temperature,
                    ...commonTooling
                }
            }
            : {
                type: 'session.update',
                session: {
                    // Legacy realtime websocket schema (Twilio-compatible today).
                    turn_detection: legacyTurnDetection,
                    input_audio_format: 'g711_ulaw',
                    output_audio_format: 'g711_ulaw',
                    voice: this.config.voice,
                    instructions,
                    modalities: ['text', 'audio'],
                    temperature: this.config.temperature,
                    ...commonTooling
                }
            };

        this.webSocket.send(JSON.stringify(sessionUpdate));
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

        this.webSocket.send(JSON.stringify({ type: 'response.create' }));
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
