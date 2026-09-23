/**
 * Assembles the post-session report the student reads.
 *
 * Pure: no database, no judge. It takes the cases, whatever verdicts are already
 * stored, and the turn timings, and returns the three dimensions kept separate.
 *
 * THE THREE DIMENSIONS ARE NEVER FUSED. There is no overall grade in this file
 * and none must be added: the point of the report is that a student can be
 * accurate but disorganised, or fluent but wrong, and see which is which. A
 * single number would hide exactly what the feedback exists to show.
 */

import type { AnswerCase } from './cases.ts';
import {
    observeTurn,
    summarizeObservations,
    type ObservationSummary,
    type ObservationTurn,
    type TurnObservations,
} from './observations.ts';
import {
    levelToScore,
    normalizeRubricLevel,
    summarizeDimension,
    type DimensionSummary,
    type RubricLevel,
} from './rubric.ts';

/** A `turn_feedback` row, as the database hands it over. */
export interface StoredFeedbackRow {
    turnId: string;
    contentLevel: number | null;
    contentJustification: string | null;
    contentSegmentId: string | null;
    clarityLevel: number | null;
    clarityJustification: string | null;
}

export interface SegmentRow {
    id: string;
    content: string;
    pageNumber: number | null;
}

/** Timing of a student turn, for dimension 3. */
export interface ReportTurnRow extends ObservationTurn {
    id: string;
}

export interface CitedSegment {
    segmentId: string;
    content: string;
    pageNumber: number | null;
}

export interface JudgedDimension {
    level: RubricLevel | null;
    /** Level normalised to [0, 1]. Null when the dimension was not conclusive. */
    score: number | null;
    justification: string | null;
}

export interface TurnReportItem {
    answerTurnId: string;
    turnIndex: number;
    question: string | null;
    answer: string;
    /** Dimension 1. `citedSegment` is null exactly when the level is null. */
    content: JudgedDimension & { citedSegment: CitedSegment | null };
    /** Dimension 2. */
    clarity: JudgedDimension;
    /** Dimension 3: counted, not judged. */
    observations: TurnObservations;
    /** No verdict stored yet for this turn at the current prompt version. */
    isPending: boolean;
    /** Had a question but no retrieved fragment: content can never be judged. */
    lacksContext: boolean;
    /** Followed no question of the jury. */
    isUnprompted: boolean;
}

export interface FeedbackCoverage {
    /** Student answers in the session. */
    answers: number;
    /** Answers with a stored verdict at the current prompt version. */
    evaluated: number;
    /** Answers that could be judged but have no verdict yet. */
    pending: number;
    /** Answers with a question but no retrieved fragment. */
    withoutContext: number;
    /** Answers that followed no question. */
    unprompted: number;
}

export interface SessionFeedbackReport {
    turns: TurnReportItem[];
    /** Dimension 1 over the session. */
    content: DimensionSummary;
    /** Dimension 2 over the session. */
    clarity: DimensionSummary;
    /** Dimension 3 over the session. */
    observations: ObservationSummary;
    coverage: FeedbackCoverage;
}

export interface SessionFeedbackInput {
    cases: ReadonlyArray<AnswerCase>;
    turns: ReadonlyArray<ReportTurnRow>;
    feedback: ReadonlyArray<StoredFeedbackRow>;
    segments: ReadonlyArray<SegmentRow>;
}

const EMPTY_OBSERVATION: ObservationTurn = {
    startedAt: 0,
    endedAt: 0,
    content: '',
};

export function buildSessionFeedbackReport(input: SessionFeedbackInput): SessionFeedbackReport {
    const feedbackByTurn = new Map(input.feedback.map((row) => [row.turnId, row]));
    const turnsById = new Map(input.turns.map((turn) => [turn.id, turn]));
    const segmentsById = new Map(input.segments.map((segment) => [segment.id, segment]));

    const items: TurnReportItem[] = input.cases.map((answerCase) => {
        const stored = feedbackByTurn.get(answerCase.answerTurnId);
        const contentLevel = normalizeRubricLevel(stored?.contentLevel ?? null);
        const clarityLevel = normalizeRubricLevel(stored?.clarityLevel ?? null);

        // The citation is only shown when it backs a level that survived
        // validation, and only when the segment is still in the document.
        const citedSegment =
            contentLevel !== null && stored?.contentSegmentId
                ? (segmentsById.get(stored.contentSegmentId) ?? null)
                : null;

        const lacksContext = !answerCase.isUnprompted && answerCase.contexts.length === 0;

        return {
            answerTurnId: answerCase.answerTurnId,
            turnIndex: answerCase.turnIndex,
            question: answerCase.question,
            answer: answerCase.answer,
            content: {
                level: contentLevel,
                score: levelToScore(contentLevel),
                justification: contentLevel === null ? null : (stored?.contentJustification ?? null),
                citedSegment: citedSegment
                    ? {
                          segmentId: citedSegment.id,
                          content: citedSegment.content,
                          pageNumber: citedSegment.pageNumber,
                      }
                    : null,
            },
            clarity: {
                level: clarityLevel,
                score: levelToScore(clarityLevel),
                justification: clarityLevel === null ? null : (stored?.clarityJustification ?? null),
            },
            observations: observeTurn(turnsById.get(answerCase.answerTurnId) ?? EMPTY_OBSERVATION),
            isPending: !stored,
            lacksContext,
            isUnprompted: answerCase.isUnprompted,
        };
    });

    // Only evaluated turns enter the dimension averages. A turn nobody has judged
    // yet is not an inconclusive judgement — it is the absence of one, and
    // counting it would move the mean every time the batch advances.
    const evaluated = items.filter((item) => !item.isPending);

    return {
        turns: items,
        content: summarizeDimension(evaluated.map((item) => item.content.level)),
        clarity: summarizeDimension(evaluated.map((item) => item.clarity.level)),
        observations: summarizeObservations(items.map((item) => item.observations)),
        coverage: {
            answers: items.length,
            evaluated: evaluated.length,
            pending: items.filter(
                (item) => item.isPending && !item.isUnprompted && !item.lacksContext,
            ).length,
            withoutContext: items.filter((item) => item.lacksContext).length,
            unprompted: items.filter((item) => item.isUnprompted).length,
        },
    };
}
