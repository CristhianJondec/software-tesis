'use server';

import { and, asc, eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { revalidatePath } from 'next/cache';

import { db } from '@/database/db';
import { sessionPredictions, sessionTurns, turnFeedback, voiceSessions } from '@/database/schema';
import { FEEDBACK_PROMPT_VERSION } from '@/lib/feedback/evaluate';
import {
    buildPredictionContrast,
    type PredictionContrast,
    type StoredPrediction,
} from '@/lib/prediction/contrast';
import { normalizePredictionText, parseTopicIds } from '@/lib/prediction/questions';
import type { PreparationTurnRow } from '@/lib/preparation/map';
import { isPreparationTopicId } from '@/lib/preparation/topics';
import { requireUser } from '@/lib/session';

/**
 * Server actions behind the prediction record (docs/propuestas/04).
 *
 * Ownership-scoped like `feedback.actions.ts` and `preparation.actions.ts`: a
 * prediction is what one student expected of their own session, and nothing here
 * reads across participants.
 */

/** Throws when the session does not exist or is not the caller's. */
async function requireOwnedSession(sessionId: string): Promise<{ id: string; bookId: string }> {
    const user = await requireUser();

    const [session] = await db
        .select({ id: voiceSessions.id, bookId: voiceSessions.bookId })
        .from(voiceSessions)
        .where(and(eq(voiceSessions.id, sessionId), eq(voiceSessions.userId, user.id)))
        .limit(1);

    if (!session) throw new Error('Sesión no encontrada.');
    return session;
}

/**
 * Reads the row back into the shape the pure contrast module expects.
 *
 * NOT exported: everything exported from a `'use server'` module is callable
 * from the browser, and this helper takes a session id without checking who owns
 * it. Ownership is checked by its callers.
 */
async function loadStoredPrediction(sessionId: string): Promise<StoredPrediction | null> {
    const [row] = await db
        .select()
        .from(sessionPredictions)
        .where(eq(sessionPredictions.sessionId, sessionId))
        .limit(1);

    if (!row) return null;

    return {
        expectedQuestions: row.expectedQuestions,
        expectedTopics: parseTopicIds(row.expectedTopics),
        fearedPart: row.fearedPart,
        // A tag written under a taxonomy that no longer has the topic is dropped
        // rather than shown, exactly as the preparation map drops stale coverage.
        fearedTopic: isPreparationTopicId(row.fearedTopic) ? row.fearedTopic : null,
        blankOutcome: row.blankOutcome,
        nextStrategy: row.nextStrategy,
        strategyAt: row.strategyAt,
    };
}

export interface PredictionContrastResult {
    success: boolean;
    data?: PredictionContrast;
    error?: string;
}

/**
 * The contrast the student reads after the session.
 *
 * Recomputed on every read from the transcript and the stored verdicts, never
 * cached: evaluating a pending answer has to sharpen the contrast, not leave a
 * saved sentence behind that no longer matches the evidence.
 */
export const getSessionPredictionContrast = async (
    sessionId: string,
): Promise<PredictionContrastResult> => {
    try {
        const session = await requireOwnedSession(sessionId);

        const prediction = await loadStoredPrediction(session.id);

        const turns: PreparationTurnRow[] = await db
            .select({
                id: sessionTurns.id,
                sessionId: sessionTurns.sessionId,
                turnIndex: sessionTurns.turnIndex,
                role: sessionTurns.role,
                content: sessionTurns.content,
                topic: sessionTurns.topic,
                startedAt: sessionTurns.startedAt,
            })
            .from(sessionTurns)
            .where(eq(sessionTurns.sessionId, session.id))
            .orderBy(asc(sessionTurns.turnIndex));

        const turnIds = turns.map((turn) => turn.id);

        const feedback =
            turnIds.length === 0
                ? []
                : await db
                      .select({
                          turnId: turnFeedback.turnId,
                          contentLevel: turnFeedback.contentLevel,
                          contentSegmentId: turnFeedback.contentSegmentId,
                      })
                      .from(turnFeedback)
                      .where(
                          and(
                              inArray(turnFeedback.turnId, turnIds),
                              eq(turnFeedback.promptVersion, FEEDBACK_PROMPT_VERSION),
                          ),
                      );

        return { success: true, data: buildPredictionContrast({ prediction, turns, feedback }) };
    } catch (e) {
        console.error('Error building prediction contrast', e);
        return { success: false, error: (e as Error).message || 'No se pudo cargar el contraste.' };
    }
};

export interface SaveStrategyResult {
    success: boolean;
    error?: string;
}

/**
 * Stores what the student says they will try differently next time.
 *
 * Write-once, like the post-session self-report: the sentence written when the
 * simulation ended is the measurement, and the next session shows it back
 * unedited. A student who skips it simply gets no reminder.
 */
export const saveNextStrategy = async (
    sessionId: string,
    value: string,
): Promise<SaveStrategyResult> => {
    try {
        const session = await requireOwnedSession(sessionId);

        const strategy = normalizePredictionText(value);
        if (strategy === null) {
            return { success: false, error: 'Escribe algo antes de guardar.' };
        }

        const existing = await loadStoredPrediction(session.id);
        if (existing?.nextStrategy) {
            return { success: false, error: 'Esta sesión ya tiene registrada su estrategia.' };
        }

        const now = new Date();

        // The row may not exist: the pre-session form is optional, and a student
        // who skipped it can still declare a strategy at the end.
        await db
            .insert(sessionPredictions)
            .values({
                id: nanoid(),
                sessionId: session.id,
                nextStrategy: strategy,
                strategyAt: now,
            })
            .onConflictDoUpdate({
                target: sessionPredictions.sessionId,
                set: { nextStrategy: strategy, strategyAt: now, updatedAt: now },
            });

        revalidatePath(`/history/${session.id}`);

        return { success: true };
    } catch (e) {
        console.error('Error saving next-session strategy', e);
        return { success: false, error: 'No se pudo guardar tu respuesta.' };
    }
};
