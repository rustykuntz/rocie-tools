import { generateOutboundCallContext } from '../../config/prompts.js';
import { CallState, ConversationMessage } from '../../types.js';

export class OpenAIContextService {

    public initializeCallState(callState: CallState, fromNumber: string, toNumber: string): void {
        callState.fromNumber = fromNumber;
        callState.toNumber = toNumber;
    }

    public setupConversationContext(callState: CallState, callContext?: string): void {
        callState.initialMessage = 'Hello!';
        callState.callContext = generateOutboundCallContext(callState, callContext);

        const systemMessage: ConversationMessage = {
            role: 'system',
            content: callState.callContext
        };

        callState.conversationHistory = [systemMessage];

        const initialMessage: ConversationMessage = {
            role: 'user',
            content: callState.initialMessage
        };

        callState.conversationHistory.push(initialMessage);
    }

}
