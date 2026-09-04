/**
 * PR — Precisión de Respuestas = (Rc / Rt) × 100
 *
 * Rc: agent turns a human marked as correct.
 * Rt: agent turns a human actually reviewed.
 *
 * Turns nobody has reviewed are NOT part of Rt. Counting them as incorrect
 * would understate the system, counting them as correct would inflate it; both
 * would report a judgement no human made. They are reported separately as
 * `pending`, and PR is null until at least one turn is reviewed.
 *
 * Pure module: no database, no imports.
 */

export interface PrecisionInput {
    /** Every agent turn eligible for review. */
    totalAgentTurns: number;
    /** Turns with a verdict recorded (Rt). */
    reviewed: number;
    /** Turns whose verdict is "correct" (Rc). */
    correct: number;
}

export interface PrecisionResult {
    /** Rc */
    correct: number;
    /** Rt */
    reviewed: number;
    incorrect: number;
    /** Agent turns still waiting for a verdict. Report it next to PR, always. */
    pending: number;
    totalAgentTurns: number;
    /** (Rc / Rt) × 100, rounded to two decimals. Null while Rt = 0. */
    percentage: number | null;
    /** Share of the corpus that has been reviewed, as a percentage. */
    coveragePercentage: number | null;
}

export function computePrecision(input: PrecisionInput): PrecisionResult {
    const totalAgentTurns = Math.max(0, input.totalAgentTurns);
    const reviewed = Math.max(0, Math.min(input.reviewed, totalAgentTurns));
    const correct = Math.max(0, Math.min(input.correct, reviewed));

    return {
        correct,
        reviewed,
        incorrect: reviewed - correct,
        pending: totalAgentTurns - reviewed,
        totalAgentTurns,
        percentage: reviewed === 0 ? null : Math.round((correct / reviewed) * 10000) / 100,
        coveragePercentage:
            totalAgentTurns === 0 ? null : Math.round((reviewed / totalAgentTurns) * 10000) / 100,
    };
}
