/**
 * Assembles the preparation map: one state per topic of the taxonomy, with the
 * pages of the document behind it and the questions worth practising again.
 *
 * This is NOT a summary of the document. The unit of analysis is the student's
 * performance: a topic is read through the questions that were asked about it,
 * the answers that were given, and the verdicts stored for those answers
 * (docs/propuestas/02). What the document contains only decides whether a topic
 * is answerable at all — the fourth state.
 *
 * Pure: no database, no judge, no network. The caller does the queries.
 */

import { normalizeRubricLevel, type RubricLevel } from '../feedback/rubric.ts';
import { classifyQuestionTopicId } from './classify.ts';
import type { StoredTopicCoverage } from './coverage.ts';
import {
    meanContentLevel,
    resolveTopicState,
    selectWeakTopics,
    type PreparationState,
    type TopicEvidence,
} from './status.ts';
import {
    ORDERED_PREPARATION_TOPICS,
    PREPARATION_TOPIC_IDS,
    isPreparationTopicId,
    type PreparationTopic,
    type PreparationTopicId,
} from './topics.ts';

/** Review questions kept per topic. Enough to practise, short enough to read. */
const MAX_REVIEW_QUESTIONS_PER_TOPIC = 5;

export interface PreparationTurnRow {
    id: string;
    sessionId: string;
    turnIndex: number;
    role: string;
    content: string;
    /** `session_turns.topic`, written when the question was persisted. */
    topic: string | null;
    startedAt: Date;
}

export interface PreparationSessionRow {
    id: string;
    startedAt: Date;
    difficultyLevel: number;
}

export interface PreparationFeedbackRow {
    turnId: string;
    contentLevel: number | null;
    contentSegmentId: string | null;
}

export interface PreparationMapInput {
    coverage: ReadonlyArray<StoredTopicCoverage>;
    sessions: ReadonlyArray<PreparationSessionRow>;
    turns: ReadonlyArray<PreparationTurnRow>;
    feedback: ReadonlyArray<PreparationFeedbackRow>;
}

export type ReviewReason = 'unanswered' | 'ungrounded' | 'below-mastery' | 'unevaluated';

export interface PreparationReviewQuestion {
    questionTurnId: string;
    sessionId: string;
    askedAt: string;
    question: string;
    /** The student's answer, when there was one. */
    answer: string | null;
    contentLevel: RubricLevel | null;
    reason: ReviewReason;
}

export interface PreparationTopicHistoryPoint {
    sessionId: string;
    startedAt: string;
    state: PreparationState;
    questionsAsked: number;
}

export interface PreparationTopicEntry {
    topic: PreparationTopic;
    state: PreparationState;
    // --- What the document has --------------------------------------------
    covered: boolean;
    pages: number[];
    matchedSegments: number;
    bestDistance: number | null;
    // --- What the student did ---------------------------------------------
    questionsAsked: number;
    answersGiven: number;
    /** Answers with a conclusive content verdict. */
    conclusiveAnswers: number;
    /** Answers still waiting for the judge of the post-session report. */
    unevaluatedAnswers: number;
    meanContentLevel: number | null;
    citedAnswers: number;
    lastPracticedAt: string | null;
    reviewQuestions: PreparationReviewQuestion[];
    history: PreparationTopicHistoryPoint[];
}

export interface PreparationMap {
    topics: PreparationTopicEntry[];
    counts: Record<PreparationState, number>;
    /** Topics a focused session can practise: partial first, then unpracticed. */
    weakTopics: PreparationTopicId[];
    /** Sessions with at least one turn that the map was built from. */
    sessions: Array<{ id: string; startedAt: string; difficultyLevel: number }>;
    /** Answers with no verdict yet: the map sharpens once they are evaluated. */
    unevaluatedAnswers: number;
    /** Agent questions no cue could tag. They are counted nowhere else. */
    untaggedQuestions: number;
    /** Null when the document has never been analysed. */
    coverageComputedAt: string | null;
}

export interface QuestionAnswerPair {
    sessionId: string;
    questionTurnId: string;
    question: string;
    askedAt: Date;
    topicId: PreparationTopicId | null;
    answerTurnId: string | null;
    answer: string | null;
    contentLevel: RubricLevel | null;
    hasVerdict: boolean;
    isCited: boolean;
}

