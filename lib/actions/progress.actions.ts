'use server';

import { and, asc, eq, inArray, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { db } from '@/database/db';
import {
    books,
    sessionClosings,
    sessionTurns,
    turnFeedback,
    voiceSessions,
} from '@/database/schema';
import { FEEDBACK_PROMPT_VERSION } from '@/lib/feedback/evaluate';
import { parseFocusTopics } from '@/lib/preparation/focus';
import { buildSessionClosing } from '@/lib/progress/closing';
import {
    buildProgressEvidence,
    EVIDENCE_GENERATOR_VERSION,
    type ProgressEvidence,
    type ProgressEvidenceResult,
} from '@/lib/progress/evidence';
import { buildProgressSeries, type ProgressSeriesSet } from '@/lib/progress/series';
import {
    summarizeProgressSessions,
    type ProgressFeedbackRow,
    type ProgressSessionRow,
    type ProgressSessionSummary,
    type ProgressTurnRow,
} from '@/lib/progress/summary';
import { requireUser } from '@/lib/session';

/**
 * Server actions behind the progress evidence and the `/progreso` view
 * (docs/propuestas/05).
 *
 * Ownership-scoped like `feedback.actions.ts`, `preparation.actions.ts` and
 * `prediction.actions.ts`: this is one student's own longitudinal record and
 * nothing here reads across participants. The researcher-facing aggregates live
 * in `lib/metrics/`.
 */

/** Throws when the session does not exist or is not the caller's. */
async function requireOwnedSession(sessionId: string) {
    const user = await requireUser();

    const [session] = await db
        .select({
            id: voiceSessions.id,
            bookId: voiceSessions.bookId,
            startedAt: voiceSessions.startedAt,
        })
        .from(voiceSessions)
        .where(and(eq(voiceSessions.id, sessionId), eq(voiceSessions.userId, user.id)))
        .limit(1);

    if (!session) throw new Error('Sesión no encontrada.');
    return { user, session };
}

/**
 * Every session of one student on one document, reduced and ordered oldest
 * first.
 *
 * NOT exported: everything exported from a `'use server'` module is callable
 * from the browser, and this takes a user id without checking who is asking.
 *
 * `until` caps the history at a session's own start, so the evidence of an old
 * session is not computed against sessions that came after it.
 */
async function loadProgressHistory(
    userId: string,
    bookId: string,
    until?: Date,
): Promise<ProgressSessionSummary[]> {
    const sessionRows = await db
        .select({
            id: voiceSessions.id,
            startedAt: voiceSessions.startedAt,
            difficultyLevel: voiceSessions.difficultyLevel,
            preSessionAnxiety: voiceSessions.preSessionAnxiety,
            postSessionAnxiety: voiceSessions.postSessionAnxiety,
            focusTopics: voiceSessions.focusTopics,
        })
        .from(voiceSessions)
        .where(
            until
                ? and(
                      eq(voiceSessions.userId, userId),
                      eq(voiceSessions.bookId, bookId),
                      lte(voiceSessions.startedAt, until),
                  )
                : and(eq(voiceSessions.userId, userId), eq(voiceSessions.bookId, bookId)),
        )
        .orderBy(asc(voiceSessions.startedAt));

    const sessions: ProgressSessionRow[] = sessionRows.map((row) => ({
        id: row.id,
        startedAt: row.startedAt,
        difficultyLevel: row.difficultyLevel,
        preSessionAnxiety: row.preSessionAnxiety,
        postSessionAnxiety: row.postSessionAnxiety,
        focusTopics: parseFocusTopics(row.focusTopics),
    }));

    const sessionIds = sessions.map((session) => session.id);
    if (sessionIds.length === 0) return [];

    const turns: ProgressTurnRow[] = await db
        .select({
            id: sessionTurns.id,
            sessionId: sessionTurns.sessionId,
            turnIndex: sessionTurns.turnIndex,
            role: sessionTurns.role,
            content: sessionTurns.content,
            topic: sessionTurns.topic,
            startedAt: sessionTurns.startedAt,
            studentLatencyMs: sessionTurns.studentLatencyMs,
        })
        .from(sessionTurns)
        .where(inArray(sessionTurns.sessionId, sessionIds))
        .orderBy(asc(sessionTurns.turnIndex));

    const turnIds = turns.map((turn) => turn.id);

    const feedback: ProgressFeedbackRow[] =
        turnIds.length === 0
            ? []
            : await db
                  .select({
                      turnId: turnFeedback.turnId,
                      contentLevel: turnFeedback.contentLevel,
                      contentSegmentId: turnFeedback.contentSegmentId,
                      clarityLevel: turnFeedback.clarityLevel,
                  })
                  .from(turnFeedback)
                  .where(
                      and(
                          inArray(turnFeedback.turnId, turnIds),
                          eq(turnFeedback.promptVersion, FEEDBACK_PROMPT_VERSION),
                      ),
                  );

    return summarizeProgressSessions(sessions, turns, feedback);
}

/** Splits the history into the session asked about and everything before it. */
function splitHistory(history: ProgressSessionSummary[], sessionId: string) {
    const position = history.findIndex((summary) => summary.sessionId === sessionId);
    if (position < 0) return null;
    return { current: history[position], earlier: history.slice(0, position) };
}

// ---------------------------------------------------------------------------
// The evidence panel of one session
// ---------------------------------------------------------------------------

/** The closing that was actually spoken, read back from `session_closings`. */
export interface SpokenClosing {
    spokenText: string;
    evidence: ProgressEvidence[];
    spokenAt: string;
    generatorVersion: string;
}

export interface SessionEvidenceData extends ProgressEvidenceResult {
    sessionId: string;
    /** 1-based position of this session in the student's history with the document. */
    sessionNumber: number;
    /** Answers with no verdict yet: the list sharpens once they are evaluated. */
    unevaluatedAnswers: number;
    /** What the agent said out loud when the call ended. Null when nothing was said. */
    closing: SpokenClosing | null;
}

export interface SessionEvidenceResult {
    success: boolean;
    data?: SessionEvidenceData;
    error?: string;
}

/**
 * The achievements of one session, recomputed on every read.
 *
 * Never cached: evaluating a pending answer has to sharpen the list, not leave a
 * saved sentence behind that no longer matches the evidence. The one thing that
 * IS stored is the spoken closing, because that is an event and not a summary.
 */
export const getSessionEvidence = async (sessionId: string): Promise<SessionEvidenceResult> => {
    try {
        const { user, session } = await requireOwnedSession(sessionId);

        const history = await loadProgressHistory(user.id, session.bookId, session.startedAt);
        const split = splitHistory(history, session.id);

        if (!split) {
            return {
                success: false,
                error: 'Esta sesión no registró turnos, así que no hay evidencias que mostrar.',
            };
        }

        const [storedClosing] = await db
            .select()
            .from(sessionClosings)
            .where(eq(sessionClosings.sessionId, session.id))
            .limit(1);

        return {
            success: true,
            data: {
                ...buildProgressEvidence(split),
                sessionId: session.id,
                sessionNumber: history.length,
                unevaluatedAnswers: split.current.unevaluatedAnswers,
                closing: storedClosing
                    ? {
                          spokenText: storedClosing.spokenText,
                          evidence: parseStoredEvidence(storedClosing.evidence),
                          spokenAt: storedClosing.spokenAt.toISOString(),
                          generatorVersion: storedClosing.generatorVersion,
                      }
                    : null,
            },
        };
    } catch (e) {
        console.error('Error building session evidence', e);
        return { success: false, error: (e as Error).message || 'No se pudieron cargar las evidencias.' };
    }
};

/** A corrupt column reads as "no evidence recorded", never as a crash. */
function parseStoredEvidence(value: string): ProgressEvidence[] {
    try {
        const parsed: unknown = JSON.parse(value);
        return Array.isArray(parsed) ? (parsed as ProgressEvidence[]) : [];
    } catch {
        return [];
    }
}

// ---------------------------------------------------------------------------
// The spoken closing
// ---------------------------------------------------------------------------

export interface SessionClosingResult {
    success: boolean;
    data?: { spokenText: string; evidenceCount: number };
    error?: string;
}

/**
 * Composes the sentence the agent speaks before hanging up, and records it.
 *
 * Called from the browser while the call is STILL UP, which is what makes the
 * closing possible at all — and also what limits it: the last student answer may
 * not have been persisted yet, and the judge of the post-session report has not
 * run. The closing therefore carries the achievements measurable at that second,
 * and the screen shows the fuller list afterwards. Both are stored, so the
 * difference between them is auditable rather than hidden.
 *
 * Idempotent: a session closes once, and a second call returns what was already
 * said instead of composing a different goodbye.
 */
export const recordSessionClosing = async (sessionId: string): Promise<SessionClosingResult> => {
    try {
        const { user, session } = await requireOwnedSession(sessionId);

        const [existing] = await db
            .select({
                spokenText: sessionClosings.spokenText,
                evidenceCount: sessionClosings.evidenceCount,
            })
            .from(sessionClosings)
            .where(eq(sessionClosings.sessionId, session.id))
            .limit(1);

        if (existing) {
            return {
                success: true,
                data: { spokenText: existing.spokenText, evidenceCount: existing.evidenceCount },
            };
        }

        const history = await loadProgressHistory(user.id, session.bookId, session.startedAt);
        const split = splitHistory(history, session.id);

        // No turn of this session has reached the database: there is nothing to
        // read out and nothing to record. The caller hangs up as it always did.
        if (!split) return { success: true, data: { spokenText: '', evidenceCount: 0 } };

        const result = buildProgressEvidence(split);
        const closing = buildSessionClosing(result);

        await db
            .insert(sessionClosings)
            .values({
                id: nanoid(),
                sessionId: session.id,
                spokenText: closing.spokenText,
                evidence: JSON.stringify(closing.spoken),
                evidenceCount: closing.spoken.length,
                generatorVersion: EVIDENCE_GENERATOR_VERSION,
                spokenAt: new Date(),
            })
            .onConflictDoNothing({ target: sessionClosings.sessionId });

        return {
            success: true,
            data: { spokenText: closing.spokenText, evidenceCount: closing.spoken.length },
        };
    } catch (e) {
        console.error('Error recording session closing', e);
        return { success: false, error: (e as Error).message || 'No se pudo preparar el cierre.' };
    }
};

// ---------------------------------------------------------------------------
// The /progreso view
// ---------------------------------------------------------------------------

export interface ProgressOverviewData {
    book: { id: string; title: string; slug: string };
    series: ProgressSeriesSet;
    /** Evidence of the most recent session, or null when there is none yet. */
    latest: (ProgressEvidenceResult & { sessionId: string; sessionNumber: number }) | null;
    /** Sessions with at least one turn. Sessions that never connected are not here. */
    sessionCount: number;
    /** Answers still waiting for the judge across the whole history. */
    unevaluatedAnswers: number;
}

export interface ProgressOverviewResult {
    success: boolean;
    data?: ProgressOverviewData;
    error?: string;
}

export const getProgressOverview = async (bookId: string): Promise<ProgressOverviewResult> => {
    try {
        const user = await requireUser();

        const [book] = await db
            .select({ id: books.id, title: books.title, slug: books.slug })
            .from(books)
            .where(and(eq(books.id, bookId), eq(books.userId, user.id)))
            .limit(1);

        if (!book) throw new Error('Investigación no encontrada.');

        const history = await loadProgressHistory(user.id, book.id);
        const current = history.at(-1) ?? null;

        return {
            success: true,
            data: {
                book,
                series: buildProgressSeries(history),
                latest: current
                    ? {
                          ...buildProgressEvidence({
                              current,
                              earlier: history.slice(0, -1),
                          }),
                          sessionId: current.sessionId,
                          sessionNumber: history.length,
                      }
                    : null,
                sessionCount: history.length,
                unevaluatedAnswers: history.reduce(
                    (total, summary) => total + summary.unevaluatedAnswers,
                    0,
                ),
            },
        };
    } catch (e) {
        console.error('Error building progress overview', e);
        return { success: false, error: (e as Error).message || 'No se pudo cargar tu progreso.' };
    }
};
