'use server';

import { and, asc, eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { revalidatePath } from 'next/cache';

import { db } from '@/database/db';
import { bookSegments, sessionTurns, turnFeedback, turnRetrievals, voiceSessions } from '@/database/schema';
import {
    buildAnswerCases,
    isJudgeable,
    type AnswerCase,
    type CaseRetrievalRow,
} from '@/lib/feedback/cases';
import { FEEDBACK_PROMPT_VERSION, evaluateAnswerCase } from '@/lib/feedback/evaluate';
import {
    buildSessionFeedbackReport,
    type SegmentRow,
    type SessionFeedbackReport,
    type StoredFeedbackRow,
} from '@/lib/feedback/report';
import { geminiJudge, JUDGE_MODEL } from '@/lib/metrics/judge';
import { requireUser } from '@/lib/session';

/**
 * Server actions behind the post-session report (docs/propuestas/02).
 *
 * Unlike `metrics.actions.ts`, these are OWNERSHIP-scoped, not researcher-scoped:
 * the report is feedback for the student about their own session, so every action
 * checks that the session belongs to the caller and nothing here reads across
 * participants.
 */

/**
 * Student answers judged per invocation. Each one costs two judge calls, so a
 * "evaluate everything" button would hit the request timeout on a long session
 * and leave the run half done with no way to tell how far it got. The action
 * reports what is left and the button can be pressed again.
 */
const FEEDBACK_BATCH_SIZE = 12;

interface SessionEvidence {
    cases: AnswerCase[];
    turns: Array<{
        id: string;
        startedAt: Date;
        endedAt: Date;
        content: string;
        studentLatencyMs: number | null;
        maxPauseMs: number | null;
    }>;
    feedback: StoredFeedbackRow[];
    segments: SegmentRow[];
}

/** Throws when the session does not exist or is not the caller's. */
async function requireOwnedSession(sessionId: string): Promise<{ id: string; userId: string }> {
    const user = await requireUser();

    const [session] = await db
        .select({ id: voiceSessions.id, userId: voiceSessions.userId })
        .from(voiceSessions)
        .where(and(eq(voiceSessions.id, sessionId), eq(voiceSessions.userId, user.id)))
        .limit(1);

    if (!session) throw new Error('Sesión no encontrada.');
    return session;
}

async function loadSessionEvidence(sessionId: string): Promise<SessionEvidence> {
    const turns = await db
        .select({
            id: sessionTurns.id,
            sessionId: sessionTurns.sessionId,
            turnIndex: sessionTurns.turnIndex,
            role: sessionTurns.role,
            content: sessionTurns.content,
            startedAt: sessionTurns.startedAt,
            endedAt: sessionTurns.endedAt,
            studentLatencyMs: sessionTurns.studentLatencyMs,
            maxPauseMs: sessionTurns.maxPauseMs,
        })
        .from(sessionTurns)
        .where(eq(sessionTurns.sessionId, sessionId))
        .orderBy(asc(sessionTurns.turnIndex));

    const retrievals: CaseRetrievalRow[] = await db
        .select({
            turnId: turnRetrievals.turnId,
            query: turnRetrievals.query,
            rank: turnRetrievals.rank,
            distance: turnRetrievals.distance,
            segmentId: turnRetrievals.segmentId,
            segmentContent: bookSegments.content,
            pageNumber: bookSegments.pageNumber,
        })
        .from(turnRetrievals)
        .innerJoin(bookSegments, eq(turnRetrievals.segmentId, bookSegments.id))
        .where(eq(turnRetrievals.sessionId, sessionId))
        .orderBy(asc(turnRetrievals.createdAt), asc(turnRetrievals.rank));

    const { cases } = buildAnswerCases(turns, retrievals);

    const turnIds = turns.map((turn) => turn.id);
    const feedback: StoredFeedbackRow[] =
        turnIds.length === 0
            ? []
            : await db
                  .select({
                      turnId: turnFeedback.turnId,
                      contentLevel: turnFeedback.contentLevel,
                      contentJustification: turnFeedback.contentJustification,
                      contentSegmentId: turnFeedback.contentSegmentId,
                      clarityLevel: turnFeedback.clarityLevel,
                      clarityJustification: turnFeedback.clarityJustification,
                  })
                  .from(turnFeedback)
                  .where(
                      and(
                          inArray(turnFeedback.turnId, turnIds),
                          eq(turnFeedback.promptVersion, FEEDBACK_PROMPT_VERSION),
                      ),
                  );

    // Every segment a verdict can cite was retrieved during this session, so the
    // retrieval rows already carry the text. No extra query needed.
    const segments = new Map<string, SegmentRow>();
    for (const row of retrievals) {
        if (!segments.has(row.segmentId)) {
            segments.set(row.segmentId, {
                id: row.segmentId,
                content: row.segmentContent,
                pageNumber: row.pageNumber,
            });
        }
    }

    return {
        cases,
        turns: turns.filter((turn) => turn.role === 'user'),
        feedback,
        segments: Array.from(segments.values()),
    };
}

export interface SessionFeedbackResult {
    success: boolean;
    data?: SessionFeedbackReport & { judgeModel: string; promptVersion: string };
    error?: string;
}

export const getSessionFeedback = async (sessionId: string): Promise<SessionFeedbackResult> => {
    try {
        await requireOwnedSession(sessionId);

        const evidence = await loadSessionEvidence(sessionId);
        const report = buildSessionFeedbackReport(evidence);

        return {
            success: true,
            data: { ...report, judgeModel: JUDGE_MODEL, promptVersion: FEEDBACK_PROMPT_VERSION },
        };
    } catch (e) {
        console.error('Error building session feedback', e);
        return { success: false, error: (e as Error).message || 'No se pudo cargar el informe.' };
    }
};

export interface EvaluateSessionFeedbackResult {
    success: boolean;
    data?: { evaluated: number; failed: number; remaining: number };
    error?: string;
}

/**
 * Runs the judge over the answers of this session that do not have a verdict yet.
 *
 * Only judgeable cases are attempted: an answer with no retrieved fragment, or
 * one that followed no question, is left without a verdict on purpose (see
 * `lib/feedback/evaluate.ts`) and is not counted as remaining work.
 */
export const evaluateSessionFeedback = async (
    sessionId: string,
): Promise<EvaluateSessionFeedbackResult> => {
    try {
        await requireOwnedSession(sessionId);

        if (!process.env.GEMINI_API_KEY) {
            return { success: false, error: 'Falta GEMINI_API_KEY: el juez no puede ejecutarse.' };
        }

        const evidence = await loadSessionEvidence(sessionId);
        const evaluatedTurnIds = new Set(evidence.feedback.map((row) => row.turnId));
        const pending = evidence.cases.filter(
            (answerCase) => isJudgeable(answerCase) && !evaluatedTurnIds.has(answerCase.answerTurnId),
        );

        const batch = pending.slice(0, FEEDBACK_BATCH_SIZE);
        let evaluated = 0;
        let failed = 0;

        // Sequential on purpose: the judge is rate-limited and the batch is small.
        for (const answerCase of batch) {
            try {
                const result = await evaluateAnswerCase(answerCase, { judge: geminiJudge });

                const values = {
                    contentLevel: result.contentLevel,
                    contentJustification: result.contentJustification,
                    contentSegmentId: result.contentSegmentId,
                    clarityLevel: result.clarityLevel,
                    clarityJustification: result.clarityJustification,
                    detail: JSON.stringify(result.detail),
                    computedAt: new Date(),
                };

                await db
                    .insert(turnFeedback)
                    .values({
                        id: nanoid(),
                        turnId: answerCase.answerTurnId,
                        promptVersion: FEEDBACK_PROMPT_VERSION,
                        ...values,
                    })
                    .onConflictDoUpdate({
                        target: [turnFeedback.turnId, turnFeedback.promptVersion],
                        set: values,
                    });

                evaluated++;
            } catch (error) {
                console.error(`Feedback failed for turn ${answerCase.answerTurnId}:`, error);
                failed++;
            }
        }

        revalidatePath(`/history/${sessionId}`);

        return {
            success: true,
            data: { evaluated, failed, remaining: pending.length - evaluated },
        };
    } catch (e) {
        console.error('Error evaluating session feedback', e);
        return { success: false, error: (e as Error).message || 'No se pudo evaluar la sesión.' };
    }
};
