'use server';

import { and, asc, count, desc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { db } from '@/database/db';
import {
    bookSegments,
    books,
    ragasEvaluations,
    sessionPredictions,
    sessionTurns,
    turnEvaluations,
    turnRetrievals,
    voiceSessions,
} from '@/database/schema';
import { requireUser } from '@/lib/session';
import { requireInterventionAccess } from '@/lib/study/access';
import { MAX_SESSION_DURATION_MINUTES } from '@/lib/constants';
import {
    normalizeAnxietyScore,
    suggestDifficultyLevel,
    type PreviousSessionSummary,
} from '@/lib/difficulty/adaptation';
import {
    getDifficultyLevel,
    isDifficultyLevelId,
    type DifficultyLevelId,
} from '@/lib/difficulty/levels';
import { summarizeSessionSignals } from '@/lib/difficulty/signals';
import { classifyQuestionTopicId } from '@/lib/preparation/classify';
import { normalizeFocusTopics, serializeFocusTopics } from '@/lib/preparation/focus';
import {
    isEmptyPrediction,
    normalizePrediction,
    serializeTopicIds,
} from '@/lib/prediction/questions';
import { getCurrentBillingPeriodStart } from '@/lib/subscription-constants';
import { getVapiCallDetails } from '@/lib/vapi.server';
import type {
    EndSessionResult,
    LinkVapiCallResult,
    SaveAnxietyResult,
    SaveTurnInput,
    SaveTurnResult,
    SessionPreparationResult,
    StartSessionInput,
    StartSessionResult,
    UpdateTurnInput,
} from '@/types';

/**
 * Loads the summary of the student's last finished session with this document,
 * which is the only history the adaptation rule reads.
 *
 * Sessions without a single turn are skipped: a call that never connected is not
 * a practice session and must not freeze the student's progression. A call where
 * only the agent spoke IS kept — a student who never answered is evidence.
 */
const loadPreviousSessionSummary = async (
    userId: string,
    bookId: string,
): Promise<{
    summary: PreviousSessionSummary;
    startedAt: Date;
    previousStrategy: string | null;
} | null> => {
    const [previous] = await db
        .select({
            id: voiceSessions.id,
            difficultyLevel: voiceSessions.difficultyLevel,
            postSessionAnxiety: voiceSessions.postSessionAnxiety,
            startedAt: voiceSessions.startedAt,
        })
        .from(voiceSessions)
        .innerJoin(sessionTurns, eq(sessionTurns.sessionId, voiceSessions.id))
        .where(and(eq(voiceSessions.userId, userId), eq(voiceSessions.bookId, bookId)))
        .groupBy(
            voiceSessions.id,
            voiceSessions.difficultyLevel,
            voiceSessions.postSessionAnxiety,
            voiceSessions.startedAt,
        )
        .orderBy(desc(voiceSessions.startedAt))
        .limit(1);

    if (!previous) return null;

    const turns = await db
        .select({
            role: sessionTurns.role,
            content: sessionTurns.content,
            studentLatencyMs: sessionTurns.studentLatencyMs,
        })
        .from(sessionTurns)
        .where(eq(sessionTurns.sessionId, previous.id));

    // What the student said they would try differently at the end of that
    // session (docs/propuestas/04). Shown back before this one starts, which is
    // the only moment it can still change what they do.
    const [prediction] = await db
        .select({
            nextStrategy: sessionPredictions.nextStrategy,
            strategyAt: sessionPredictions.strategyAt,
        })
        .from(sessionPredictions)
        .where(eq(sessionPredictions.sessionId, previous.id))
        .limit(1);

    return {
        startedAt: previous.startedAt,
        previousStrategy: prediction?.nextStrategy ?? null,
        summary: {
            level: getDifficultyLevel(previous.difficultyLevel).id,
            signals: summarizeSessionSignals(turns),
            postSessionAnxiety: normalizeAnxietyScore(previous.postSessionAnxiety),
        },
    };
};

/**
 * Everything the pre-session screen needs to suggest a difficulty level.
 *
 * The suggestion itself is NOT computed here: `suggestDifficultyLevel` is a pure
 * function, so the client runs it as the student moves the 0-10 slider and sees
 * the justification update live. The server recomputes it on `startVoiceSession`
 * and stores its own verdict, so a tampered client cannot forge `levelSource`.
 */
export const getSessionPreparation = async (bookId: string): Promise<SessionPreparationResult> => {
    try {
        const user = await requireUser();

        const ownerCheck = await db
            .select({ id: books.id })
            .from(books)
            .where(and(eq(books.id, bookId), eq(books.userId, user.id)))
            .limit(1);

        if (ownerCheck.length === 0) {
            return { success: false, error: 'Investigación no encontrada.' };
        }

        const previous = await loadPreviousSessionSummary(user.id, bookId);

        return {
            success: true,
            data: {
                previous: previous?.summary ?? null,
                previousStartedAt: previous?.startedAt.toISOString() ?? null,
                previousStrategy: previous?.previousStrategy ?? null,
            },
        };
    } catch (e) {
        console.error('Error loading session preparation', e);
        return { success: false, error: 'No se pudo preparar la sesión.' };
    }
};

export const startVoiceSession = async (
    bookId: string,
    input: StartSessionInput = {},
): Promise<StartSessionResult> => {
    try {
        await requireInterventionAccess();
        const user = await requireUser();
        const userId = user.id;

        const ownerCheck = await db
            .select({ id: books.id })
            .from(books)
            .where(and(eq(books.id, bookId), eq(books.userId, userId)))
            .limit(1);

        if (ownerCheck.length === 0) {
            return { success: false, error: 'Book not found or unauthorized' };
        }

        const preSessionAnxiety = normalizeAnxietyScore(input.preSessionAnxiety);

        // The rule is re-run server-side over the stored history: `levelSource`
        // has to say what actually happened, not what the browser claimed.
        const previous = await loadPreviousSessionSummary(userId, bookId);
        const suggestion = suggestDifficultyLevel({
            preSessionAnxiety,
            previous: previous?.summary ?? null,
        });

        const difficultyLevel: DifficultyLevelId = isDifficultyLevelId(input.difficultyLevel)
            ? input.difficultyLevel
            : suggestion.level;
        const levelSource = difficultyLevel === suggestion.level ? 'auto' : 'manual';

        // Narrowed server-side: the client may ask for any topic list, but only
        // ids of the taxonomy reach the prompt and the stored row.
        const focusTopics = normalizeFocusTopics(input.focusTopics);

        const billingPeriodStart = getCurrentBillingPeriodStart();

        const [session] = await db
            .insert(voiceSessions)
            .values({
                id: nanoid(),
                userId,
                bookId,
                startedAt: new Date(),
                billingPeriodStart,
                durationSeconds: 0,
                difficultyLevel,
                levelSource,
                preSessionAnxiety,
                focusTopics: serializeFocusTopics(focusTopics),
            })
            .returning();

        // The three written predictions (docs/propuestas/04), tagged against the
        // taxonomy by the same lexical classifier the preparation map uses.
        // Written here, before the call connects, so the "antes" is fixed while
        // the session produces the "después".
        //
        // Best effort on purpose: the form is optional and a failure to store it
        // must never stop a student from practising. It is logged instead.
        const prediction = normalizePrediction(input.prediction);
        if (!isEmptyPrediction(prediction)) {
            try {
                await db.insert(sessionPredictions).values({
                    id: nanoid(),
                    sessionId: session.id,
                    expectedQuestions: prediction.expectedQuestions,
                    expectedTopics: serializeTopicIds(prediction.expectedTopics),
                    fearedPart: prediction.fearedPart,
                    fearedTopic: prediction.fearedTopic,
                    blankOutcome: prediction.blankOutcome,
                });
            } catch (predictionError) {
                console.error('Error saving session prediction', predictionError);
            }
        }

        return {
            success: true,
            sessionId: session.id,
            maxDurationMinutes: MAX_SESSION_DURATION_MINUTES,
            difficultyLevel,
            levelSource,
            focusTopics,
        };
    } catch (e) {
        console.error('Error starting voice session', e);
        return { success: false, error: 'Failed to start voice session. Please try again later.' };
    }
};

/**
 * Stores the 0-10 self-report taken right after the session closes.
 *
 * Write-once on purpose: the number the student gave when the simulation ended
 * is the measurement, and a later edit would be a different measurement.
 */
export const savePostSessionAnxiety = async (
    sessionId: string,
    value: number,
): Promise<SaveAnxietyResult> => {
    try {
        const user = await requireUser();

        const score = normalizeAnxietyScore(value);
        if (score === null) {
            return { success: false, error: 'La respuesta debe estar entre 0 y 10.' };
        }

        const [session] = await db
            .select({ id: voiceSessions.id, postSessionAnxiety: voiceSessions.postSessionAnxiety })
            .from(voiceSessions)
            .where(and(eq(voiceSessions.id, sessionId), eq(voiceSessions.userId, user.id)))
            .limit(1);

        if (!session) {
            return { success: false, error: 'Sesión no encontrada.' };
        }
        if (session.postSessionAnxiety !== null) {
            return { success: false, error: 'Esta sesión ya tiene registrada su medición final.' };
        }

        await db
            .update(voiceSessions)
            .set({ postSessionAnxiety: score, updatedAt: new Date() })
            .where(eq(voiceSessions.id, sessionId));

        return { success: true };
    } catch (e) {
        console.error('Error saving post-session anxiety', e);
        return { success: false, error: 'No se pudo guardar tu respuesta.' };
    }
};

export const endVoiceSession = async (
    sessionId: string,
    durationSeconds: number,
): Promise<EndSessionResult> => {
    try {
        const user = await requireUser();
        const result = await db
            .update(voiceSessions)
            .set({ endedAt: new Date(), durationSeconds, updatedAt: new Date() })
            .where(and(eq(voiceSessions.id, sessionId), eq(voiceSessions.userId, user.id)))
            .returning({ id: voiceSessions.id });

        if (result.length === 0) {
            return { success: false, error: 'Voice session not found.' };
        }

        return { success: true };
    } catch (e) {
        console.error('Error ending voice session', e);
        return { success: false, error: 'Failed to end voice session. Please try again later.' };
    }
};

export const linkVapiCall = async (
    sessionId: string,
    vapiCallId: string,
): Promise<LinkVapiCallResult> => {
    try {
        const user = await requireUser();
        const normalizedCallId = vapiCallId.trim();

        if (!sessionId || !normalizedCallId) {
            return { success: false, error: 'Missing session or Vapi call identifier.' };
        }

        const result = await db
            .update(voiceSessions)
            .set({ vapiCallId: normalizedCallId, updatedAt: new Date() })
            .where(and(eq(voiceSessions.id, sessionId), eq(voiceSessions.userId, user.id)))
            .returning({ id: voiceSessions.id });

        if (result.length === 0) {
            return { success: false, error: 'Voice session not found.' };
        }

        return { success: true };
    } catch (e) {
        console.error('Error linking Vapi call', e);
        return { success: false, error: 'Failed to link the Vapi call.' };
    }
};

/**
 * Persists a single conversation turn as soon as it closes, so a tab close or a
 * dropped connection cannot take the evidence with it. Callers fire and forget:
 * a failure here must never interrupt the live conversation.
 */
export const saveSessionTurn = async (input: SaveTurnInput): Promise<SaveTurnResult> => {
    try {
        const user = await requireUser();

        const content = input.content?.trim();
        if (!input.sessionId || !content) {
            return { success: false, error: 'Missing sessionId or content' };
        }
        if (input.role !== 'assistant' && input.role !== 'user') {
            return { success: false, error: 'Invalid role' };
        }

        const ownerCheck = await db
            .select({ id: voiceSessions.id })
            .from(voiceSessions)
            .where(and(eq(voiceSessions.id, input.sessionId), eq(voiceSessions.userId, user.id)))
            .limit(1);

        if (ownerCheck.length === 0) {
            return { success: false, error: 'Voice session not found or unauthorized' };
        }

        const endedAt = new Date(input.endedAt);
        const startedAt = new Date(input.startedAt ?? input.endedAt);

        const [turn] = await db
            .insert(sessionTurns)
            .values({
                id: nanoid(),
                sessionId: input.sessionId,
                turnIndex: input.turnIndex,
                role: input.role,
                content,
                startedAt,
                endedAt,
                studentLatencyMs: input.role === 'user' ? (input.studentLatencyMs ?? null) : null,
                systemLatencyMs: input.role === 'assistant' ? (input.systemLatencyMs ?? null) : null,
                maxPauseMs: input.role === 'user' ? (input.maxPauseMs ?? null) : null,
                // Only agent turns carry a topic: the preparation map counts what
                // was ASKED about, and a student answer inherits the topic of the
                // question it follows (lib/preparation/map.ts).
                topic: input.role === 'assistant' ? classifyQuestionTopicId(content) : null,
            })
            .returning({ id: sessionTurns.id });

        return { success: true, turnId: turn.id };
    } catch (e) {
        console.error('Error saving session turn', e);
        return { success: false, error: 'Failed to save session turn.' };
    }
};

/**
 * Extends the most recent logical turn when Vapi emits one utterance as several
 * final transcript chunks. Ownership is checked through the parent session.
 */
export const updateSessionTurn = async (input: UpdateTurnInput): Promise<SaveTurnResult> => {
    try {
        const user = await requireUser();
        const content = input.content?.trim();
        if (!input.turnId || !content) {
            return { success: false, error: 'Missing turnId or content' };
        }

        const [ownedTurn] = await db
            .select({ id: sessionTurns.id, role: sessionTurns.role })
            .from(sessionTurns)
            .innerJoin(voiceSessions, eq(voiceSessions.id, sessionTurns.sessionId))
            .where(and(eq(sessionTurns.id, input.turnId), eq(voiceSessions.userId, user.id)))
            .limit(1);

        if (!ownedTurn) {
            return { success: false, error: 'Session turn not found or unauthorized' };
        }

        const [turn] = await db
            .update(sessionTurns)
            .set({
                content,
                endedAt: new Date(input.endedAt),
                maxPauseMs:
                    ownedTurn.role === 'user' ? (input.maxPauseMs ?? null) : null,
                topic:
                    ownedTurn.role === 'assistant' ? classifyQuestionTopicId(content) : null,
            })
            .where(eq(sessionTurns.id, input.turnId))
            .returning({ id: sessionTurns.id });

        return turn
            ? { success: true, turnId: turn.id }
            : { success: false, error: 'Session turn not found' };
    } catch (e) {
        console.error('Error updating session turn', e);
        return { success: false, error: 'Failed to update session turn.' };
    }
};

export const getConversationHistory = async (bookId?: string) => {
    try {
        const user = await requireUser();

        let scopedBook: { id: string; title: string; author: string; slug: string } | null = null;

        if (bookId) {
            const [book] = await db
                .select({
                    id: books.id,
                    title: books.title,
                    author: books.author,
                    slug: books.slug,
                })
                .from(books)
                .where(and(eq(books.id, bookId), eq(books.userId, user.id)))
                .limit(1);

            if (!book) {
                return { success: false, error: 'Investigación no encontrada.' };
            }

            scopedBook = book;
        }

        const historyFilter = bookId
            ? and(eq(voiceSessions.userId, user.id), eq(voiceSessions.bookId, bookId))
            : eq(voiceSessions.userId, user.id);

        const rows = await db
            .select({
                id: voiceSessions.id,
                bookId: voiceSessions.bookId,
                bookTitle: books.title,
                bookAuthor: books.author,
                startedAt: voiceSessions.startedAt,
                endedAt: voiceSessions.endedAt,
                durationSeconds: voiceSessions.durationSeconds,
                difficultyLevel: voiceSessions.difficultyLevel,
                levelSource: voiceSessions.levelSource,
                preSessionAnxiety: voiceSessions.preSessionAnxiety,
                postSessionAnxiety: voiceSessions.postSessionAnxiety,
                turnCount: count(sessionTurns.id),
            })
            .from(voiceSessions)
            .innerJoin(books, eq(voiceSessions.bookId, books.id))
            // An empty/failed call is not a past conversation.
            .innerJoin(sessionTurns, eq(sessionTurns.sessionId, voiceSessions.id))
            .where(historyFilter)
            .groupBy(
                voiceSessions.id,
                voiceSessions.bookId,
                voiceSessions.startedAt,
                voiceSessions.endedAt,
                voiceSessions.durationSeconds,
                voiceSessions.difficultyLevel,
                voiceSessions.levelSource,
                voiceSessions.preSessionAnxiety,
                voiceSessions.postSessionAnxiety,
                books.title,
                books.author,
            )
            .orderBy(desc(voiceSessions.startedAt));

        return { success: true, data: rows, book: scopedBook };
    } catch (e) {
        console.error('Error fetching conversation history', e);
        return { success: false, error: 'No se pudo cargar el historial.' };
    }
};

export const getConversationById = async (sessionId: string) => {
    try {
        const user = await requireUser();

        const [conversation] = await db
            .select({
                id: voiceSessions.id,
                bookId: voiceSessions.bookId,
                bookTitle: books.title,
                bookAuthor: books.author,
                startedAt: voiceSessions.startedAt,
                endedAt: voiceSessions.endedAt,
                durationSeconds: voiceSessions.durationSeconds,
                difficultyLevel: voiceSessions.difficultyLevel,
                levelSource: voiceSessions.levelSource,
                preSessionAnxiety: voiceSessions.preSessionAnxiety,
                postSessionAnxiety: voiceSessions.postSessionAnxiety,
                vapiCallId: voiceSessions.vapiCallId,
            })
            .from(voiceSessions)
            .innerJoin(books, eq(voiceSessions.bookId, books.id))
            .where(and(eq(voiceSessions.id, sessionId), eq(voiceSessions.userId, user.id)))
            .limit(1);

        if (!conversation) {
            return { success: false, error: 'Conversación no encontrada.' };
        }

        const turns = await db
            .select({
                id: sessionTurns.id,
                role: sessionTurns.role,
                content: sessionTurns.content,
                turnIndex: sessionTurns.turnIndex,
                startedAt: sessionTurns.startedAt,
                endedAt: sessionTurns.endedAt,
                studentLatencyMs: sessionTurns.studentLatencyMs,
                systemLatencyMs: sessionTurns.systemLatencyMs,
                maxPauseMs: sessionTurns.maxPauseMs,
            })
            .from(sessionTurns)
            .where(eq(sessionTurns.sessionId, conversation.id))
            .orderBy(asc(sessionTurns.turnIndex));

        const retrievals = await db
            .select({
                id: turnRetrievals.id,
                turnId: turnRetrievals.turnId,
                query: turnRetrievals.query,
                rank: turnRetrievals.rank,
                distance: turnRetrievals.distance,
                content: bookSegments.content,
                pageNumber: bookSegments.pageNumber,
            })
            .from(turnRetrievals)
            .innerJoin(bookSegments, eq(turnRetrievals.segmentId, bookSegments.id))
            .where(eq(turnRetrievals.sessionId, conversation.id))
            .orderBy(asc(turnRetrievals.createdAt), asc(turnRetrievals.rank));

        const humanEvaluations = await db
            .select({
                turnId: turnEvaluations.turnId,
                isCorrect: turnEvaluations.isCorrect,
            })
            .from(turnEvaluations)
            .innerJoin(sessionTurns, eq(turnEvaluations.turnId, sessionTurns.id))
            .where(eq(sessionTurns.sessionId, conversation.id));

        const ragas = await db
            .select({
                turnId: ragasEvaluations.turnId,
                promptVersion: ragasEvaluations.promptVersion,
                faithfulness: ragasEvaluations.faithfulness,
                answerRelevancy: ragasEvaluations.answerRelevancy,
                contextPrecision: ragasEvaluations.contextPrecision,
                contextRecall: ragasEvaluations.contextRecall,
                computedAt: ragasEvaluations.computedAt,
            })
            .from(ragasEvaluations)
            .innerJoin(sessionTurns, eq(ragasEvaluations.turnId, sessionTurns.id))
            .where(eq(sessionTurns.sessionId, conversation.id))
            .orderBy(desc(ragasEvaluations.computedAt));

        const vapi = conversation.vapiCallId
            ? await getVapiCallDetails(conversation.vapiCallId)
            : { status: 'not-linked' as const };

        return {
            success: true,
            data: { conversation, turns, retrievals, humanEvaluations, ragas, vapi },
        };
    } catch (e) {
        console.error('Error fetching conversation', e);
        return { success: false, error: 'No se pudo cargar la conversación.' };
    }
};
