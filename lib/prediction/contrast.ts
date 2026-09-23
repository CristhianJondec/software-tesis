/**
 * Contrast between what the student predicted before a session and what the
 * records show happened in it (docs/propuestas/04).
 *
 * READ THIS BEFORE CHANGING ANYTHING HERE.
 *
 * 1. NO MODEL WRITES THESE SENTENCES. Every line below is arithmetic over rows
 *    already stored — `session_turns` (what was asked, what was answered) and
 *    `turn_feedback` (the rubric level of each answer). The acceptance criterion
 *    of the proposal is that the contrast uses real session data and not the
 *    estimate of an LLM; generating the prose deterministically is the strongest
 *    form of that guarantee, and it makes the contrast reproducible: the same
 *    session always yields the same text, and every number in it can be checked
 *    against the transcript.
 *
 * 2. THE PREDICTION IS QUOTED, NEVER CHARACTERISED. The student's own words come
 *    back verbatim next to the evidence. Nothing here may call a prediction
 *    wrong, exaggerated or unfounded, and nothing here may name what the student
 *    felt — that is rule 1 of docs/propuestas/00 and the fourth acceptance
 *    criterion of the proposal ("nunca ridiculiza ni dramatiza el temor
 *    declarado"). The words "ansiedad", "nervioso", "miedo" and their relatives
 *    must not appear in any sentence produced by this file; they may only ever
 *    appear inside the student's own quoted text.
 *
 * 3. AN ABSENCE OF DATA IS SAID, NOT FILLED IN. A topic nobody asked about is
 *    "no se preguntó", an unevaluated answer is "todavía no está evaluada", and
 *    a prediction no cue could match is reported as such instead of being filed
 *    under a guessed topic.
 *
 * Pure module: no database, no judge, no network. The caller does the queries.
 */

import { INCOMPLETE_ANSWER_MAX_WORDS, isRephraseRequest } from '../difficulty/signals.ts';
import {
    buildQuestionAnswerPairs,
    type PreparationFeedbackRow,
    type PreparationTurnRow,
    type QuestionAnswerPair,
} from '../preparation/map.ts';
import { meanContentLevel } from '../preparation/status.ts';
import { PREPARATION_TOPICS, type PreparationTopicId } from '../preparation/topics.ts';
import { PREDICTION_QUESTIONS, type PredictionQuestionId } from './questions.ts';

/** A `session_predictions` row, already narrowed by `questions.ts`. */
export interface StoredPrediction {
    expectedQuestions: string | null;
    expectedTopics: PreparationTopicId[];
    fearedPart: string | null;
    fearedTopic: PreparationTopicId | null;
    blankOutcome: string | null;
    nextStrategy: string | null;
    strategyAt: Date | null;
}

/**
 * How a prediction stands against the record.
 *
 * These are statements about EVENTS, never about the student: `matched` means
 * the predicted thing is in the transcript, not that the student was right to
 * expect it, and `not-observed` means it is not in the transcript, not that the
 * expectation was unfounded.
 */
export type ContrastVerdict =
    /** Everything the prediction named appears in the session. */
    | 'matched'
    /** Part of it appears. */
    | 'partial'
    /** None of it appears in this session. */
    | 'not-observed'
    /** The text matched no topic of the taxonomy: there is nothing to contrast. */
    | 'unmatched'
    /** The student did not answer this question before the session. */
    | 'skipped';

export const CONTRAST_VERDICT_LABEL: Record<ContrastVerdict, string> = {
    matched: 'Ocurrió',
    partial: 'Ocurrió en parte',
    'not-observed': 'No ocurrió',
    unmatched: 'Sin contraste automático',
    skipped: 'Sin predicción',
};

const NO_MATCH_SENTENCE =
    'Lo que escribiste no coincidió con ninguno de los temas de la sustentación que el sistema reconoce, así que no hay contraste automático para esta predicción.';

export interface TopicOutcome {
    topicId: PreparationTopicId;
    name: string;
    /** Questions of this session tagged with the topic. */
    asked: number;
    /** How many of them got an answer. */
    answered: number;
    /** 1-based position of each question in the transcript. */
    questionNumbers: number[];
    /** Answers with a conclusive content verdict. */
    evaluated: number;
    /** Mean 0-3 content level over those. Null when none was conclusive. */
    meanContentLevel: number | null;
}

