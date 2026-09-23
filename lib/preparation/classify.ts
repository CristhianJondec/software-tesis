/**
 * Tags an agent question with the topic of the taxonomy it belongs to.
 *
 * WHY LEXICAL AND NOT AN LLM. Every question of every session has to carry a
 * topic, and the map is evidence for the results chapter. A judge call per turn
 * would cost money on every session, would not reproduce (the same transcript
 * could yield a different map next month) and could not be re-checked by hand.
 * This classifier is a pure function over a declared cue list: the same question
 * always lands on the same topic, and anyone can read `topics.ts` and verify why.
 *
 * The price is recall: a question phrased without any cue gets no topic instead
 * of a guessed one. That is the right failure — an untagged question is simply
 * not counted, while a wrongly tagged one would report the student as practised
 * on something they never discussed.
 *
 * Pure module: no database, no network.
 */

import {
    ORDERED_PREPARATION_TOPICS,
    type PreparationTopicId,
    type PreparationTopic,
} from './topics.ts';

/**
 * Lowercases, strips accents and 'ñ', and collapses everything that is not a
 * letter or a digit into single spaces. Cues are normalised with this same
 * function at module load, so they can be written naturally in `topics.ts`.
 */
export function normalizeForMatching(text: string): string {
    return text
        .normalize('NFD')
        // Combining marks: 'é' -> 'e', 'ñ' -> 'n'.
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function escapeForRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface CompiledCue {
    cue: string;
    /** Words in the cue. A multi-word cue is stronger evidence than a bare noun. */
    weight: number;
    pattern: RegExp;
}

interface CompiledTopic {
    topic: PreparationTopic;
    cues: CompiledCue[];
}

/**
 * Cues are matched as whole words, tolerating the Spanish plural: `instrumento`
 * matches "instrumentos", `conclusion` matches "conclusiones". Without this the
 * cue list would have to carry both forms of every noun and would drift.
 */
function compileCue(cue: string): CompiledCue {
    const normalized = normalizeForMatching(cue);
    return {
        cue: normalized,
        weight: normalized.split(' ').length,
        pattern: new RegExp(`(?:^| )${escapeForRegExp(normalized)}(?:es|s)?(?: |$)`),
    };
}

const COMPILED_TOPICS: CompiledTopic[] = ORDERED_PREPARATION_TOPICS.map((topic) => ({
    topic,
    // Longest cue first, so the redundancy check below always sees the specific
    // cue before the general one it contains. Without this, the verdict would
    // depend on the order the cues happen to be written in `topics.ts`.
    cues: topic.cues
        .map(compileCue)
        .sort((a, b) => b.weight - a.weight || b.cue.length - a.cue.length),
}));

export interface TopicClassification {
    /** Null when no cue matched: the question stays untagged rather than guessed. */
    topicId: PreparationTopicId | null;
    /** Sum of the weights of the cues that matched the winning topic. */
    score: number;
    /** The cues that produced the verdict, kept so a tag can be audited. */
    matched: string[];
}

export const EMPTY_CLASSIFICATION: TopicClassification = {
    topicId: null,
    score: 0,
    matched: [],
};

/**
 * Scores every topic and returns the strongest one.
 *
 * Ties are broken by the order of the taxonomy, which is the order of a thesis,
 * so a question that mentions both the problem and the objectives is filed under
 * the earlier one. Deterministic by construction: no randomness, no recency.
 */
export function classifyQuestionTopic(text: string): TopicClassification {
    const normalized = normalizeForMatching(text ?? '');
    if (!normalized) return EMPTY_CLASSIFICATION;

    // The pattern expects a space delimiter at both ends of a match.
    const haystack = ` ${normalized} `;

    let best: TopicClassification = EMPTY_CLASSIFICATION;

    for (const { topic, cues } of COMPILED_TOPICS) {
        let score = 0;
        const matched: string[] = [];

        for (const cue of cues) {
            if (!cue.pattern.test(haystack)) continue;
            // A cue contained in a longer cue that already matched adds nothing:
            // "muestra" inside "tamano de muestra" is the same evidence twice.
            if (matched.some((previous) => previous.includes(cue.cue))) continue;
            score += cue.weight;
            matched.push(cue.cue);
        }

        if (score > best.score) {
            best = { topicId: topic.id, score, matched };
        }
    }

    return best;
}

/** Convenience wrapper for callers that only store the id. */
export function classifyQuestionTopicId(text: string): PreparationTopicId | null {
    return classifyQuestionTopic(text).topicId;
}

/**
 * Every topic with at least one matching cue, strongest first.
 *
 * `classifyQuestionTopic` answers "which topic is this question about?", which
 * is the right question for a single jury question. A student writing what they
 * expect to be asked ("creo que me van a preguntar por la muestra y por el
 * instrumento") names several, and filing that sentence under one topic would
 * throw away half of the prediction (docs/propuestas/04).
 *
 * Ties keep the order of the taxonomy, like the single-topic classifier, so the
 * result is deterministic.
 */
export function classifyMentionedTopics(text: string): TopicClassification[] {
    const normalized = normalizeForMatching(text ?? '');
    if (!normalized) return [];

    const haystack = ` ${normalized} `;
    const found: TopicClassification[] = [];

    for (const { topic, cues } of COMPILED_TOPICS) {
        let score = 0;
        const matched: string[] = [];

        for (const cue of cues) {
            if (!cue.pattern.test(haystack)) continue;
            if (matched.some((previous) => previous.includes(cue.cue))) continue;
            score += cue.weight;
            matched.push(cue.cue);
        }

        if (score > 0) found.push({ topicId: topic.id, score, matched });
    }

    // Stable sort over a list already in taxonomy order: a tie keeps the order
    // of a thesis, the same rule `classifyQuestionTopic` uses to break ties.
    return found.sort((a, b) => b.score - a.score);
}

/** Convenience wrapper for callers that only store the ids. */
export function classifyMentionedTopicIds(text: string): PreparationTopicId[] {
    return classifyMentionedTopics(text)
        .map((classification) => classification.topicId)
        .filter((id): id is PreparationTopicId => id !== null);
}
