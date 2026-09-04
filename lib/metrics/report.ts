import {
    ARCHITECTURE_COMPONENTS,
    computeIca,
    type ArchitectureComponent,
    type IcaResult,
} from './architecture';
import {
    EMPTY_LATENCY_SUMMARY,
    numberSessionsByParticipant,
    studentLatencyTrend,
    summarizeByParticipantSession,
    summarizeLatency,
    type LatencySample,
    type LatencySummary,
    type ParticipantSessionLatency,
    type ParticipantTrend,
} from './latency';
import { computePrecision, type PrecisionResult } from './precision';
import {
    RAGAS_PROMPT_VERSION,
    aggregateRagas,
    type RagasScores,
    type RagasSummary,
} from './ragas';
import { buildRagasTriples, type RagasTriple } from './triples';
import type {
    MetricsEvaluationRow,
    MetricsRagasRow,
    MetricsRetrievalRow,
    MetricsSessionRow,
    MetricsTurnRow,
} from './queries';

/**
 * Turns the raw rows into the numbers the thesis reports.
 *
 * Everything here is derived: no value is written by hand, and a metric with no
 * data reports null plus its n rather than a placeholder. That is the whole
 * point of the acceptance criterion "sin valores inventados ni placeholders".
 */

export interface MetricsInput {
    turns: MetricsTurnRow[];
    sessions: MetricsSessionRow[];
    retrievals: MetricsRetrievalRow[];
    evaluations: MetricsEvaluationRow[];
    ragasRows: MetricsRagasRow[];
}

export interface SessionReport {
    sessionId: string;
    userId: string;
    participantCode: string | null;
    studyGroup: string | null;
    sessionNumber: number;
    bookTitle: string;
    startedAt: Date;
    endedAt: Date | null;
    durationSeconds: number;
    turns: number;
    agentTurns: number;
    studentTurns: number;
    systemLatency: LatencySummary;
    studentLatency: LatencySummary;
    precision: PrecisionResult;
    ragas: RagasSummary;
}

export interface ParticipantReport {
    userId: string;
    participantCode: string | null;
    studyGroup: string | null;
    sessions: number;
    turns: number;
    agentTurns: number;
    studentTurns: number;
    totalDurationSeconds: number;
    systemLatency: LatencySummary;
    studentLatency: LatencySummary;
    firstSessionStudentMeanMs: number | null;
    lastSessionStudentMeanMs: number | null;
    studentDeltaMs: number | null;
    precision: PrecisionResult;
}

export interface MetricsReport {
    generatedAt: Date;
    ragasPromptVersion: string;
    ica: IcaResult;
    components: readonly ArchitectureComponent[];
    systemLatency: LatencySummary;
    studentLatency: LatencySummary;
    studentByParticipantSession: ParticipantSessionLatency[];
    studentTrend: ParticipantTrend[];
    precision: PrecisionResult;
    ragas: RagasSummary;
    ragasCoverage: {
        /** Triples that can be scored at all. */
        triples: number;
        /** Triples with a stored score for the current prompt version. */
        scored: number;
        pending: number;
        unanchoredRetrievals: number;
        anchorsWithoutAnswer: number;
    };
    corpus: {
        participants: number;
        sessions: number;
        sessionsWithTurns: number;
        turns: number;
        agentTurns: number;
        studentTurns: number;
        retrievals: number;
    };
    sessions: SessionReport[];
    participants: ParticipantReport[];
}

const EMPTY_RAGAS: RagasSummary = aggregateRagas([]);

function ragasScoresOf(rows: ReadonlyArray<MetricsRagasRow>): RagasScores[] {
    return rows.map((row) => ({
        faithfulness: row.faithfulness,
        answerRelevancy: row.answerRelevancy,
        contextPrecision: row.contextPrecision,
        contextRecall: row.contextRecall,
    }));
}

