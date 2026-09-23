/**
 * The four written questions of the prediction record (docs/propuestas/04).
 *
 * WHY WRITTEN AND NOT BY VOICE. The three pre-session questions are typed, not
 * asked by the agent, for two reasons: they would spend minutes of a session the
 * student is already nervous about, and an answer given out loud to the examiner
 * is a different measurement from one written in private before it starts.
 *
 * All four are OPTIONAL. Nothing here may gate the start of a session: the point
 * of the feature is to give the student evidence against their own expectation,
 * not to make them fill a form to practise.
 *
 * Pure module: no database, no network. Spanish, because it is UI copy.
 */

import {
    classifyMentionedTopicIds,
    classifyQuestionTopicId,
} from '../preparation/classify.ts';
import { isPreparationTopicId, type PreparationTopicId } from '../preparation/topics.ts';

export const PREDICTION_QUESTION_IDS = [
    'expectedQuestions',
    'fearedPart',
    'blankOutcome',
] as const;

export type PredictionQuestionId = (typeof PREDICTION_QUESTION_IDS)[number];

export interface PredictionQuestion {
    id: PredictionQuestionId;
    /** Asked verbatim before the session and echoed verbatim in the contrast. */
    prompt: string;
    /** Placeholder of the field. Never an example that steers the answer. */
    placeholder: string;
}

export const PREDICTION_QUESTIONS: Record<PredictionQuestionId, PredictionQuestion> = {
    expectedQuestions: {
        id: 'expectedQuestions',
        prompt: '¿Qué crees que te van a preguntar?',
        placeholder: 'Escríbelo con tus palabras.',
    },
    fearedPart: {
        id: 'fearedPart',
        prompt: '¿Qué parte te da más temor?',
        placeholder: 'La parte de tu investigación que menos quisieras que te pregunten.',
    },
    blankOutcome: {
        id: 'blankOutcome',
        prompt: '¿Qué crees que pasaría si no recuerdas una respuesta?',
        placeholder: 'Lo que crees que ocurriría en ese momento.',
    },
};

export const ORDERED_PREDICTION_QUESTIONS: PredictionQuestion[] =
    PREDICTION_QUESTION_IDS.map((id) => PREDICTION_QUESTIONS[id]);

/** Asked when the session closes, and shown back at the start of the next one. */
export const NEXT_STRATEGY_QUESTION = '¿Qué vas a probar distinto en la siguiente sesión?';

/**
 * Hard cap on a written answer. Generous enough for a paragraph, bounded so a
 * pasted document cannot land in the row or in the contrast the student reads.
 */
export const MAX_PREDICTION_CHARS = 600;

/** Empty, blank or non-string answers are stored as NULL, never as ''. */
export function normalizePredictionText(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const collapsed = value.replace(/\s+/g, ' ').trim();
    if (collapsed === '') return null;
    return collapsed.length > MAX_PREDICTION_CHARS
        ? collapsed.slice(0, MAX_PREDICTION_CHARS).trimEnd()
        : collapsed;
}

/** The three answers as the pre-session form hands them over. */
export interface PredictionAnswers {
    expectedQuestions?: string | null;
    fearedPart?: string | null;
    blankOutcome?: string | null;
}

/** What gets written to `session_predictions`, tags included. */
export interface NormalizedPrediction {
    expectedQuestions: string | null;
    expectedTopics: PreparationTopicId[];
    fearedPart: string | null;
    fearedTopic: PreparationTopicId | null;
    blankOutcome: string | null;
}

/**
 * Narrows the form payload and tags it against the taxonomy.
 *
 * The tagging is the lexical classifier of the preparation map, not a model: the
 * contrast has to be reproducible and auditable against the cue lists in
 * `lib/preparation/topics.ts`. A prediction no cue matches is kept verbatim with
 * no topic — the contrast then says it could not be matched, rather than filing
 * the student's words under a guessed topic.
 */
export function normalizePrediction(answers: PredictionAnswers | null | undefined): NormalizedPrediction {
    const expectedQuestions = normalizePredictionText(answers?.expectedQuestions);
    const fearedPart = normalizePredictionText(answers?.fearedPart);

    return {
        expectedQuestions,
        expectedTopics: expectedQuestions ? classifyMentionedTopicIds(expectedQuestions) : [],
        fearedPart,
        fearedTopic: fearedPart ? classifyQuestionTopicId(fearedPart) : null,
        blankOutcome: normalizePredictionText(answers?.blankOutcome),
    };
}

/** True when nothing was answered: the caller may skip writing a row. */
export function isEmptyPrediction(prediction: NormalizedPrediction): boolean {
    return (
        prediction.expectedQuestions === null &&
        prediction.fearedPart === null &&
        prediction.blankOutcome === null
    );
}

/** Serialises the tag list for `session_predictions.expected_topics`. */
export function serializeTopicIds(topics: ReadonlyArray<PreparationTopicId>): string {
    return JSON.stringify(topics);
}

/** Reads it back. A corrupt value reads as "no topics", never as a crash. */
export function parseTopicIds(value: string | null): PreparationTopicId[] {
    if (!value) return [];
    try {
        const parsed: unknown = JSON.parse(value);
        if (!Array.isArray(parsed)) return [];
        const seen = new Set<PreparationTopicId>();
        for (const item of parsed) {
            if (isPreparationTopicId(item)) seen.add(item);
        }
        return Array.from(seen);
    } catch {
        return [];
    }
}
