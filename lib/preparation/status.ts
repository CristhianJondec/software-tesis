/**
 * The four states of the preparation map, and the rule that assigns one.
 *
 * The states are mutually exclusive and resolved in a fixed order, because two
 * of them can be true of the same topic at once and the priority is what makes
 * the map honest:
 *
 *   1. gap         — the document has nothing for this topic. Checked FIRST: a
 *                    topic the student answered well from memory is still a gap
 *                    if the thesis cannot back it, and that is precisely what
 *                    the jury will find.
 *   2. unpracticed — covered by the document, never asked in any session.
 *   3. mastered    — answered at level >= MASTERY_MIN_MEAN_LEVEL on average, with
 *                    at least one verdict anchored to a fragment of the document.
 *   4. partial     — everything else: answered but incomplete, or answered
 *                    without the judge being able to anchor it.
 *
 * `partial` is the fallback on purpose. When the evidence does not clear the bar
 * for "domina", the map says "parcial" — it never promotes a topic on thin
 * evidence, and it never reports a topic as failed either.
 *
 * Pure module: no database, no network.
 */

import type { RubricLevel } from '../feedback/rubric.ts';
import type { PreparationTopicId } from './topics.ts';

export const PREPARATION_STATES = ['mastered', 'partial', 'unpracticed', 'gap'] as const;

export type PreparationState = (typeof PREPARATION_STATES)[number];

/**
 * Mean rubric level (0-3, `lib/feedback/rubric.ts`) a topic must reach to count
 * as mastered. Level 2 is "responde correctamente, pero de forma parcial": the
 * bar is set there and not at 3 because a defense is passed with correct answers,
 * not with perfect ones. Reported in the thesis alongside the map.
 */
export const MASTERY_MIN_MEAN_LEVEL = 2;

export const PREPARATION_STATE_COPY: Record<
    PreparationState,
    { name: string; description: string }
> = {
    mastered: {
        name: 'Domina',
        description: 'Respondiste correctamente y con respaldo de tu documento.',
    },
    partial: {
        name: 'Parcial',
        description: 'Respondiste, pero de forma incompleta o sin anclarlo a tu documento.',
    },
    unpracticed: {
        name: 'No practicado',
        description: 'El tema está en tu documento, pero nunca te lo preguntaron.',
    },
    gap: {
        name: 'Hueco en el documento',
        description: 'Tu documento no tiene con qué responder si el jurado pregunta esto.',
    },
};

export interface TopicEvidence {
    /** From `book_topic_coverage`: the retriever found fragments for the topic. */
    covered: boolean;
    /** Agent questions tagged with this topic across every session. */
    questionsAsked: number;
    /** Student answers to those questions. */
    answersGiven: number;
    /** Content rubric levels of those answers. Null = the judge was not conclusive. */
    contentLevels: ReadonlyArray<RubricLevel | null>;
    /** Answers whose content verdict cites a fragment of the document. */
    citedAnswers: number;
}

export const EMPTY_TOPIC_EVIDENCE: TopicEvidence = {
    covered: false,
    questionsAsked: 0,
    answersGiven: 0,
    contentLevels: [],
    citedAnswers: 0,
};

/** Mean of the conclusive levels. Null when nothing was conclusive. */
export function meanContentLevel(levels: ReadonlyArray<RubricLevel | null>): number | null {
    const measured = levels.filter((level): level is RubricLevel => level !== null);
    if (measured.length === 0) return null;
    const sum = measured.reduce<number>((total, level) => total + level, 0);
    return Math.round((sum / measured.length) * 100) / 100;
}

export function resolveTopicState(evidence: TopicEvidence): PreparationState {
    if (!evidence.covered) return 'gap';
    if (evidence.questionsAsked === 0) return 'unpracticed';

    // Asked but never answered is practice that went badly, not absence of
    // practice: it stays out of 'unpracticed' on purpose.
    const mean = meanContentLevel(evidence.contentLevels);
    if (mean === null) return 'partial';

    // The citation requirement is the "con respaldo del documento" half of the
    // definition. A level with no fragment behind it cannot promote a topic,
    // even when the judge liked the answer.
    if (mean >= MASTERY_MIN_MEAN_LEVEL && evidence.citedAnswers > 0) return 'mastered';

    return 'partial';
}

/**
 * Topics a focused session can actually practise.
 *
 * Gaps are excluded deliberately: with nothing retrievable, the agent would have
 * to either stay silent or invent the content, and inventing is forbidden by the
 * anchoring rule of the prompt. A gap is fixed by editing the thesis, not by
 * practising it. Order follows the state ranking, weakest evidence first.
 */
export function selectWeakTopics(
    states: ReadonlyMap<PreparationTopicId, PreparationState>,
    order: ReadonlyArray<PreparationTopicId>,
): PreparationTopicId[] {
    const partial = order.filter((id) => states.get(id) === 'partial');
    const unpracticed = order.filter((id) => states.get(id) === 'unpracticed');
    return [...partial, ...unpracticed];
}
