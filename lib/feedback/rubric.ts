// Rubric of the two judged dimensions of the post-session report.
//
// WHY A DISCRETE RUBRIC AND NOT A 0-1 NUMBER FROM THE JUDGE: a model asked for
// "a score between 0 and 1" returns a number nobody can defend in front of a
// jury. A model asked to pick one of four described levels returns a choice that
// can be re-read, disputed and re-rated by a human against the same description.
// The 0-1 score the thesis reports is DERIVED from the level here, in one place.
//
// The third dimension of the report is deliberately absent from this file: it is
// not judged and not scored. See `lib/feedback/observations.ts`.

export const RUBRIC_DIMENSION_IDS = ['content', 'clarity'] as const;

export type RubricDimensionId = (typeof RUBRIC_DIMENSION_IDS)[number];

/** 0-3. Null anywhere in the system means "not conclusive", never "zero". */
export const RUBRIC_LEVELS = [0, 1, 2, 3] as const;

export type RubricLevel = (typeof RUBRIC_LEVELS)[number];

export interface RubricDimension {
    id: RubricDimensionId;
    /** Shown as the heading of the dimension in the report. */
    title: string;
    /** One line under the heading, in the student's language. */
    question: string;
    /** Level descriptions, index = level. Sent to the judge verbatim and shown in the UI. */
    levels: readonly [string, string, string, string];
}

export const RUBRIC: Record<RubricDimensionId, RubricDimension> = {
    content: {
        id: 'content',
        title: 'Dominio del contenido',
        question: '¿Tu respuesta es correcta y está respaldada por tu propio documento?',
        levels: [
            'No responde lo que se preguntó, evade, o contradice lo que dice el documento.',
            'Responde algo relacionado, pero no el dato que se pidió, o lo dice de forma que no coincide con el documento.',
            'Responde correctamente, pero de forma parcial o sin el dato preciso que el documento sí tiene.',
            'Responde con el dato preciso y coincide con lo que dice el documento.',
        ],
    },
    clarity: {
        id: 'clarity',
        title: 'Claridad y estructura',
        question: '¿Tu respuesta está ordenada y conecta con tus objetivos y tu metodología?',
        levels: [
            'No se entiende qué está respondiendo.',
            'Divaga: hay que deducir la respuesta de entre otras cosas que dijo.',
            'Responde lo que se preguntó, pero desordenada o sin conectarla con los objetivos ni la metodología.',
            'Ordenada, responde exactamente lo que se preguntó y la conecta con los objetivos o la metodología.',
        ],
    },
};

export const ORDERED_RUBRIC_DIMENSIONS: RubricDimension[] = RUBRIC_DIMENSION_IDS.map((id) => RUBRIC[id]);

export function isRubricLevel(value: unknown): value is RubricLevel {
    return RUBRIC_LEVELS.includes(value as RubricLevel);
}

/** Narrows an untrusted level (judge output, database column). Anything else is null. */
export function normalizeRubricLevel(value: unknown): RubricLevel | null {
    if (typeof value !== 'number' || !Number.isInteger(value)) return null;
    return isRubricLevel(value) ? value : null;
}

/**
 * Level -> [0, 1], the form the thesis reports and averages.
 *
 * Linear over the four levels, so the score is exactly reconstructible from the
 * stored level and nothing is hidden in the conversion.
 */
export function levelToScore(level: RubricLevel | null): number | null {
    if (level === null) return null;
    return Math.round((level / 3) * 10000) / 10000;
}

export function describeLevel(dimension: RubricDimensionId, level: RubricLevel | null): string {
    if (level === null) return 'No concluyente';
    return RUBRIC[dimension].levels[level];
}

export interface DimensionSummary {
    /** Mean of the 0-1 scores over the turns where the dimension was conclusive. */
    meanScore: number | null;
    /** Mean rubric level, on the same 0-3 scale the judge used. */
    meanLevel: number | null;
    /** Turns that contributed. Never show a mean without it. */
    n: number;
    /** Turns where the dimension could not be judged (no citation, judge failure). */
    inconclusive: number;
}

export const EMPTY_DIMENSION_SUMMARY: DimensionSummary = {
    meanScore: null,
    meanLevel: null,
    n: 0,
    inconclusive: 0,
};

/**
 * Averages one dimension over a session.
 *
 * `null` levels are counted as inconclusive, NEVER averaged in as zero: a turn
 * the judge could not ground is an absence of measurement, and folding it in as
 * a 0 would report a student as wrong for a failure of the system.
 */
export function summarizeDimension(levels: ReadonlyArray<RubricLevel | null>): DimensionSummary {
    const measured = levels.filter((level): level is RubricLevel => level !== null);
    const inconclusive = levels.length - measured.length;

    if (measured.length === 0) return { ...EMPTY_DIMENSION_SUMMARY, inconclusive };

    // Explicit accumulator type: the literal union 0|1|2|3 would otherwise be
    // inferred for the sum, which a total of 4 does not fit.
    const levelSum = measured.reduce<number>((sum, level) => sum + level, 0);
    const meanLevel = levelSum / measured.length;

    return {
        meanScore: Math.round((meanLevel / 3) * 10000) / 10000,
        meanLevel: Math.round(meanLevel * 100) / 100,
        n: measured.length,
        inconclusive,
    };
}
