'use server';

import { asc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { revalidatePath } from 'next/cache';

import { db } from '@/database/db';
import { surveyResponses, users, type SurveyAnswers } from '@/database/schema';
import { requireAdmin } from '@/lib/admin/access';
import { requireUser } from '@/lib/session';
import {
    findSurveyStage,
    isStageApplicable,
    responseKey,
    SURVEY_INSTRUMENTS,
    SURVEY_STAGES,
    type SurveyPhase,
    type SurveyStageId,
    type SurveyType,
} from '@/lib/surveys/catalog';
import { computeSurveyScore, validateSurveyAnswers } from '@/lib/surveys/scoring';

export type SurveyStageStatus = 'pending' | 'available' | 'completed' | 'not_applicable';

export interface SurveyProgressStage {
    id: SurveyStageId;
    type: SurveyType;
    phase: SurveyPhase;
    title: string;
    shortTitle: string;
    status: SurveyStageStatus;
    submittedAt: string | null;
    computedScore: number | null;
}

export interface SurveyProgress {
    participantCode: string | null;
    studyGroup: string | null;
    stages: SurveyProgressStage[];
    completedCount: number;
    applicableCount: number;
}

interface StoredResponse {
    surveyType: string;
    phase: string;
    answers: SurveyAnswers;
    computedScore: number;
    submittedAt: Date;
}

function buildProgress(studyGroup: string | null, responses: StoredResponse[]): SurveyProgressStage[] {
    const responseByStage = new Map(
        responses.map((response) => [responseKey(response.surveyType as SurveyType, response.phase as SurveyPhase), response]),
    );
    let priorApplicableStagesCompleted = true;

    return SURVEY_STAGES.map((stage) => {
        const applicable = isStageApplicable(stage, studyGroup);
        const response = responseByStage.get(responseKey(stage.type, stage.phase));

        if (!applicable) {
            return { ...stage, status: 'not_applicable' as const, submittedAt: null, computedScore: null };
        }

        if (response) {
            return {
                ...stage,
                status: 'completed' as const,
                submittedAt: response.submittedAt.toISOString(),
                computedScore: response.computedScore,
            };
        }

        const status: SurveyStageStatus = priorApplicableStagesCompleted ? 'available' : 'pending';
        priorApplicableStagesCompleted = false;
        return { ...stage, status, submittedAt: null, computedScore: null };
    });
}

async function loadUserAndResponses(userId: string) {
    const [userRows, responses] = await Promise.all([
        db.select({
            id: users.id,
            participantCode: users.participantCode,
            studyGroup: users.studyGroup,
        }).from(users).where(eq(users.id, userId)).limit(1),
        db.select({
            surveyType: surveyResponses.surveyType,
            phase: surveyResponses.phase,
            answers: surveyResponses.answers,
            computedScore: surveyResponses.computedScore,
            submittedAt: surveyResponses.submittedAt,
        }).from(surveyResponses).where(eq(surveyResponses.userId, userId)),
    ]);

    return { user: userRows[0], responses };
}

export async function getSurveyProgress(): Promise<{ success: boolean; data?: SurveyProgress; error?: string }> {
    try {
        const sessionUser = await requireUser();
        const { user, responses } = await loadUserAndResponses(sessionUser.id);
        if (!user) return { success: false, error: 'No se encontró tu cuenta.' };

        const stages = buildProgress(user.studyGroup, responses);
        const applicable = stages.filter((stage) => stage.status !== 'not_applicable');
        return {
            success: true,
            data: {
                participantCode: user.participantCode,
                studyGroup: user.studyGroup,
                stages,
                completedCount: applicable.filter((stage) => stage.status === 'completed').length,
                applicableCount: applicable.length,
            },
        };
    } catch (error) {
        console.error('Error loading survey progress', error);
        return { success: false, error: error instanceof Error ? error.message : 'No se pudieron cargar las encuestas.' };
    }
}

export interface SubmitSurveyInput {
    stageId: string;
    answers: Record<string, number>;
}

export async function submitSurvey(input: SubmitSurveyInput): Promise<{ success: boolean; error?: string }> {
    try {
        const sessionUser = await requireUser();
        const stage = findSurveyStage(input?.stageId);
        if (!stage) return { success: false, error: 'La etapa seleccionada no existe.' };
        if (!input.answers || typeof input.answers !== 'object' || Array.isArray(input.answers)) {
            return { success: false, error: 'Las respuestas enviadas no son válidas.' };
        }

        const { user, responses } = await loadUserAndResponses(sessionUser.id);
        if (!user) return { success: false, error: 'No se encontró tu cuenta.' };
        if (!isStageApplicable(stage, user.studyGroup)) {
            return { success: false, error: 'Esta encuesta no corresponde a tu grupo de estudio.' };
        }

        const completed = new Set(
            responses.map((response) => responseKey(response.surveyType as SurveyType, response.phase as SurveyPhase)),
        );
        const stageKey = responseKey(stage.type, stage.phase);
        if (completed.has(stageKey)) {
            return { success: false, error: 'Esta etapa ya fue enviada y no puede editarse.' };
        }

        const firstMissing = SURVEY_STAGES.find(
            (candidate) => isStageApplicable(candidate, user.studyGroup) && !completed.has(responseKey(candidate.type, candidate.phase)),
        );
        if (!firstMissing || firstMissing.id !== stage.id) {
            return { success: false, error: 'Completa primero la etapa anterior para desbloquear esta encuesta.' };
        }

        const answers = validateSurveyAnswers(stage.type, input.answers);
        const computedScore = computeSurveyScore(stage.type, answers);

        await db.insert(surveyResponses).values({
            id: nanoid(),
            userId: sessionUser.id,
            surveyType: stage.type,
            phase: stage.phase,
            answers,
            computedScore,
            submittedAt: new Date(),
        });

        revalidatePath('/surveys');
        revalidatePath('/admin');
        return { success: true };
    } catch (error) {
        console.error('Error submitting survey', error);
        const message = error instanceof Error ? error.message : '';
        if (message.includes('survey_responses_user_instrument_phase_idx') || message.includes('unique')) {
            return { success: false, error: 'Esta etapa ya fue enviada y no puede editarse.' };
        }
        return { success: false, error: message || 'No se pudo guardar la encuesta.' };
    }
}

export interface AdminSurveyResponse {
    stageId: SurveyStageId;
    title: string;
    scoreLabel: 'AE' | 'AC' | 'SUS';
    computedScore: number;
    submittedAt: string;
    answers: number[];
}

export interface AdminUserSurveyRow {
    id: string;
    name: string;
    email: string;
    participantCode: string | null;
    studyGroup: string | null;
    createdAt: string;
    stages: SurveyProgressStage[];
    responses: AdminSurveyResponse[];
    scores: {
        aeT1: number | null;
        aeT2: number | null;
        acT1: number | null;
        acT2: number | null;
        sus: number | null;
        aeDelta: number | null;
        acDelta: number | null;
    };
}

function scoreFor(responses: StoredResponse[], type: SurveyType, phase: SurveyPhase): number | null {
    return responses.find((row) => row.surveyType === type && row.phase === phase)?.computedScore ?? null;
}

export async function getAdminSurveyOverview(): Promise<{
    success: boolean;
    data?: AdminUserSurveyRow[];
    error?: string;
}> {
    try {
        await requireAdmin();
        const [allUsers, allResponses] = await Promise.all([
            db.select({
                id: users.id,
                name: users.name,
                email: users.email,
                participantCode: users.participantCode,
                studyGroup: users.studyGroup,
                createdAt: users.createdAt,
            }).from(users).orderBy(asc(users.createdAt)),
            db.select({
                userId: surveyResponses.userId,
                surveyType: surveyResponses.surveyType,
                phase: surveyResponses.phase,
                answers: surveyResponses.answers,
                computedScore: surveyResponses.computedScore,
                submittedAt: surveyResponses.submittedAt,
            }).from(surveyResponses).orderBy(asc(surveyResponses.submittedAt)),
        ]);

        const responsesByUser = new Map<string, StoredResponse[]>();
        for (const response of allResponses) {
            const list = responsesByUser.get(response.userId) ?? [];
            list.push(response);
            responsesByUser.set(response.userId, list);
        }

        const data = allUsers.map((user): AdminUserSurveyRow => {
            const responses = responsesByUser.get(user.id) ?? [];
            const aeT1 = scoreFor(responses, 'STAI', 'T1');
            const aeT2 = scoreFor(responses, 'STAI', 'T2');
            const acT1 = scoreFor(responses, 'PRCS12', 'T1');
            const acT2 = scoreFor(responses, 'PRCS12', 'T2');
            const sus = scoreFor(responses, 'SUS', 'UNICA');

            return {
                ...user,
                createdAt: user.createdAt.toISOString(),
                stages: buildProgress(user.studyGroup, responses),
                responses: SURVEY_STAGES.flatMap((stage) => {
                    const response = responses.find((row) => row.surveyType === stage.type && row.phase === stage.phase);
                    if (!response) return [];
                    return [{
                        stageId: stage.id,
                        title: stage.title,
                        scoreLabel: SURVEY_INSTRUMENTS[stage.type].scoreLabel,
                        computedScore: response.computedScore,
                        submittedAt: response.submittedAt.toISOString(),
                        answers: SURVEY_INSTRUMENTS[stage.type].questions.map((_, index) => response.answers[`item_${index + 1}`]),
                    }];
                }),
                scores: {
                    aeT1,
                    aeT2,
                    acT1,
                    acT2,
                    sus,
                    aeDelta: aeT1 !== null && aeT2 !== null ? aeT2 - aeT1 : null,
                    acDelta: acT1 !== null && acT2 !== null ? acT2 - acT1 : null,
                },
            };
        });

        return { success: true, data };
    } catch (error) {
        console.error('Error loading admin survey overview', error);
        return { success: false, error: error instanceof Error ? error.message : 'No se pudo cargar el panel.' };
    }
}

function csvCell(value: string | number | null): string {
    if (value === null) return '';
    let text = String(value);
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
}

export async function exportSurveySummaryCsv(): Promise<{
    success: boolean;
    data?: { filename: string; content: string };
    error?: string;
}> {
    const overview = await getAdminSurveyOverview();
    if (!overview.success || !overview.data) return { success: false, error: overview.error };

    const headers = [
        'user_id', 'codigo_participante', 'nombre', 'email', 'grupo',
        'AE_T1', 'AE_T2', 'DIF_AE_T2_T1', 'AC_T1', 'AC_T2', 'DIF_AC_T2_T1', 'SUS',
        ...SURVEY_STAGES.map((stage) => `fecha_${stage.id.replaceAll('-', '_')}`),
    ];
    const rows = overview.data.map((user) => [
        user.id,
        user.participantCode,
        user.name,
        user.email,
        user.studyGroup,
        user.scores.aeT1,
        user.scores.aeT2,
        user.scores.aeDelta,
        user.scores.acT1,
        user.scores.acT2,
        user.scores.acDelta,
        user.scores.sus,
        ...user.stages.map((stage) => stage.status === 'not_applicable' ? 'NO_APLICA' : stage.submittedAt),
    ]);

    const content = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
    return {
        success: true,
        data: { filename: `encuestas-resumen-${new Date().toISOString().slice(0, 10)}.csv`, content: `\uFEFF${content}` },
    };
}
