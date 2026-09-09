import 'server-only';

export interface VapiCallDetails {
    status: 'available';
    callStatus: string | null;
    endedReason: string | null;
    endedMessage: string | null;
    startedAt: string | null;
    endedAt: string | null;
    cost: number | null;
    costBreakdown: {
        transport: number | null;
        stt: number | null;
        llm: number | null;
        tts: number | null;
        vapi: number | null;
        total: number | null;
        llmPromptTokens: number | null;
        llmCompletionTokens: number | null;
        llmCachedPromptTokens: number | null;
        ttsCharacters: number | null;
    };
    summary: string | null;
    successEvaluation: string | null;
    structuredData: Record<string, unknown> | null;
}

export type VapiCallLookup =
    | VapiCallDetails
    | { status: 'not-configured' | 'not-found' | 'unavailable' };

function optionalNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function optionalString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value : null;
}

function optionalRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

/**
 * Reads only non-audio call metadata. Recording URLs and call-monitoring URLs
 * are deliberately omitted from the value returned to the application.
 */
export async function getVapiCallDetails(callId: string): Promise<VapiCallLookup> {
    const privateKey = process.env.VAPI_PRIVATE_API_KEY;
    if (!privateKey) return { status: 'not-configured' };

    try {
        const response = await fetch(`https://api.vapi.ai/call/${encodeURIComponent(callId)}`, {
            headers: { Authorization: `Bearer ${privateKey}` },
            cache: 'no-store',
            signal: AbortSignal.timeout(5_000),
        });

        if (response.status === 404) return { status: 'not-found' };
        if (!response.ok) return { status: 'unavailable' };

        const call = (await response.json()) as Record<string, unknown>;
        const breakdown = optionalRecord(call.costBreakdown) ?? {};
        const analysis = optionalRecord(call.analysis) ?? {};

        return {
            status: 'available',
            callStatus: optionalString(call.status),
            endedReason: optionalString(call.endedReason),
            endedMessage: optionalString(call.endedMessage),
            startedAt: optionalString(call.startedAt),
            endedAt: optionalString(call.endedAt),
            cost: optionalNumber(call.cost),
            costBreakdown: {
                transport: optionalNumber(breakdown.transport),
                stt: optionalNumber(breakdown.stt),
                llm: optionalNumber(breakdown.llm),
                tts: optionalNumber(breakdown.tts),
                vapi: optionalNumber(breakdown.vapi),
                total: optionalNumber(breakdown.total),
                llmPromptTokens: optionalNumber(breakdown.llmPromptTokens),
                llmCompletionTokens: optionalNumber(breakdown.llmCompletionTokens),
                llmCachedPromptTokens: optionalNumber(breakdown.llmCachedPromptTokens),
                ttsCharacters: optionalNumber(breakdown.ttsCharacters),
            },
            summary: optionalString(analysis.summary),
            successEvaluation: optionalString(analysis.successEvaluation),
            structuredData: optionalRecord(analysis.structuredData),
        };
    } catch (error) {
        console.error('Unable to retrieve Vapi call metadata', error);
        return { status: 'unavailable' };
    }
}
