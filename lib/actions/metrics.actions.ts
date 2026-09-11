'use server';

import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { revalidatePath } from 'next/cache';

import { db } from '@/database/db';
import { ragasEvaluations, sessionTurns, turnEvaluations } from '@/database/schema';
import { generateQueryEmbedding } from '@/lib/embeddings';
import { requireResearchOwner } from '@/lib/metrics/access';
import { buildAllCsvFiles, type CsvFile } from '@/lib/metrics/exports';
import { geminiJudge, JUDGE_MODEL } from '@/lib/metrics/judge';
import {
    fetchEvaluations,
    fetchRagasScores,
    fetchRetrievals,
    fetchSessions,
    fetchTurns,
} from '@/lib/metrics/queries';
import { RAGAS_PROMPT_VERSION, computeRagasForTriple } from '@/lib/metrics/ragas';
import {
    buildMetricsReport,
    pendingRagasTriples,
    type MetricsInput,
    type MetricsReport,
} from '@/lib/metrics/report';
import { buildRagasTriples, type RetrievedContext } from '@/lib/metrics/triples';

/**
 * Server actions behind /metrics and /metrics/revision.
 *
 * All of them read across every participant, so all of them start with
 * `requireResearchOwner()`. They follow the project convention of returning
 * `{ success, data?, error? }` instead of throwing at the client.
 */

async function loadInput(): Promise<MetricsInput> {
    const [turns, sessions, retrievals, evaluations, ragasRows] = await Promise.all([
        fetchTurns(),
        fetchSessions(),
        fetchRetrievals(),
        fetchEvaluations(),
        fetchRagasScores(RAGAS_PROMPT_VERSION),
    ]);

    return { turns, sessions, retrievals, evaluations, ragasRows };
}

/** What /metrics renders: the report plus the judge model it should quote next to the RAGAs scores. */
export type MetricsOverview = MetricsReport & { judgeModel: string };

export interface MetricsOverviewResult {
    success: boolean;
    data?: MetricsOverview;
    error?: string;
}

export const getMetricsOverview = async (): Promise<MetricsOverviewResult> => {
    try {
        await requireResearchOwner();

        const input = await loadInput();
        const report = buildMetricsReport(input);

        return { success: true, data: { ...report, judgeModel: JUDGE_MODEL } };
    } catch (e) {
        console.error('Error building metrics report', e);
        return { success: false, error: (e as Error).message || 'No se pudieron calcular las métricas.' };
    }
};

// ============================================================================
// PR — human review
// ============================================================================

export type ReviewFilter = 'pendientes' | 'revisados' | 'todos';

export interface ReviewTurn {
    turnId: string;
    sessionId: string;
    sessionNumber: number;
    participantCode: string | null;
    bookTitle: string;
    turnIndex: number;
    /** Student turn that preceded this answer, when there is one. */
    question: string | null;
    answer: string;
    contexts: RetrievedContext[];
    systemLatencyMs: number | null;
    isCorrect: boolean | null;
    notes: string | null;
}

export interface ReviewTurnsResult {
    success: boolean;
    data?: { turns: ReviewTurn[]; pending: number; reviewed: number; total: number };
    error?: string;
}

const REVIEW_PAGE_SIZE = 40;

