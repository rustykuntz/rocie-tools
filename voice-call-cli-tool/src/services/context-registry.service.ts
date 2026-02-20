import { randomUUID } from 'crypto';

const callContexts = new Map<string, string>();
const CONTEXT_TTL_MS = 30 * 60 * 1000;

export function storeCallContext(callContext: string): string {
    const contextId = randomUUID();
    callContexts.set(contextId, callContext);

    const timer = setTimeout(() => {
        callContexts.delete(contextId);
    }, CONTEXT_TTL_MS);
    timer.unref?.();

    return contextId;
}

export function takeCallContext(contextId?: string): string {
    if (!contextId) {
        return '';
    }

    const callContext = callContexts.get(contextId) || '';
    callContexts.delete(contextId);
    return callContext;
}