export interface PredictionContrastItem {
    id: PredictionQuestionId;
    /** The question asked before the session, verbatim. */
    prompt: string;
    /** What the student wrote, verbatim. Null when skipped. */
    predicted: string | null;
    /** Factual sentences, each traceable to a stored row. */
    happened: string[];
    verdict: ContrastVerdict;
    verdictLabel: string;
    /** Topics behind the sentences, for items 1 and 2. Empty for item 3. */
    topics: TopicOutcome[];
}

export interface PredictionContrast {
    items: PredictionContrastItem[];
    /** Topics that were asked about and the student had not named. */
    unforeseenTopics: TopicOutcome[];
    /** The same topics as sentences, so the UI never writes prose of its own. */
    unforeseenNotes: string[];
    /** Questions the jury asked in this session, tagged or not. */
    questionsAsked: number;
    /** How many of them the student answered. */
    questionsAnswered: number;
    /** Answers with no verdict yet: the levels sharpen once they are evaluated. */
    unevaluatedAnswers: number;
    /** What the student declared they would try next, if they declared it. */
    nextStrategy: string | null;
    strategyAt: string | null;
    /** At least one of the three questions was answered before the session. */
    hasPrediction: boolean;
}

export interface PredictionContrastInput {
    prediction: StoredPrediction | null;
    turns: ReadonlyArray<PreparationTurnRow>;
    feedback: ReadonlyArray<PreparationFeedbackRow>;
}

// ============================================================================
// Spanish formatting helpers
// ============================================================================

/** "3", "3 y 5", "3, 5 y 8". */
function joinList(values: ReadonlyArray<string>): string {
    if (values.length === 0) return '';
    if (values.length === 1) return values[0];
    return `${values.slice(0, -1).join(', ')} y ${values[values.length - 1]}`;
}

function times(count: number): string {
    return count === 1 ? '1 vez' : `${count} veces`;
}

/** "2", "2,5", "2,33" — decimal comma, no trailing zeros. */
function formatLevel(value: number): string {
    return value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',');
}

