import { WebSocket } from 'ws';
import twilio from 'twilio';
import dotenv from 'dotenv';
import { CallState, CallType, OpenAIConfig } from '../types.js';
import { VOICE } from '../config/constants.js';
import { OpenAIContextService } from '../services/openai/context.service.js';
import { OpenAIWsService } from '../services/openai/ws.service.js';
import { TwilioWsService } from '../services/twilio/ws.service.js';
import { OpenAIEventService } from '../services/openai/event.service.js';
import { TwilioEventService } from '../services/twilio/event.service.js';
import { SessionManagerService } from '../services/session-manager.service.js';
import { TwilioCallService } from '../services/twilio/call.service.js';
import { callTracker } from '../services/call-tracker.js';

dotenv.config();

/**
 * Handles the communication between Twilio and OpenAI for voice calls
 */
export class OpenAICallHandler {
    private readonly twilioStream: TwilioWsService;
    private readonly openAIService: OpenAIWsService;
    private readonly openAIEventProcessor: OpenAIEventService;
    private readonly twilioEventProcessor: TwilioEventService;
    private readonly twilioCallService: TwilioCallService;
    private readonly callState: CallState;
    private endingCall = false;
    private sessionInitialized = false;
    private sessionReady = false;
    private initialResponseRequested = false;
    private initialResponseFallbackTimer: NodeJS.Timeout | null = null;
    private endCallTimer: NodeJS.Timeout | null = null;
    private readonly endCallDelayMs: number;

    constructor(ws: WebSocket, callType: CallType, twilioClient: twilio.Twilio, contextService: OpenAIContextService) {
        this.callState = new CallState(callType);
        const parsedDelayMs = Number.parseInt(process.env.END_CALL_DELAY_MS || '1500', 10);
        this.endCallDelayMs = Number.isFinite(parsedDelayMs) && parsedDelayMs >= 0 ? parsedDelayMs : 1500;

        // Initialize Twilio services
        this.twilioStream = new TwilioWsService(ws, this.callState);
        this.twilioCallService = new TwilioCallService(twilioClient);

        const parsedTemperature = Number.parseFloat(process.env.OPENAI_TEMPERATURE || '0.45');
        const temperature = Number.isFinite(parsedTemperature) ? parsedTemperature : 0.45;

        // Initialize OpenAI service
        const openAIConfig: OpenAIConfig = {
            apiKey: process.env.OPENAI_API_KEY || '',
            websocketUrl: process.env.OPENAI_WEBSOCKET_URL || 'wss://api.openai.com/v1/realtime',
            voice: VOICE,
            temperature
        };
        this.openAIService = new OpenAIWsService(openAIConfig);

        // Initialize event processors
        this.openAIEventProcessor = new OpenAIEventService(
            this.callState,
            (callId, args) => this.handleEndCallTool(callId, args),
            (payload) => this.twilioStream.sendAudio(payload),
            () => this.twilioStream.sendMark(),
            () => this.handleSpeechStartedEvent(),
            (response) => this.handleSessionUpdatedEvent(response)
        );

        this.twilioEventProcessor = new TwilioEventService(
            this.callState,
            this.twilioCallService,
            contextService,
            (payload) => this.openAIService.sendAudio(payload),
        );

        this.setupEventHandlers();
        this.initializeOpenAI();
    }

    private handleEndCallTool(callId: string | null, args: Record<string, unknown>): void {
        if (callId) {
            this.openAIService.sendFunctionCallOutput(callId, { ok: true, action: 'end_call' });
        }

        const reason = typeof args.reason === 'string' ? args.reason : '';
        if (reason) {
            console.log(`Model requested end_call: ${reason}`);
        }

        if (this.endingCall || this.endCallTimer) {
            return;
        }

        if (this.endCallDelayMs <= 0) {
            this.endCall();
            return;
        }

        this.endCallTimer = setTimeout(() => {
            this.endCallTimer = null;
            this.endCall();
        }, this.endCallDelayMs);
    }

    private endCall(): void {
        if (this.endingCall) {
            return;
        }
        this.endingCall = true;

        if (this.callState.callSid) {
            this.twilioCallService.endCall(this.callState.callSid);
        }

        setTimeout(() => {
            this.closeWebSockets();
        }, 5000);
    }