/**
 * The stored tag wins; an untagged question is classified on read.
 *
 * Rows written before the column existed, or by a session that failed to tag,
 * would otherwise be invisible to the map. Re-running the classifier costs
 * nothing and is the same pure function that wrote the column.
 */
function topicOfQuestion(turn: PreparationTurnRow): PreparationTopicId | null {
    if (isPreparationTopicId(turn.topic)) return turn.topic;
    return classifyQuestionTopicId(turn.content);
}

/**
 * Pairs every agent question with the student answer that followed it.
 *
 * Same anchoring rule as `lib/feedback/cases.ts`: the answer to a question is the
 * next student turn before the agent speaks again. A question with no such turn
 * was not answered — which is evidence, not a missing row.
 *
 * Exported because `lib/prediction/contrast.ts` reads the same session through
 * the same pairing. Two modules deciding on their own what answered what would
 * let the preparation map and the prediction contrast disagree about the very
 * same transcript.
 */
export function buildQuestionAnswerPairs(
    turns: ReadonlyArray<PreparationTurnRow>,
    feedbackByTurn: ReadonlyMap<string, PreparationFeedbackRow>,
): { pairs: QuestionAnswerPair[]; untaggedQuestions: number } {
    const bySession = new Map<string, PreparationTurnRow[]>();
    for (const turn of turns) {
        const list = bySession.get(turn.sessionId);
        if (list) list.push(turn);
        else bySession.set(turn.sessionId, [turn]);
    }

    const pairs: QuestionAnswerPair[] = [];
    let untaggedQuestions = 0;

    for (const list of bySession.values()) {
        list.sort((a, b) => a.turnIndex - b.turnIndex);

        list.forEach((turn, position) => {
            if (turn.role !== 'assistant') return;

            const topicId = topicOfQuestion(turn);
            // An untagged question is still a question the student was asked:
            // it is counted here and kept in the output, so a caller that reads
            // the session as a whole (`lib/prediction/contrast.ts`) sees every
            // question. The map itself files pairs by topic and skips these.
            if (topicId === null) untaggedQuestions++;

            // First student turn after the question, stopping at the next question.
            let answer: PreparationTurnRow | null = null;
            for (let i = position + 1; i < list.length; i++) {
                if (list[i].role === 'assistant') break;
                if (list[i].role === 'user') {
                    answer = list[i];
                    break;
                }
            }

            const verdict = answer ? feedbackByTurn.get(answer.id) : undefined;
            const contentLevel = normalizeRubricLevel(verdict?.contentLevel ?? null);

            pairs.push({
                sessionId: turn.sessionId,
                questionTurnId: turn.id,
                question: turn.content,
                askedAt: turn.startedAt,
                topicId,
                answerTurnId: answer?.id ?? null,
                answer: answer?.content ?? null,
                contentLevel,
                hasVerdict: Boolean(verdict),
                isCited: contentLevel !== null && Boolean(verdict?.contentSegmentId),
            });
        });
    }

    pairs.sort((a, b) => a.askedAt.getTime() - b.askedAt.getTime());

    return { pairs, untaggedQuestions };
}

function evidenceOf(pairs: ReadonlyArray<QuestionAnswerPair>, covered: boolean): TopicEvidence {
    const answered = pairs.filter((pair) => pair.answerTurnId !== null);
    return {
        covered,
        questionsAsked: pairs.length,
        answersGiven: answered.length,
        contentLevels: answered.map((pair) => pair.contentLevel),
        citedAnswers: answered.filter((pair) => pair.isCited).length,
    };
}

/** Why a question is worth practising again, or null when it is not. */
function reviewReason(pair: QuestionAnswerPair): ReviewReason | null {
    if (pair.answerTurnId === null) return 'unanswered';
    if (!pair.hasVerdict) return 'unevaluated';
    if (pair.contentLevel === null) return 'ungrounded';
    if (pair.contentLevel < 2) return 'below-mastery';
    return null;
}

