import { asc, eq } from 'drizzle-orm';

import { db } from '@/database/db';
import {
    bookSegments,
    books,
    ragasEvaluations,
    sessionTurns,
    turnEvaluations,
    turnRetrievals,
    users,
    voiceSessions,
} from '@/database/schema';

/**
 * Reads the raw evidence the metrics are computed from.
 *
 * Deliberately dumb: every function here returns rows, and all arithmetic lives
 * in the pure modules next to it (architecture, latency, precision, triples,
 * ragas). That split is what lets the formulas be unit-tested without a database.
 *
 * Not a server action and not exported to the client: these queries span every
 * participant, so the caller must have passed `requireResearchOwner()` first.
 */

export interface MetricsTurnRow {
    turnId: string;
    sessionId: string;
    turnIndex: number;
    role: string;
    content: string;
    startedAt: Date;
    endedAt: Date;
    studentLatencyMs: number | null;
    systemLatencyMs: number | null;
    userId: string;
    participantCode: string | null;
    studyGroup: string | null;
    sessionStartedAt: Date;
    bookId: string;
    bookTitle: string;
}

export async function fetchTurns(): Promise<MetricsTurnRow[]> {
    return db
        .select({
            turnId: sessionTurns.id,
            sessionId: sessionTurns.sessionId,
            turnIndex: sessionTurns.turnIndex,
            role: sessionTurns.role,
            content: sessionTurns.content,
            startedAt: sessionTurns.startedAt,
            endedAt: sessionTurns.endedAt,
            studentLatencyMs: sessionTurns.studentLatencyMs,
            systemLatencyMs: sessionTurns.systemLatencyMs,
            userId: voiceSessions.userId,
            participantCode: users.participantCode,
            studyGroup: users.studyGroup,
            sessionStartedAt: voiceSessions.startedAt,
            bookId: voiceSessions.bookId,
            bookTitle: books.title,
        })
        .from(sessionTurns)
        .innerJoin(voiceSessions, eq(sessionTurns.sessionId, voiceSessions.id))
        .innerJoin(users, eq(voiceSessions.userId, users.id))
        .innerJoin(books, eq(voiceSessions.bookId, books.id))
        .orderBy(asc(sessionTurns.sessionId), asc(sessionTurns.turnIndex));
}

export interface MetricsSessionRow {
    sessionId: string;
    userId: string;
    participantCode: string | null;
    studyGroup: string | null;
    startedAt: Date;
    endedAt: Date | null;
    durationSeconds: number;
    bookId: string;
    bookTitle: string;
}

export async function fetchSessions(): Promise<MetricsSessionRow[]> {
    return db
        .select({
            sessionId: voiceSessions.id,
            userId: voiceSessions.userId,
            participantCode: users.participantCode,
            studyGroup: users.studyGroup,
            startedAt: voiceSessions.startedAt,
            endedAt: voiceSessions.endedAt,
            durationSeconds: voiceSessions.durationSeconds,
            bookId: voiceSessions.bookId,
            bookTitle: books.title,
        })
        .from(voiceSessions)
        .innerJoin(users, eq(voiceSessions.userId, users.id))
        .innerJoin(books, eq(voiceSessions.bookId, books.id))
        .orderBy(asc(voiceSessions.userId), asc(voiceSessions.startedAt));
}

export interface MetricsRetrievalRow {
    turnId: string | null;
    sessionId: string | null;
    query: string;
    rank: number;
    distance: number;
    segmentId: string;
    segmentContent: string;
    pageNumber: number | null;
}

export async function fetchRetrievals(): Promise<MetricsRetrievalRow[]> {
    return db
        .select({
            turnId: turnRetrievals.turnId,
            sessionId: turnRetrievals.sessionId,
            query: turnRetrievals.query,
            rank: turnRetrievals.rank,
            distance: turnRetrievals.distance,
            segmentId: turnRetrievals.segmentId,
            segmentContent: bookSegments.content,
            pageNumber: bookSegments.pageNumber,
        })
        .from(turnRetrievals)
        .innerJoin(bookSegments, eq(turnRetrievals.segmentId, bookSegments.id))
        .orderBy(asc(turnRetrievals.turnId), asc(turnRetrievals.rank));
}

export interface MetricsEvaluationRow {
    turnId: string;
    isCorrect: boolean;
    notes: string | null;
    evaluatedAt: Date;
}

export async function fetchEvaluations(): Promise<MetricsEvaluationRow[]> {
    return db
        .select({
            turnId: turnEvaluations.turnId,
            isCorrect: turnEvaluations.isCorrect,
            notes: turnEvaluations.notes,
            evaluatedAt: turnEvaluations.evaluatedAt,
        })
        .from(turnEvaluations);
}

export interface MetricsRagasRow {
    turnId: string;
    promptVersion: string;
    faithfulness: number | null;
    answerRelevancy: number | null;
    contextPrecision: number | null;
    contextRecall: number | null;
    computedAt: Date;
}

export async function fetchRagasScores(promptVersion: string): Promise<MetricsRagasRow[]> {
    return db
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
        .where(eq(ragasEvaluations.promptVersion, promptVersion));
}