    private closeWebSockets(): void {
        if (this.initialResponseFallbackTimer) {
            clearTimeout(this.initialResponseFallbackTimer);
            this.initialResponseFallbackTimer = null;
        }
        this.twilioStream.close();
        this.openAIService.close();
    }

    private initializeSessionWhenContextReady(): void {
        if (this.sessionInitialized || this.endingCall || !this.openAIService.isConnected()) {
            return;
        }

        const context = (this.callState.callContext || '').trim();
        if (!context) {
            setTimeout(() => this.initializeSessionWhenContextReady(), 50);
            return;
        }

        this.sessionInitialized = true;
        this.openAIService.initializeSession(context);
        this.scheduleInitialResponseFallback();
    }

    private initializeOpenAI(): void {
        this.openAIService.initialize(
            (data) => this.openAIEventProcessor.processMessage(data),
            () => {
                setTimeout(() => this.initializeSessionWhenContextReady(), 100);
            },
            (error) => {
                console.error('Error in the OpenAI WebSocket:', error);
                this.endCall();
            }
        );
    }

    private handleSessionUpdatedEvent(response: any): void {
        void response;
        this.sessionReady = true;
        this.requestInitialResponseIfReady();
    }

    private requestInitialResponseIfReady(): void {
        if (this.initialResponseRequested || !this.sessionInitialized || !this.sessionReady || this.endingCall) {
            return;
        }

        this.initialResponseRequested = true;
        if (this.initialResponseFallbackTimer) {
            clearTimeout(this.initialResponseFallbackTimer);
            this.initialResponseFallbackTimer = null;
        }
        this.openAIService.requestResponse();
    }

    private scheduleInitialResponseFallback(): void {
        if (this.initialResponseFallbackTimer) {
            clearTimeout(this.initialResponseFallbackTimer);
            this.initialResponseFallbackTimer = null;
        }

        // Some sessions do not emit session.updated reliably; fallback avoids dead air.
        this.initialResponseFallbackTimer = setTimeout(() => {
            if (this.initialResponseRequested || !this.sessionInitialized || this.endingCall) {
                return;
            }
            this.initialResponseRequested = true;
            this.openAIService.requestResponse();
        }, 1200);
    }

    private handleSpeechStartedEvent(): void {
        // Only interrupt while assistant audio is still queued to play on Twilio.
        if (this.callState.markQueue.length === 0) {
            return;
        }
        if (this.callState.responseStartTimestampTwilio === null || !this.callState.lastAssistantItemId) {
            return;
        }

        const elapsedTime = this.callState.latestMediaTimestamp - this.callState.responseStartTimestampTwilio;
        const generatedAudioMs = this.openAIEventProcessor.getAssistantAudioMs(this.callState.lastAssistantItemId);
        const safeAudioEndMs = Math.max(0, Math.min(elapsedTime, generatedAudioMs));

        if (safeAudioEndMs > 0) {
            this.openAIService.truncateAssistantResponse(this.callState.lastAssistantItemId, safeAudioEndMs);
            this.twilioStream.clearStream();
            this.resetResponseState();
        }
    }

    private resetResponseState(): void {
        this.callState.markQueue = [];
        this.callState.lastAssistantItemId = null;
        this.callState.responseStartTimestampTwilio = null;
    }

    private setupEventHandlers(): void {
        this.twilioStream.setupEventHandlers(
            async (message) => await this.twilioEventProcessor.processMessage(message),
            async () => {
                this.openAIService.close();
                if (this.callState.callSid) {
                    callTracker.completeCall(this.callState.callSid, [...this.callState.conversationHistory]);
                }
            }
        );
    }
}

/**
 * Manages multiple concurrent call sessions
 */
export class CallSessionManager {
    private readonly sessionManager: SessionManagerService;

    constructor(twilioClient: twilio.Twilio) {
        this.sessionManager = new SessionManagerService(twilioClient);
    }

    /**
     * Creates a new call session
     * @param ws The WebSocket connection
     * @param callType The type of call
     */
    public createSession(ws: WebSocket, callType: CallType): void {
        this.sessionManager.createSession(ws, callType);
    }
}
