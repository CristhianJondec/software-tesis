import { desc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { db } from '@/database/db';
import { sessionTurns, turnRetrievals } from '@/database/schema';

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
