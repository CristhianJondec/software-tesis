'use server';

import { and, asc, count, desc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { db } from '@/database/db';
import {
    bookSegments,
    books,
    ragasEvaluations,
    sessionTurns,
    turnEvaluations,
    turnRetrievals,
    voiceSessions,
} from '@/database/schema';
import { requireUser } from '@/lib/session';
import { MAX_SESSION_DURATION_MINUTES } from '@/lib/constants';
import { getCurrentBillingPeriodStart } from '@/lib/subscription-constants';
import { getVapiCallDetails } from '@/lib/vapi.server';
import type {
    EndSessionResult,
    LinkVapiCallResult,
    SaveTurnInput,
    SaveTurnResult,
    StartSessionResult,
} from '@/types';

export const startVoiceSession = async (bookId: string): Promise<StartSessionResult> => {
    try {
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
            })
            .returning();

        return {
            success: true,
            sessionId: session.id,
            maxDurationMinutes: MAX_SESSION_DURATION_MINUTES,
        };
    } catch (e) {
        console.error('Error starting voice session', e);
        return { success: false, error: 'Failed to start voice session. Please try again later.' };
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
            })
            .returning({ id: sessionTurns.id });

        return { success: true, turnId: turn.id };
    } catch (e) {
        console.error('Error saving session turn', e);
        return { success: false, error: 'Failed to save session turn.' };
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
