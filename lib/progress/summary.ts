/**
 * One session, reduced to the numbers the progress evidence compares
 * (docs/propuestas/05).
 *
 * Pure: no database, no judge, no network. The caller does the queries.
 *
 * NOTHING NEW IS MEASURED HERE. Every field is a roll-up of rows other modules
 * already wrote and already define: the behavioural signals come from
 * `lib/difficulty/signals.ts`, the question/answer pairing from
 * `lib/preparation/map.ts`, the rubric levels from `lib/feedback/rubric.ts`, and
 * the topic taxonomy from `lib/preparation/topics.ts`. If this file computed a
 * "questions answered" of its own, the progress view and the preparation map
 * could disagree about the very same transcript.
 */

import { summarizeSessionSignals, type SessionSignals } from '../difficulty/signals.ts';
import { normalizeRubricLevel, type RubricLevel } from '../feedback/rubric.ts';
import {
    buildQuestionAnswerPairs,
    type PreparationFeedbackRow,
    type PreparationTurnRow,
} from '../preparation/map.ts';
import { MASTERY_MIN_MEAN_LEVEL, meanContentLevel } from '../preparation/status.ts';
import { PREPARATION_TOPICS, type PreparationTopicId } from '../preparation/topics.ts';

/**
 * Content level at or above which an answer is counted as answered correctly in
 * an evidence sentence.
 *
 * Deliberately the same bar the preparation map uses to call a topic mastered
 * (`MASTERY_MIN_MEAN_LEVEL`): a defense is passed with correct answers, not with
 * perfect ones, and two screens of the same app must not disagree about what
 * "correcta" means.
 */
export const CORRECT_ANSWER_MIN_LEVEL = MASTERY_MIN_MEAN_LEVEL;

/**
 * Clarity level that counts as having connected the answer to the objectives or
 * the methodology. Level 3 of the clarity rubric says exactly that in words, so
 * the sentence the student reads is a restatement of the level, not an inference
 * drawn on top of it.
 */
export const STRUCTURED_ANSWER_LEVEL = 3;

/** A `turn_feedback` row as the progress modules read it. */
export interface ProgressFeedbackRow extends PreparationFeedbackRow {
    clarityLevel: number | null;
}

/** A `session_turns` row, with the start delay dimension 3 of the report reads. */
export interface ProgressTurnRow extends PreparationTurnRow {
    studentLatencyMs?: number | null;
}

/** A `voice_sessions` row, as the progress modules read it. */
export interface ProgressSessionRow {
    id: string;
    startedAt: Date;
    difficultyLevel: number;
    preSessionAnxiety: number | null;
    postSessionAnxiety: number | null;
    /** Topics the session was limited to. Empty for an ordinary full simulation. */
    focusTopics: PreparationTopicId[];
}

/** How a topic went in one session. */
export interface TopicTally {
    topicId: PreparationTopicId;
    name: string;
    asked: number;
    answered: number;
    /** Answers at or above `CORRECT_ANSWER_MIN_LEVEL`. */
    correct: number;
    /** Answers whose content verdict cites a fragment of the document. */
    cited: number;
}

export interface ProgressSessionSummary {
    sessionId: string;
    startedAt: Date;
    difficultyLevel: number;
    isFocused: boolean;
    preSessionAnxiety: number | null;
    postSessionAnxiety: number | null;
    // --- What the jury asked and what came back ------------------------------
    questionsAsked: number;
    questionsAnswered: number;
    /** Answers still waiting for the judge of the post-session report. */
    unevaluatedAnswers: number;
    // --- Behavioural signals (never judged, only counted) --------------------
    signals: SessionSignals;
    // --- Judged dimensions ---------------------------------------------------
    /** Mean 0-3 content level. Null when nothing was conclusive. */
    contentMeanLevel: number | null;
    contentN: number;
    clarityMeanLevel: number | null;
    clarityN: number;
    /** Answers at or above `CORRECT_ANSWER_MIN_LEVEL`. */
    correctAnswers: number;
    /** Answers whose content verdict cites a fragment of the document. */
    citedAnswers: number;
    /** Answers at clarity level `STRUCTURED_ANSWER_LEVEL`. */
    structuredAnswers: number;
    // --- Taxonomy ------------------------------------------------------------
    /** Topics the jury asked about in this session, in the order they came up. */
    topicsPracticed: PreparationTopicId[];
    /** Per-topic tallies, only for topics that were asked about. */
    topics: TopicTally[];
}

