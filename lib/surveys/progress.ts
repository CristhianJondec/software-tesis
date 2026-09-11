import {
    isStageApplicable,
    responseKey,
    SURVEY_STAGES,
    type SurveyPhase,
    type SurveyStageId,
    type SurveyType,
} from './catalog.ts';

export type SurveyStageStatus = 'pending' | 'available' | 'completed' | 'not_applicable';

export interface SurveyProgressResponse {
    surveyType: string;
    phase: string;
    computedScore: number;
    submittedAt: Date;
}

export interface SurveyProgressStage {
    id: SurveyStageId;
    type: SurveyType;
    phase: SurveyPhase;
    title: string;
    shortTitle: string;
    estimatedMinutes: number;
    status: SurveyStageStatus;
    submittedAt: string | null;
    computedScore: number | null;
    blockedReason: string | null;
}

/**
 * T1 instruments form one baseline block and can be answered in either order.
 * The intervention and posterior instruments remain sequential after that.
 */
export function buildSurveyProgress(
    studyGroup: string | null,
    responses: SurveyProgressResponse[],
    hasConversation: boolean,
): SurveyProgressStage[] {
    const responseByStage = new Map(
        responses.map((response) => [responseKey(response.surveyType as SurveyType, response.phase as SurveyPhase), response]),
    );
    const isCompleted = (type: SurveyType, phase: SurveyPhase) => responseByStage.has(responseKey(type, phase));
    const baselineComplete = isCompleted('STAI', 'T1') && isCompleted('PRCS12', 'T1');
    const susApplies = isStageApplicable(SURVEY_STAGES[2], studyGroup);

    return SURVEY_STAGES.map((stage) => {
        if (!isStageApplicable(stage, studyGroup)) {
            return {
                ...stage,
                status: 'not_applicable',
                submittedAt: null,
                computedScore: null,
                blockedReason: null,
            };
        }

        const response = responseByStage.get(responseKey(stage.type, stage.phase));
        if (response) {
            return {
                ...stage,
                status: 'completed',
                submittedAt: response.submittedAt.toISOString(),
                computedScore: response.computedScore,
                blockedReason: null,
            };
        }

        if (stage.id === 'stai-t1' || stage.id === 'prcs12-t1') {
            return { ...stage, status: 'available', submittedAt: null, computedScore: null, blockedReason: null };
        }

        if (stage.id === 'sus') {
            const blockedReason = !baselineComplete
                ? 'Completa las dos mediciones basales para desbloquear esta encuesta.'
                : !hasConversation
                    ? 'Realiza al menos una conversación con el agente para desbloquear esta encuesta.'
                    : null;
            return {
                ...stage,
                status: blockedReason ? 'pending' : 'available',
                submittedAt: null,
                computedScore: null,
                blockedReason,
            };
        }

        if (stage.id === 'stai-t2') {
            const prerequisiteComplete = susApplies ? isCompleted('SUS', 'UNICA') : baselineComplete;
            return {
                ...stage,
                status: prerequisiteComplete ? 'available' : 'pending',
                submittedAt: null,
                computedScore: null,
                blockedReason: prerequisiteComplete
                    ? null
                    : susApplies
                        ? 'Completa primero la encuesta SUS.'
                        : 'Completa las dos mediciones basales para desbloquear esta encuesta.',
            };
        }

        const staiT2Complete = isCompleted('STAI', 'T2');
        return {
            ...stage,
            status: staiT2Complete ? 'available' : 'pending',
            submittedAt: null,
            computedScore: null,
            blockedReason: staiT2Complete ? null : 'Completa primero STAI — Medición Posterior (T2).',
        };
    });
}
