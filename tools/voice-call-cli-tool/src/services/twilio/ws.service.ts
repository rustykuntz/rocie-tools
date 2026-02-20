import { WebSocket } from 'ws';
import { CallState } from '../../types.js';

/**
 * Service for handling Twilio WebSocket streams
 */
export class TwilioWsService {
    private readonly webSocket: WebSocket;
    private readonly callState: CallState;

    /**
     * Create a new Twilio stream service
     * @param webSocket The Twilio WebSocket connection
     * @param callState The state of the call
     */
    constructor(webSocket: WebSocket, callState: CallState) {
        this.webSocket = webSocket;
        this.callState = callState;
    }

    /**
     * Close the WebSocket connection
     */
    public close(): void {
        if (this.webSocket.readyState === WebSocket.OPEN) {
            this.webSocket.close();
        }
    }

    /**
     * Send a mark event to Twilio
     */
    public sendMark(): void {
        if (!this.callState.streamSid) {
            return;
        }

        const markEvent = {
            event: 'mark',
            streamSid: this.callState.streamSid,
            mark: { name: 'responsePart' }
        };
        this.webSocket.send(JSON.stringify(markEvent));
        this.callState.markQueue.push('responsePart');
    }

    /**
     * Send audio data to Twilio
     * @param payload The audio payload to send
     */
    public sendAudio(payload: string): void {
        if (!this.callState.streamSid) {
            return;
        }

        const audioDelta = {
            event: 'media',
            streamSid: this.callState.streamSid,
            media: { payload }
        };
        this.webSocket.send(JSON.stringify(audioDelta));
    }

    /**
     * Clear the Twilio stream
     */
    public clearStream(): void {
        if (!this.callState.streamSid) {
            return;
        }

        this.webSocket.send(JSON.stringify({
            event: 'clear',
            streamSid: this.callState.streamSid
        }));
    }

    /**
     * Set up event handlers for the Twilio WebSocket
     * @param onMessage Callback for handling messages from Twilio
     * @param onClose Callback for when the connection is closed
     */
    public setupEventHandlers(
        onMessage: (message: Buffer | string) => void,
        onClose: () => void
    ): void {
        this.webSocket.on('message', onMessage);
        this.webSocket.on('close', onClose);
    }
}