function countWords(content: string): number {
    const trimmed = content.trim();
    return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

/** "(pregunta 3)" / "(preguntas 3 y 5)" / "" when nothing could be numbered. */
function whereAsked(
    pairs: ReadonlyArray<QuestionAnswerPair>,
    numbers: ReadonlyMap<string, number>,
): string {
    const found = pairs
        .map((pair) => numbers.get(pair.questionTurnId))
        .filter((value): value is number => value !== undefined);

    if (found.length === 0) return '';
    return ` (${found.length === 1 ? 'pregunta' : 'preguntas'} ${joinList(found.map(String))})`;
}

// ============================================================================
// Evidence
// ============================================================================

/**
 * Question numbers as the student would count them in the transcript, including
 * questions no cue could tag. Numbering only the tagged ones would print
 * "pregunta 3" next to what the transcript shows as the fifth intervention.
 */
function numberQuestions(pairs: ReadonlyArray<QuestionAnswerPair>): Map<string, number> {
    const numbers = new Map<string, number>();
    pairs.forEach((pair, index) => numbers.set(pair.questionTurnId, index + 1));
    return numbers;
}

function outcomeOf(
    topicId: PreparationTopicId,
    pairs: ReadonlyArray<QuestionAnswerPair>,
    numbers: ReadonlyMap<string, number>,
): TopicOutcome {
    const topicPairs = pairs.filter((pair) => pair.topicId === topicId);
    const answered = topicPairs.filter((pair) => pair.answerTurnId !== null);
    const levels = answered.map((pair) => pair.contentLevel);

    return {
        topicId,
        name: PREPARATION_TOPICS[topicId].name,
        asked: topicPairs.length,
        answered: answered.length,
        questionNumbers: topicPairs
            .map((pair) => numbers.get(pair.questionTurnId))
            .filter((value): value is number => value !== undefined),
        evaluated: levels.filter((level) => level !== null).length,
        meanContentLevel: meanContentLevel(levels),
    };
}

/** One sentence per topic: was it asked, was it answered, how was it judged. */
function describeOutcome(
    outcome: TopicOutcome,
    pairs: ReadonlyArray<QuestionAnswerPair>,
    numbers: ReadonlyMap<string, number>,
): string {
    if (outcome.asked === 0) {
        return `${outcome.name}: no se preguntó en esta sesión.`;
    }

    const where = whereAsked(
        pairs.filter((pair) => pair.topicId === outcome.topicId),
        numbers,
    );

    let answered: string;
    if (outcome.answered === 0) {
        answered = outcome.asked === 1 ? ' Quedó sin responder.' : ' Quedaron sin responder.';
    } else if (outcome.answered === outcome.asked) {
        answered = outcome.asked === 1 ? ' La respondiste.' : ' Las respondiste todas.';
    } else {
        answered = ` Respondiste ${outcome.answered} de ${outcome.asked}.`;
    }

    let level = '';
    if (outcome.evaluated > 0 && outcome.meanContentLevel !== null) {
        level =
            outcome.evaluated === 1
                ? ` El contenido de esa respuesta quedó en ${formatLevel(outcome.meanContentLevel)} de 3.`
                : ` El contenido de esas ${outcome.evaluated} respuestas quedó en ${formatLevel(
                      outcome.meanContentLevel,
                  )} de 3 en promedio.`;
    } else if (outcome.answered > 0) {
        level =
            outcome.answered === 1
                ? ' Esa respuesta todavía no está evaluada.'
                : ' Esas respuestas todavía no están evaluadas.';
    }

    return `${outcome.name}: se preguntó ${times(outcome.asked)}${where}.${answered}${level}`;
}

// ============================================================================
// The three contrasts
// ============================================================================

function baseItem(id: PredictionQuestionId, predicted: string | null): PredictionContrastItem {
    return {
        id,
        prompt: PREDICTION_QUESTIONS[id].prompt,
        predicted,
        happened: [],
        verdict: 'skipped',
        verdictLabel: CONTRAST_VERDICT_LABEL.skipped,
        topics: [],
    };
}

function withVerdict(
    item: PredictionContrastItem,
    verdict: ContrastVerdict,
    happened: string[],
    topics: TopicOutcome[] = [],
): PredictionContrastItem {
    return { ...item, verdict, verdictLabel: CONTRAST_VERDICT_LABEL[verdict], happened, topics };
}

function contrastExpectedQuestions(
    prediction: StoredPrediction,
    pairs: ReadonlyArray<QuestionAnswerPair>,
    numbers: ReadonlyMap<string, number>,
): PredictionContrastItem {
    const item = baseItem('expectedQuestions', prediction.expectedQuestions);
    if (prediction.expectedQuestions === null) return item;
    if (prediction.expectedTopics.length === 0) {
        return withVerdict(item, 'unmatched', [NO_MATCH_SENTENCE]);
    }

    const topics = prediction.expectedTopics.map((topicId) => outcomeOf(topicId, pairs, numbers));
    const asked = topics.filter((topic) => topic.asked > 0).length;
    const verdict: ContrastVerdict =
        asked === topics.length ? 'matched' : asked === 0 ? 'not-observed' : 'partial';

    return withVerdict(
        item,
        verdict,
        topics.map((topic) => describeOutcome(topic, pairs, numbers)),
        topics,
    );
}

function contrastFearedPart(
    prediction: StoredPrediction,
    pairs: ReadonlyArray<QuestionAnswerPair>,
    numbers: ReadonlyMap<string, number>,
): PredictionContrastItem {
    const item = baseItem('fearedPart', prediction.fearedPart);
    if (prediction.fearedPart === null) return item;
    if (prediction.fearedTopic === null) {
        return withVerdict(item, 'unmatched', [NO_MATCH_SENTENCE]);
    }

    const outcome = outcomeOf(prediction.fearedTopic, pairs, numbers);

    return withVerdict(
        item,
        outcome.asked > 0 ? 'matched' : 'not-observed',
        [describeOutcome(outcome, pairs, numbers)],
        [outcome],
    );
}

/**
 * Prediction 3 is not about a topic: it is about what happens when an answer
 * does not come out. So it is contrasted against two facts of the transcript —
 * whether any question went unanswered or was answered in a fragment, and what
 * the session did afterwards.
 *
 * The "afterwards" sentence carries the evidence the student could not have had
 * in advance: a session that kept going after an unanswered question. It is
 * stated as a count of questions, never as reassurance.
 */
function contrastBlankOutcome(
    prediction: StoredPrediction,
    pairs: ReadonlyArray<QuestionAnswerPair>,
    numbers: ReadonlyMap<string, number>,
): PredictionContrastItem {
    const item = baseItem('blankOutcome', prediction.blankOutcome);
    if (prediction.blankOutcome === null) return item;

    const unanswered = pairs.filter((pair) => pair.answerTurnId === null);
    // Same criterion as `lib/difficulty/signals.ts`: a fragment of an answer,
    // excluding turns where the student asked for the question again.
    const incomplete = pairs.filter(
        (pair) =>
            pair.answer !== null &&
            !isRephraseRequest(pair.answer) &&
            countWords(pair.answer) < INCOMPLETE_ANSWER_MAX_WORDS,
    );

    if (unanswered.length === 0 && incomplete.length === 0) {
        return withVerdict(item, 'not-observed', [
            `No hubo preguntas sin responder en esta sesión: respondiste las ${pairs.length}.`,
            `Ninguna de tus respuestas quedó en menos de ${INCOMPLETE_ANSWER_MAX_WORDS} palabras.`,
        ]);
    }

    const happened: string[] = [];

    if (unanswered.length > 0) {
        const where = whereAsked(unanswered, numbers);
        happened.push(
            unanswered.length === 1
                ? `Hubo 1 pregunta que quedó sin respuesta${where}.`
                : `Hubo ${unanswered.length} preguntas que quedaron sin respuesta${where}.`,
        );
    }

    if (incomplete.length > 0) {
        const where = whereAsked(incomplete, numbers);
        happened.push(
            incomplete.length === 1
                ? `Hubo 1 respuesta de menos de ${INCOMPLETE_ANSWER_MAX_WORDS} palabras${where}.`
                : `Hubo ${incomplete.length} respuestas de menos de ${INCOMPLETE_ANSWER_MAX_WORDS} palabras${where}.`,
        );
    }

    // What the session did after the first of those moments.
    const positions = [...unanswered, ...incomplete]
        .map((pair) => pairs.indexOf(pair))
        .filter((index) => index >= 0);
    const after = pairs.slice(Math.min(...positions) + 1);
    const answeredAfter = after.filter((pair) => pair.answerTurnId !== null).length;

    happened.push(
        after.length === 0
            ? 'Esa fue la última pregunta de la sesión.'
            : `Después de eso la sesión continuó: el jurado hizo ${after.length} ${
                  after.length === 1 ? 'pregunta más' : 'preguntas más'
              } y respondiste ${answeredAfter} de ${after.length}.`,
    );

    return withVerdict(item, 'matched', happened);
}

// ============================================================================
// Entry point
// ============================================================================

export function buildPredictionContrast(input: PredictionContrastInput): PredictionContrast {
    const feedbackByTurn = new Map(input.feedback.map((row) => [row.turnId, row]));
    const { pairs } = buildQuestionAnswerPairs(input.turns, feedbackByTurn);
    const numbers = numberQuestions(pairs);

    const answeredPairs = pairs.filter((pair) => pair.answerTurnId !== null);
    const prediction = input.prediction;

    const contrast: PredictionContrast = {
        items: [],
        unforeseenTopics: [],
        unforeseenNotes: [],
        questionsAsked: pairs.length,
        questionsAnswered: answeredPairs.length,
        unevaluatedAnswers: answeredPairs.filter((pair) => !pair.hasVerdict).length,
        nextStrategy: prediction?.nextStrategy ?? null,
        strategyAt: prediction?.strategyAt?.toISOString() ?? null,
        hasPrediction: false,
    };

    if (!prediction) return contrast;

    contrast.items = [
        contrastExpectedQuestions(prediction, pairs, numbers),
        contrastFearedPart(prediction, pairs, numbers),
        contrastBlankOutcome(prediction, pairs, numbers),
    ];

    contrast.hasPrediction =
        prediction.expectedQuestions !== null ||
        prediction.fearedPart !== null ||
        prediction.blankOutcome !== null;

    // Topics the session pressed on that the student had not named. Reported
    // only when there was something to compare against, and never as a
    // reproach: it is the list of what to expect next time.
    if (prediction.expectedQuestions !== null) {
        const named = new Set<PreparationTopicId>(prediction.expectedTopics);
        if (prediction.fearedTopic) named.add(prediction.fearedTopic);

        const unforeseen = new Set<PreparationTopicId>();
        for (const pair of pairs) {
            if (pair.topicId !== null && !named.has(pair.topicId)) unforeseen.add(pair.topicId);
        }

        contrast.unforeseenTopics = Array.from(unforeseen).map((topicId) =>
            outcomeOf(topicId, pairs, numbers),
        );
        contrast.unforeseenNotes = contrast.unforeseenTopics.map((topic) =>
            describeOutcome(topic, pairs, numbers),
        );
    }

    return contrast;
}
