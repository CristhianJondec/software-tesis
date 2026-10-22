import { desc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { db } from '@/database/db';
import { sessionTurns, turnRetrievals, voiceSessions } from '@/database/schema';

export interface SearchCallContext {
    sessionId: string;
    /** The book the session was started on: the only document it may search. */
    bookId: string;
}

/**
 * Resolves which voice session a `searchBook` tool call belongs to, using
 * identifiers the LLM did not have to copy by hand.
 *
 * The model is told to pass `bookId` and `sessionId` literally, but both are
 * 21-character random ids: one mistyped character would search the wrong (or no)
 * document — making the agent claim a topic is missing from the thesis — and
 * would drop the retrieval from the RAGAs evidence. So candidates are tried in
 * order of trust, and the first one that matches a stored session wins:
 *
 *  1. the Vapi call id, linked to the session by `linkVapiCall`;
 *  2. the `sessionId` variable the client sent in `variableValues`;
 *  3. the `sessionId` argument the LLM wrote in the tool call.
 *
 * The `bookId` always comes from the session row, never from the tool call.
 * Returns null when none of them matches; the caller then falls back to the
 * LLM's own arguments.
 */
export const resolveSearchCallContext = async (candidates: {
    vapiCallId: string | null;
    sessionIds: ReadonlyArray<string | null>;
}): Promise<SearchCallContext | null> => {
    try {
        if (candidates.vapiCallId) {
            const [byCall] = await db
                .select({ sessionId: voiceSessions.id, bookId: voiceSessions.bookId })
                .from(voiceSessions)
                .where(eq(voiceSessions.vapiCallId, candidates.vapiCallId))
                .limit(1);
            if (byCall) return byCall;
        }

        for (const sessionId of candidates.sessionIds) {
            if (!sessionId) continue;
            const [bySession] = await db
                .select({ sessionId: voiceSessions.id, bookId: voiceSessions.bookId })
                .from(voiceSessions)
                .where(eq(voiceSessions.id, sessionId))
                .limit(1);
            if (bySession) return bySession;
        }
    } catch (error) {
        // A lookup failure must not break the conversation: fall back to the args.
        console.error('Failed to resolve the session of a searchBook call:', error);
    }

    return null;
};

export interface RetrievedSegment {
    segmentId: string;
    distance: number;
}

/**
 * Records what the retriever returned for a voice session, so retrieval quality
 * (RAGAs, grounding) can be audited later.
 *
 * Server-only helper for the Vapi webhook — deliberately NOT a server action:
 * the webhook has no user session, so this must not be reachable from a browser.
 * Rows are attached to the most recent turn of the session; if that turn has not
 * been written yet, `turnId` stays null and `sessionId` keeps the trace usable.
 */
export const recordTurnRetrievals = async (
    sessionId: string,
    query: string,
    segments: RetrievedSegment[],
): Promise<void> => {
    if (!sessionId || !query || segments.length === 0) return;

    try {
        const [lastTurn] = await db
            .select({ id: sessionTurns.id })
            .from(sessionTurns)
            .where(eq(sessionTurns.sessionId, sessionId))
            .orderBy(desc(sessionTurns.turnIndex))
            .limit(1);

        await db.insert(turnRetrievals).values(
            segments.map((segment, index) => ({
                id: nanoid(),
                turnId: lastTurn?.id ?? null,
                sessionId,
                segmentId: segment.segmentId,
                query,
                rank: index + 1,
                distance: segment.distance,
            })),
        );
    } catch (error) {
        // Never let bookkeeping break the voice conversation.
        console.error('Failed to record turn retrievals:', error);
    }
};