export function buildPreparationMap(input: PreparationMapInput): PreparationMap {
    const coverageByTopic = new Map(input.coverage.map((row) => [row.topicId, row]));
    const feedbackByTurn = new Map(input.feedback.map((row) => [row.turnId, row]));
    const { pairs, untaggedQuestions } = buildQuestionAnswerPairs(input.turns, feedbackByTurn);

    const pairsByTopic = new Map<PreparationTopicId, QuestionAnswerPair[]>();
    for (const pair of pairs) {
        if (pair.topicId === null) continue;
        const list = pairsByTopic.get(pair.topicId);
        if (list) list.push(pair);
        else pairsByTopic.set(pair.topicId, [pair]);
    }

    // Sessions that actually produced turns, oldest first: the evolution of the
    // map is read left to right as "sesión 1, sesión 2, sesión 3".
    const sessionsWithTurns = new Set(input.turns.map((turn) => turn.sessionId));
    const sessions = input.sessions
        .filter((session) => sessionsWithTurns.has(session.id))
        .slice()
        .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());

    const states = new Map<PreparationTopicId, PreparationState>();

    const topics: PreparationTopicEntry[] = ORDERED_PREPARATION_TOPICS.map((topic) => {
        const coverage = coverageByTopic.get(topic.id);
        const covered = coverage?.covered ?? false;
        const topicPairs = pairsByTopic.get(topic.id) ?? [];
        const evidence = evidenceOf(topicPairs, covered);
        const state = resolveTopicState(evidence);
        states.set(topic.id, state);

        const answered = topicPairs.filter((pair) => pair.answerTurnId !== null);
        const lastPractised = topicPairs.at(-1)?.askedAt ?? null;

        const reviewQuestions: PreparationReviewQuestion[] = topicPairs
            .map((pair) => {
                const reason = reviewReason(pair);
                if (!reason) return null;
                return {
                    questionTurnId: pair.questionTurnId,
                    sessionId: pair.sessionId,
                    askedAt: pair.askedAt.toISOString(),
                    question: pair.question,
                    answer: pair.answer,
                    contentLevel: pair.contentLevel,
                    reason,
                } satisfies PreparationReviewQuestion;
            })
            .filter((question): question is PreparationReviewQuestion => question !== null)
            // Newest first: the last attempt is the one worth revisiting.
            .reverse()
            .slice(0, MAX_REVIEW_QUESTIONS_PER_TOPIC);

        const history: PreparationTopicHistoryPoint[] = sessions.map((session) => {
            const sessionPairs = topicPairs.filter((pair) => pair.sessionId === session.id);
            return {
                sessionId: session.id,
                startedAt: session.startedAt.toISOString(),
                state: resolveTopicState(evidenceOf(sessionPairs, covered)),
                questionsAsked: sessionPairs.length,
            };
        });

        return {
            topic,
            state,
            covered,
            pages: coverage?.pages ?? [],
            matchedSegments: coverage?.matchedSegments ?? 0,
            bestDistance: coverage?.bestDistance ?? null,
            questionsAsked: evidence.questionsAsked,
            answersGiven: evidence.answersGiven,
            conclusiveAnswers: answered.filter((pair) => pair.contentLevel !== null).length,
            unevaluatedAnswers: answered.filter((pair) => !pair.hasVerdict).length,
            meanContentLevel: meanContentLevel(evidence.contentLevels),
            citedAnswers: evidence.citedAnswers,
            lastPracticedAt: lastPractised ? lastPractised.toISOString() : null,
            reviewQuestions,
            history,
        };
    });

    const counts: Record<PreparationState, number> = {
        mastered: 0,
        partial: 0,
        unpracticed: 0,
        gap: 0,
    };
    for (const entry of topics) counts[entry.state]++;

    const computedAt = input.coverage
        .map((row) => row.computedAt.getTime())
        .sort((a, b) => b - a)[0];

    return {
        topics,
        counts,
        weakTopics: selectWeakTopics(states, PREPARATION_TOPIC_IDS),
        sessions: sessions.map((session) => ({
            id: session.id,
            startedAt: session.startedAt.toISOString(),
            difficultyLevel: session.difficultyLevel,
        })),
        unevaluatedAnswers: topics.reduce((total, entry) => total + entry.unevaluatedAnswers, 0),
        untaggedQuestions,
        coverageComputedAt: computedAt ? new Date(computedAt).toISOString() : null,
    };
}