export function buildMetricsReport(input: MetricsInput): MetricsReport {
    const { turns, sessions, retrievals, evaluations, ragasRows } = input;

    // --- ICA ----------------------------------------------------------------
    const ica = computeIca(ARCHITECTURE_COMPONENTS);

    // --- Latencies ----------------------------------------------------------
    const systemLatency = summarizeLatency(
        turns.filter((t) => t.role === 'assistant').map((t) => t.systemLatencyMs),
    );

    const studentSamples: LatencySample[] = turns
        .filter((t) => t.role === 'user')
        .map((t) => ({
            sessionId: t.sessionId,
            userId: t.userId,
            participantCode: t.participantCode,
            studyGroup: t.studyGroup,
            latencyMs: t.studentLatencyMs,
        }));

    const studentLatency = summarizeLatency(studentSamples.map((s) => s.latencyMs));

    const sessionNumbers = numberSessionsByParticipant(
        sessions.map((s) => ({
            sessionId: s.sessionId,
            userId: s.userId,
            startedAt: s.startedAt.getTime(),
        })),
    );

    const studentByParticipantSession = summarizeByParticipantSession(studentSamples, sessionNumbers);
    const studentTrend = studentLatencyTrend(studentByParticipantSession, studentSamples);

    // --- PR -----------------------------------------------------------------
    const evaluationByTurn = new Map(evaluations.map((e) => [e.turnId, e]));
    const agentTurns = turns.filter((t) => t.role === 'assistant');

    const precision = computePrecision({
        totalAgentTurns: agentTurns.length,
        reviewed: agentTurns.filter((t) => evaluationByTurn.has(t.turnId)).length,
        correct: agentTurns.filter((t) => evaluationByTurn.get(t.turnId)?.isCorrect === true).length,
    });

    // --- RAGAs --------------------------------------------------------------
    const { triples, unanchoredRetrievals, anchorsWithoutAnswer } = buildRagasTriples(
        turns.map((t) => ({
            id: t.turnId,
            sessionId: t.sessionId,
            turnIndex: t.turnIndex,
            role: t.role,
            content: t.content,
        })),
        retrievals,
    );

    const scoredTurns = new Set(ragasRows.map((row) => row.turnId));
    const ragas = aggregateRagas(ragasScoresOf(ragasRows));
    const pending = triples.filter((triple) => !scoredTurns.has(triple.answerTurnId)).length;

    // --- Per-session rows ---------------------------------------------------
    const turnsBySession = new Map<string, MetricsTurnRow[]>();
    for (const turn of turns) {
        const list = turnsBySession.get(turn.sessionId);
        if (list) list.push(turn);
        else turnsBySession.set(turn.sessionId, [turn]);
    }

    const ragasTurnToSession = new Map(triples.map((t) => [t.answerTurnId, t.sessionId]));
    const ragasRowsBySession = new Map<string, MetricsRagasRow[]>();
    for (const row of ragasRows) {
        const sessionId = ragasTurnToSession.get(row.turnId);
        if (!sessionId) continue;
        const list = ragasRowsBySession.get(sessionId);
        if (list) list.push(row);
        else ragasRowsBySession.set(sessionId, [row]);
    }

    const sessionReports: SessionReport[] = sessions.map((session) => {
        const sessionTurnList = turnsBySession.get(session.sessionId) ?? [];
        const sessionAgentTurns = sessionTurnList.filter((t) => t.role === 'assistant');
        const sessionStudentTurns = sessionTurnList.filter((t) => t.role === 'user');
        const sessionRagasRows = ragasRowsBySession.get(session.sessionId);

        return {
            sessionId: session.sessionId,
            userId: session.userId,
            participantCode: session.participantCode,
            studyGroup: session.studyGroup,
            sessionNumber: sessionNumbers.get(session.sessionId) ?? 0,
            bookTitle: session.bookTitle,
            startedAt: session.startedAt,
            endedAt: session.endedAt,
            durationSeconds: session.durationSeconds,
            turns: sessionTurnList.length,
            agentTurns: sessionAgentTurns.length,
            studentTurns: sessionStudentTurns.length,
            systemLatency: summarizeLatency(sessionAgentTurns.map((t) => t.systemLatencyMs)),
            studentLatency: summarizeLatency(sessionStudentTurns.map((t) => t.studentLatencyMs)),
            precision: computePrecision({
                totalAgentTurns: sessionAgentTurns.length,
                reviewed: sessionAgentTurns.filter((t) => evaluationByTurn.has(t.turnId)).length,
                correct: sessionAgentTurns.filter((t) => evaluationByTurn.get(t.turnId)?.isCorrect === true)
                    .length,
            }),
            ragas: sessionRagasRows ? aggregateRagas(ragasScoresOf(sessionRagasRows)) : EMPTY_RAGAS,
        };
    });

    sessionReports.sort(
        (a, b) =>
            (a.participantCode ?? a.userId).localeCompare(b.participantCode ?? b.userId) ||
            a.sessionNumber - b.sessionNumber,
    );

    // --- Per-participant rows -----------------------------------------------
    const trendByUser = new Map(studentTrend.map((row) => [row.userId, row]));
    const sessionsByUser = new Map<string, SessionReport[]>();
    for (const report of sessionReports) {
        const list = sessionsByUser.get(report.userId);
        if (list) list.push(report);
        else sessionsByUser.set(report.userId, [report]);
    }

    const participantReports: ParticipantReport[] = [...sessionsByUser.entries()]
        .map(([userId, list]) => {
            const userTurns = list.flatMap((s) => turnsBySession.get(s.sessionId) ?? []);
            const userAgentTurns = userTurns.filter((t) => t.role === 'assistant');
            const trend = trendByUser.get(userId);

            return {
                userId,
                participantCode: list[0].participantCode,
                studyGroup: list[0].studyGroup,
                sessions: list.length,
                turns: userTurns.length,
                agentTurns: userAgentTurns.length,
                studentTurns: userTurns.filter((t) => t.role === 'user').length,
                totalDurationSeconds: list.reduce((acc, s) => acc + s.durationSeconds, 0),
                systemLatency: summarizeLatency(userAgentTurns.map((t) => t.systemLatencyMs)),
                studentLatency: trend?.overall ?? EMPTY_LATENCY_SUMMARY,
                firstSessionStudentMeanMs: trend?.firstSessionMeanMs ?? null,
                lastSessionStudentMeanMs: trend?.lastSessionMeanMs ?? null,
                studentDeltaMs: trend?.deltaMs ?? null,
                precision: computePrecision({
                    totalAgentTurns: userAgentTurns.length,
                    reviewed: userAgentTurns.filter((t) => evaluationByTurn.has(t.turnId)).length,
                    correct: userAgentTurns.filter((t) => evaluationByTurn.get(t.turnId)?.isCorrect === true)
                        .length,
                }),
            };
        })
        .sort((a, b) => (a.participantCode ?? a.userId).localeCompare(b.participantCode ?? b.userId));

    return {
        generatedAt: new Date(),
        ragasPromptVersion: RAGAS_PROMPT_VERSION,
        ica,
        components: ARCHITECTURE_COMPONENTS,
        systemLatency,
        studentLatency,
        studentByParticipantSession,
        studentTrend,
        precision,
        ragas,
        ragasCoverage: {
            triples: triples.length,
            scored: triples.length - pending,
            pending,
            unanchoredRetrievals,
            anchorsWithoutAnswer,
        },
        corpus: {
            participants: sessionsByUser.size,
            sessions: sessions.length,
            sessionsWithTurns: turnsBySession.size,
            turns: turns.length,
            agentTurns: agentTurns.length,
            studentTurns: turns.length - agentTurns.length,
            retrievals: retrievals.length,
        },
        sessions: sessionReports,
        participants: participantReports,
    };
}

/**
 * The triples that still have no score for the current prompt version.
 *
 * Kept out of `MetricsReport` on purpose: each triple carries the full text of
 * the segments the retriever returned, which the page never renders and which
 * would otherwise cross the server-action boundary on every load.
 */
export function pendingRagasTriples(input: MetricsInput): RagasTriple[] {
    const { triples } = buildRagasTriples(
        input.turns.map((t) => ({
            id: t.turnId,
            sessionId: t.sessionId,
            turnIndex: t.turnIndex,
            role: t.role,
            content: t.content,
        })),
        input.retrievals,
    );

    const scored = new Set(input.ragasRows.map((row) => row.turnId));
    return triples.filter((triple) => !scored.has(triple.answerTurnId));
}
