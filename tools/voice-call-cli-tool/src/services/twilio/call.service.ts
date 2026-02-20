import twilio from 'twilio';
import { DYNAMIC_API_SECRET, RECORD_CALLS } from '../../config/constants.js';
import { storeCallContext } from '../context-registry.service.js';

/**
 * Service for handling Twilio call operations
 */
export class TwilioCallService {
    private readonly twilioClient: twilio.Twilio;

    /**
     * Create a new Twilio call service
     * @param twilioClient The Twilio client
     */
    constructor(twilioClient: twilio.Twilio) {
        this.twilioClient = twilioClient;
    }

    /**
     * Start recording a call
     * @param callSid The SID of the call to record
     */
    public async startRecording(callSid: string): Promise<void> {
        if (!RECORD_CALLS || !callSid) {
            return;
        }

        try {
            await this.twilioClient.calls(callSid)
                .recordings
                .create();
        } catch (error) {
            console.error(`Failed to start recording for call ${callSid}:`, error);
        }
    }

    /**
     * End a call
     * @param callSid The SID of the call to end
     */
    public async endCall(callSid: string): Promise<void> {
        if (!callSid) {
            return;
        }

        try {
            await this.twilioClient.calls(callSid)
                .update({ status: 'completed' });
        } catch (error) {
            console.error(`Failed to end call ${callSid}:`, error);
        }
    }


    public async makeCall(twilioCallbackUrl: string, toNumber: string, callContext = ''): Promise<string> {
        try {
            const contextId = storeCallContext(callContext);
            const call = await this.twilioClient.calls.create({
                to: toNumber,
                from: process.env.TWILIO_NUMBER || '',
                url: `${twilioCallbackUrl}/call/outgoing?apiSecret=${DYNAMIC_API_SECRET}&callType=outgoing&contextId=${encodeURIComponent(contextId)}`,
            });

            return call.sid;
        } catch (error) {
            console.error(`Error making call: ${error}`);
            throw error;
        }
    }
}