export const getTurnsForReview = async (filter: ReviewFilter = 'pendientes'): Promise<ReviewTurnsResult> => {
    try {
        await requireResearchOwner();

        const input = await loadInput();
        const report = buildMetricsReport(input);

        const sessionNumbers = new Map(report.sessions.map((s) => [s.sessionId, s.sessionNumber]));
        const evaluationByTurn = new Map(input.evaluations.map((e) => [e.turnId, e]));

        // Retrieved context, when the agent searched before answering.
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
        const contextsByAnswer = new Map(triples.map((t) => [t.answerTurnId, t.contexts]));

        const turnsBySession = new Map<string, typeof input.turns>();
        for (const turn of input.turns) {
            const list = turnsBySession.get(turn.sessionId);
            if (list) list.push(turn);
            else turnsBySession.set(turn.sessionId, [turn]);
        }

        const agentTurns = input.turns.filter((t) => t.role === 'assistant');

        const all: ReviewTurn[] = agentTurns.map((turn) => {
            const sessionTurnList = turnsBySession.get(turn.sessionId) ?? [];
            const question = [...sessionTurnList]
                .reverse()
                .find((t) => t.turnIndex < turn.turnIndex && t.role === 'user')?.content ?? null;
            const evaluation = evaluationByTurn.get(turn.turnId);

            return {
                turnId: turn.turnId,
                sessionId: turn.sessionId,
                sessionNumber: sessionNumbers.get(turn.sessionId) ?? 0,
                participantCode: turn.participantCode,
                bookTitle: turn.bookTitle,
                turnIndex: turn.turnIndex,
                question,
                answer: turn.content,
                contexts: contextsByAnswer.get(turn.turnId) ?? [],
                systemLatencyMs: turn.systemLatencyMs,
                isCorrect: evaluation ? evaluation.isCorrect : null,
                notes: evaluation?.notes ?? null,
            };
        });

        const pending = all.filter((t) => t.isCorrect === null);
        const reviewed = all.filter((t) => t.isCorrect !== null);

        const selected =
            filter === 'pendientes' ? pending : filter === 'revisados' ? reviewed : all;

        return {
            success: true,
            data: {
                turns: selected.slice(0, REVIEW_PAGE_SIZE),
                pending: pending.length,
                reviewed: reviewed.length,
                total: all.length,
            },
        };
    } catch (e) {
        console.error('Error loading turns for review', e);
        return { success: false, error: (e as Error).message || 'No se pudieron cargar los turnos.' };
    }
};

export interface SaveEvaluationInput {
    turnId: string;
    isCorrect: boolean;
    notes?: string | null;
}

async function agentTurnExists(turnId: string): Promise<boolean> {
    const [turn] = await db
        .select({ id: sessionTurns.id })
        .from(sessionTurns)
        .where(and(eq(sessionTurns.id, turnId), eq(sessionTurns.role, 'assistant')))
        .limit(1);

    return Boolean(turn);
}

export const saveTurnEvaluation = async (
    input: SaveEvaluationInput,
): Promise<{ success: boolean; error?: string }> => {
    try {
        const { userId } = await requireResearchOwner();

        if (!input.turnId) return { success: false, error: 'Falta el turno a evaluar.' };
        if (!(await agentTurnExists(input.turnId))) {
            return { success: false, error: 'La respuesta del agente no existe o no se puede evaluar.' };
        }

        const notes = input.notes?.trim() || null;

        // One verdict per turn: re-marking updates the row instead of adding a
        // second, contradictory one to the same denominator.
        await db
            .insert(turnEvaluations)
            .values({
                id: nanoid(),
                turnId: input.turnId,
                isCorrect: input.isCorrect,
                notes,
                evaluatedBy: userId,
                evaluatedAt: new Date(),
            })
            .onConflictDoUpdate({
                target: turnEvaluations.turnId,
                set: { isCorrect: input.isCorrect, notes, evaluatedBy: userId, evaluatedAt: new Date() },
            });

        revalidatePath('/metrics');
        revalidatePath('/metrics/revision');

        return { success: true };
    } catch (e) {
        console.error('Error saving turn evaluation', e);
        return { success: false, error: (e as Error).message || 'No se pudo guardar la evaluación.' };
    }
};

export const deleteTurnEvaluation = async (
    turnId: string,
): Promise<{ success: boolean; error?: string }> => {
    try {
        await requireResearchOwner();

        if (!turnId) return { success: false, error: 'Falta el turno a evaluar.' };
        if (!(await agentTurnExists(turnId))) {
            return { success: false, error: 'La respuesta del agente no existe o no se puede evaluar.' };
        }

        await db.delete(turnEvaluations).where(eq(turnEvaluations.turnId, turnId));

        revalidatePath('/metrics');
        revalidatePath('/metrics/revision');

        return { success: true };
    } catch (e) {
        console.error('Error deleting turn evaluation', e);
        return { success: false, error: (e as Error).message || 'No se pudo borrar la evaluación.' };
    }
};