export interface ProgressSessionInput {
    session: ProgressSessionRow;
    turns: ReadonlyArray<ProgressTurnRow>;
    feedback: ReadonlyArray<ProgressFeedbackRow>;
}

/** Rate over a denominator, or null when the denominator is zero. */
export function rate(part: number, total: number): number | null {
    if (total <= 0) return null;
    return Math.round((part / total) * 10000) / 10000;
}

/**
 * Reduces one session. Turns of other sessions in the array are ignored, so the
 * caller may hand over the whole history unfiltered.
 */
export function summarizeProgressSession(input: ProgressSessionInput): ProgressSessionSummary {
    const turns = input.turns.filter((turn) => turn.sessionId === input.session.id);
    const feedbackByTurn = new Map(input.feedback.map((row) => [row.turnId, row]));
    const { pairs } = buildQuestionAnswerPairs(turns, feedbackByTurn);

    const answered = pairs.filter((pair) => pair.answerTurnId !== null);

    // Clarity is not carried by the pairing (the preparation map has no use for
    // it), so it is read back here from the same rows the pairing used.
    const clarityLevels: Array<RubricLevel | null> = answered.map((pair) =>
        normalizeRubricLevel(feedbackByTurn.get(pair.answerTurnId as string)?.clarityLevel ?? null),
    );

    const contentLevels = answered.map((pair) => pair.contentLevel);

    const tallies = new Map<PreparationTopicId, TopicTally>();
    for (const pair of pairs) {
        if (pair.topicId === null) continue;
        const tally = tallies.get(pair.topicId) ?? {
            topicId: pair.topicId,
            name: PREPARATION_TOPICS[pair.topicId].name,
            asked: 0,
            answered: 0,
            correct: 0,
            cited: 0,
        };
        tally.asked += 1;
        if (pair.answerTurnId !== null) {
            tally.answered += 1;
            if (pair.contentLevel !== null && pair.contentLevel >= CORRECT_ANSWER_MIN_LEVEL) {
                tally.correct += 1;
            }
            if (pair.isCited) tally.cited += 1;
        }
        tallies.set(pair.topicId, tally);
    }

    return {
        sessionId: input.session.id,
        startedAt: input.session.startedAt,
        difficultyLevel: input.session.difficultyLevel,
        isFocused: input.session.focusTopics.length > 0,
        preSessionAnxiety: input.session.preSessionAnxiety,
        postSessionAnxiety: input.session.postSessionAnxiety,
        questionsAsked: pairs.length,
        questionsAnswered: answered.length,
        unevaluatedAnswers: answered.filter((pair) => !pair.hasVerdict).length,
        signals: summarizeSessionSignals(turns),
        contentMeanLevel: meanContentLevel(contentLevels),
        contentN: contentLevels.filter((level) => level !== null).length,
        clarityMeanLevel: meanContentLevel(clarityLevels),
        clarityN: clarityLevels.filter((level) => level !== null).length,
        correctAnswers: answered.filter(
            (pair) => pair.contentLevel !== null && pair.contentLevel >= CORRECT_ANSWER_MIN_LEVEL,
        ).length,
        citedAnswers: answered.filter((pair) => pair.isCited).length,
        structuredAnswers: clarityLevels.filter((level) => level === STRUCTURED_ANSWER_LEVEL).length,
        topicsPracticed: Array.from(tallies.keys()),
        topics: Array.from(tallies.values()),
    };
}

/**
 * Reduces every session of a document, oldest first.
 *
 * Sessions with no turn at all are dropped: a call that never connected is not
 * practice and must not appear as a point on the progress chart.
 */
export function summarizeProgressSessions(
    sessions: ReadonlyArray<ProgressSessionRow>,
    turns: ReadonlyArray<ProgressTurnRow>,
    feedback: ReadonlyArray<ProgressFeedbackRow>,
): ProgressSessionSummary[] {
    const withTurns = new Set(turns.map((turn) => turn.sessionId));

    return sessions
        .filter((session) => withTurns.has(session.id))
        .slice()
        .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
        .map((session) => summarizeProgressSession({ session, turns, feedback }));
}
