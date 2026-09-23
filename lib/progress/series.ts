/**
 * The time series behind `/progreso` (docs/propuestas/05).
 *
 * WHAT MAKES THIS DIFFERENT FROM NOTEBOOKLM is exactly this file: comparing
 * session 3 with session 1 is only possible because the system keeps a
 * longitudinal record of one student. Every point below is one row of
 * `voice_sessions` plus the turns and verdicts hanging off it.
 *
 * Series are NEVER fused into a single "progress score". A student can get
 * faster and less accurate at the same time, and one number would hide it —
 * the same reason `lib/feedback/report.ts` refuses an overall grade.
 *
 * A missing point is a gap, not a zero. `value: null` means the measurement does
 * not exist for that session (no start delay was captured, no answer was
 * conclusive, the self-report was skipped), and the chart must draw a hole
 * rather than a floor.
 *
 * Pure module: no database, no network.
 */

import { formatSecondsLong } from '../feedback/observations.ts';
import type { ProgressSessionSummary } from './summary.ts';

export const PROGRESS_SERIES_IDS = [
    'startLatency',
    'content',
    'clarity',
    'groundedTopics',
    'selfReportPre',
    'selfReportPost',
] as const;

export type ProgressSeriesId = (typeof PROGRESS_SERIES_IDS)[number];

export interface ProgressPoint {
    sessionId: string;
    /** 1-based, as the student counts them: "sesión 1, sesión 2, sesión 3". */
    index: number;
    startedAt: string;
    /** Null when the measurement does not exist for this session. */
    value: number | null;
    /** The value as the axis label shows it. Empty when there is no value. */
    label: string;
}

export interface ProgressSeries {
    id: ProgressSeriesId;
    /** Heading of the chart, in Spanish. */
    name: string;
    /** One line under it saying where the number comes from. */
    description: string;
    /** Scale bounds for the chart. `max` is null when it depends on the data. */
    min: number;
    max: number | null;
    /**
     * Whether a lower value is the better one. Stated as data so the UI never
     * decides on its own which direction "mejor" points in.
     */
    lowerIsBetter: boolean;
    points: ProgressPoint[];
    /** Points that carry a measurement. A series with fewer than 2 cannot trend. */
    measured: number;
}

export interface ProgressSeriesSet {
    series: ProgressSeries[];
    /** Series with at least one measured point: what the view can actually draw. */
    drawable: ProgressSeries[];
    sessions: Array<{
        sessionId: string;
        index: number;
        startedAt: string;
        difficultyLevel: number;
        isFocused: boolean;
        questionsAsked: number;
        questionsAnswered: number;
        unevaluatedAnswers: number;
    }>;
}

interface SeriesSpec {
    id: ProgressSeriesId;
    name: string;
    description: string;
    min: number;
    max: number | null;
    lowerIsBetter: boolean;
    value: (summary: ProgressSessionSummary) => number | null;
    label: (value: number) => string;
}

function formatLevel(value: number): string {
    return `${value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',')} de 3`;
}

const SERIES_SPECS: SeriesSpec[] = [
    {
        id: 'startLatency',
        name: 'Latencia media de inicio de respuesta',
        description:
            'Tiempo entre el final de la pregunta del jurado y tu primera palabra, promediado sobre las respuestas de cada sesión.',
        min: 0,
        max: null,
        lowerIsBetter: true,
        value: (summary) => summary.signals.meanStudentLatencyMs,
        label: (value) => formatSecondsLong(value),
    },
    {
        id: 'content',
        name: 'Dominio del contenido',
        description:
            'Promedio 0 a 3 de la primera dimensión del informe, sobre las respuestas que el juez pudo anclar a tu documento.',
        min: 0,
        max: 3,
        lowerIsBetter: false,
        value: (summary) => summary.contentMeanLevel,
        label: formatLevel,
    },
    {
        id: 'clarity',
        name: 'Claridad y estructura',
        description: 'Promedio 0 a 3 de la segunda dimensión del informe de cada sesión.',
        min: 0,
        max: 3,
        lowerIsBetter: false,
        value: (summary) => summary.clarityMeanLevel,
        label: formatLevel,
    },
    {
        id: 'groundedTopics',
        name: 'Temas respondidos con respaldo del documento',
        description:
            'Temas de la sustentación en los que al menos una respuesta tuya quedó anclada a un fragmento de tu propia investigación.',
        min: 0,
        max: null,
        lowerIsBetter: false,
        value: (summary) => summary.topics.filter((topic) => topic.cited > 0).length,
        label: (value) => `${value} ${value === 1 ? 'tema' : 'temas'}`,
    },
    {
        id: 'selfReportPre',
        name: 'Autoevaluación antes de la sesión (0 a 10)',
        description:
            'Lo que respondiste en la escala de 0 a 10 justo antes de conectar. Es tu propio reporte, no una medición del sistema.',
        min: 0,
        max: 10,
        lowerIsBetter: true,
        value: (summary) => summary.preSessionAnxiety,
        label: (value) => `${value} de 10`,
    },
    {
        id: 'selfReportPost',
        name: 'Autoevaluación al cerrar la sesión (0 a 10)',
        description: 'La misma escala de 0 a 10, respondida al terminar el simulacro.',
        min: 0,
        max: 10,
        lowerIsBetter: true,
        value: (summary) => summary.postSessionAnxiety,
        label: (value) => `${value} de 10`,
    },
];

/** Builds every series over the student's sessions, oldest first. */
export function buildProgressSeries(
    summaries: ReadonlyArray<ProgressSessionSummary>,
): ProgressSeriesSet {
    const series = SERIES_SPECS.map((spec) => {
        const points: ProgressPoint[] = summaries.map((summary, position) => {
            const value = spec.value(summary);
            return {
                sessionId: summary.sessionId,
                index: position + 1,
                startedAt: summary.startedAt.toISOString(),
                value,
                label: value === null ? '' : spec.label(value),
            };
        });

        return {
            id: spec.id,
            name: spec.name,
            description: spec.description,
            min: spec.min,
            max: spec.max,
            lowerIsBetter: spec.lowerIsBetter,
            points,
            measured: points.filter((point) => point.value !== null).length,
        } satisfies ProgressSeries;
    });

    return {
        series,
        drawable: series.filter((item) => item.measured > 0),
        sessions: summaries.map((summary, position) => ({
            sessionId: summary.sessionId,
            index: position + 1,
            startedAt: summary.startedAt.toISOString(),
            difficultyLevel: summary.difficultyLevel,
            isFocused: summary.isFocused,
            questionsAsked: summary.questionsAsked,
            questionsAnswered: summary.questionsAnswered,
            unevaluatedAnswers: summary.unevaluatedAnswers,
        })),
    };
}