// ============================================================================
// RAGAs — judged computation
// ============================================================================

/**
 * How many triples one invocation scores. Each triple costs six judge calls and
 * four embeddings, so a large batch would hit the request timeout before it
 * finished. The action reports what is left and the button can be pressed again.
 */
const RAGAS_BATCH_SIZE = 10;

export interface RecomputeRagasResult {
    success: boolean;
    data?: { computed: number; failed: number; remaining: number };
    error?: string;
}

export const recomputeRagas = async (): Promise<RecomputeRagasResult> => {
    try {
        await requireResearchOwner();

        if (!process.env.GEMINI_API_KEY) {
            return { success: false, error: 'Falta GEMINI_API_KEY: el juez no puede ejecutarse.' };
        }

        const input = await loadInput();
        const pending = pendingRagasTriples(input);

        const batch = pending.slice(0, RAGAS_BATCH_SIZE);
        let computed = 0;
        let failed = 0;

        // Sequential on purpose: the judge is rate-limited and the batch is small.
        for (const triple of batch) {
            try {
                const { scores, detail } = await computeRagasForTriple(triple, {
                    judge: geminiJudge,
                    embed: generateQueryEmbedding,
                });

                await db
                    .insert(ragasEvaluations)
                    .values({
                        id: nanoid(),
                        turnId: triple.answerTurnId,
                        promptVersion: RAGAS_PROMPT_VERSION,
                        faithfulness: scores.faithfulness,
                        answerRelevancy: scores.answerRelevancy,
                        contextPrecision: scores.contextPrecision,
                        contextRecall: scores.contextRecall,
                        detail: JSON.stringify(detail),
                        computedAt: new Date(),
                    })
                    .onConflictDoUpdate({
                        target: [ragasEvaluations.turnId, ragasEvaluations.promptVersion],
                        set: {
                            faithfulness: scores.faithfulness,
                            answerRelevancy: scores.answerRelevancy,
                            contextPrecision: scores.contextPrecision,
                            contextRecall: scores.contextRecall,
                            detail: JSON.stringify(detail),
                            computedAt: new Date(),
                        },
                    });

                computed++;
            } catch (error) {
                console.error(`RAGAs failed for turn ${triple.answerTurnId}:`, error);
                failed++;
            }
        }

        revalidatePath('/metrics');

        return {
            success: true,
            data: { computed, failed, remaining: pending.length - computed },
        };
    } catch (e) {
        console.error('Error recomputing RAGAs', e);
        return { success: false, error: (e as Error).message || 'No se pudo calcular RAGAs.' };
    }
};

/** Wipes the scores of the current prompt version so the next run recomputes them from scratch. */
export const clearRagasScores = async (): Promise<{ success: boolean; error?: string }> => {
    try {
        await requireResearchOwner();

        await db
            .delete(ragasEvaluations)
            .where(eq(ragasEvaluations.promptVersion, RAGAS_PROMPT_VERSION));

        revalidatePath('/metrics');
        return { success: true };
    } catch (e) {
        console.error('Error clearing RAGAs scores', e);
        return { success: false, error: (e as Error).message || 'No se pudieron borrar los puntajes.' };
    }
};

// ============================================================================
// CSV export
// ============================================================================

export interface ExportResult {
    success: boolean;
    data?: CsvFile[];
    error?: string;
}

/**
 * Returns the CSV files as text. The browser turns them into downloads: a route
 * handler with Content-Disposition would be the other option, but the project
 * keeps data access in server actions (see CLAUDE.md).
 */
export const exportMetricsCsv = async (): Promise<ExportResult> => {
    try {
        await requireResearchOwner();

        const input = await loadInput();
        const report = buildMetricsReport(input);

        return { success: true, data: buildAllCsvFiles(input, report) };
    } catch (e) {
        console.error('Error exporting metrics CSV', e);
        return { success: false, error: (e as Error).message || 'No se pudo exportar el CSV.' };
    }
};
