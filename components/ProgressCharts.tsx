import type { ProgressSeries, ProgressSeriesSet } from '@/lib/progress/series';

/**
 * The evolution of one student across sessions (docs/propuestas/05).
 *
 * SMALL MULTIPLES, ONE MEASURE PER CHART. There is no combined chart and none
 * must be added: seconds, a 0-3 rubric and a 0-10 self-report do not share an
 * axis, and drawing them together would invent a comparison the data does not
 * support. It is the same rule `lib/feedback/report.ts` follows when it refuses
 * an overall grade.
 *
 * A MISSING POINT IS A HOLE, NOT A ZERO. A session with no measurement breaks
 * the line and draws no marker, so an unanswered self-report never reads as a
 * calm 0 and an unevaluated session never reads as a failed one.
 *
 * Every chart ships its numbers as a table underneath, so the series is readable
 * without seeing colour or shape.
 */

const CHART_WIDTH = 520;
const CHART_HEIGHT = 160;
const PADDING = { top: 16, right: 16, bottom: 28, left: 16 };

const dateFormatter = new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'short',
    timeZone: 'America/Lima',
});

interface Plotted {
    x: number;
    y: number;
    index: number;
    label: string;
    startedAt: string;
}

/** Bounds of the drawn area, padded so the extremes are not glued to the edge. */
function resolveBounds(series: ProgressSeries): { min: number; max: number } {
    const values = series.points
        .map((point) => point.value)
        .filter((value): value is number => value !== null);

    const dataMax = values.length > 0 ? Math.max(...values) : 1;
    const dataMin = values.length > 0 ? Math.min(...values) : 0;

    const max = series.max ?? dataMax;
    const min = Math.min(series.min, dataMin);

    // A flat series would divide by zero; give it a band so the line sits mid-height.
    if (max <= min) return { min, max: min + 1 };
    return { min, max };
}

function Chart({ series }: { series: ProgressSeries }) {
    const { min, max } = resolveBounds(series);
    const innerWidth = CHART_WIDTH - PADDING.left - PADDING.right;
    const innerHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
    const step = series.points.length > 1 ? innerWidth / (series.points.length - 1) : 0;

    const plotted: Array<Plotted | null> = series.points.map((point, position) => {
        if (point.value === null) return null;
        return {
            x: PADDING.left + step * position + (series.points.length === 1 ? innerWidth / 2 : 0),
            y: PADDING.top + innerHeight - ((point.value - min) / (max - min)) * innerHeight,
            index: point.index,
            label: point.label,
            startedAt: point.startedAt,
        };
    });

    // Consecutive runs of measured points. A gap breaks the line instead of
    // being bridged: a bridged line would assert a value that was never taken.
    const runs: Plotted[][] = [];
    let run: Plotted[] = [];
    for (const point of plotted) {
        if (point === null) {
            if (run.length > 0) runs.push(run);
            run = [];
        } else {
            run.push(point);
        }
    }
    if (run.length > 0) runs.push(run);

    const measured = plotted.filter((point): point is Plotted => point !== null);
    const first = measured[0];
    const last = measured.at(-1);

    return (
        <figure className="mt-4">
            <div className="overflow-x-auto">
                <svg
                    viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                    className="h-auto w-full min-w-[320px]"
                    role="img"
                    aria-label={`${series.name}: ${measured.length} de ${series.points.length} sesiones con medición.`}
                >
                    <line
                        x1={PADDING.left}
                        y1={PADDING.top + innerHeight}
                        x2={CHART_WIDTH - PADDING.right}
                        y2={PADDING.top + innerHeight}
                        stroke="#e5e7eb"
                        strokeWidth={1}
                    />

                    {runs.map((segment, index) =>
                        segment.length > 1 ? (
                            <polyline
                                key={`run-${index}`}
                                points={segment.map((point) => `${point.x},${point.y}`).join(' ')}
                                fill="none"
                                stroke="#663820"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        ) : null,
                    )}

                    {measured.map((point) => (
                        <circle
                            key={point.index}
                            cx={point.x}
                            cy={point.y}
                            r={4.5}
                            fill="#663820"
                            stroke="#ffffff"
                            strokeWidth={2}
                        >
                            <title>{`Sesión ${point.index}: ${point.label}`}</title>
                        </circle>
                    ))}

                    {/* Only the extremes are labelled: a number on every point is noise. */}
                    {first && (
                        <text
                            x={first.x}
                            y={Math.max(PADDING.top - 4, first.y - 10)}
                            textAnchor="start"
                            className="fill-[#6b7280] text-[10px]"
                        >
                            {first.label}
                        </text>
                    )}
                    {last && last !== first && (
                        <text
                            x={last.x}
                            y={Math.max(PADDING.top - 4, last.y - 10)}
                            textAnchor="end"
                            className="fill-[#212a3b] text-[10px] font-semibold"
                        >
                            {last.label}
                        </text>
                    )}

                    {series.points.map((point, position) => (
                        <text
                            key={point.sessionId}
                            x={
                                PADDING.left +
                                step * position +
                                (series.points.length === 1 ? innerWidth / 2 : 0)
                            }
                            y={CHART_HEIGHT - 8}
                            textAnchor="middle"
                            className="fill-[#8d97a8] text-[10px]"
                        >
                            {point.index}
                        </text>
                    ))}
                </svg>
            </div>

            <figcaption className="mt-1 text-center text-xs text-[#8d97a8]">
                Número de sesión con esta investigación
            </figcaption>
        </figure>
    );
}

function SeriesCard({ series }: { series: ProgressSeries }) {
    return (
        <section className="rounded-2xl border border-[var(--border-subtle)] bg-white p-5">
            <h3 className="font-serif text-lg font-bold text-[#212a3b]">{series.name}</h3>
            <p className="mt-1 text-sm leading-6 text-[#3d485e]">{series.description}</p>
            <p className="mt-1 text-xs text-[#6b7280]">
                {series.lowerIsBetter ? 'Un número más bajo es mejor.' : 'Un número más alto es mejor.'}{' '}
                {series.measured < 2 &&
                    'Con una sola sesión medida todavía no hay evolución que leer.'}
            </p>

            <Chart series={series} />

            <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[320px] text-left text-xs">
                    <caption className="sr-only">{series.name}, valores por sesión</caption>
                    <thead>
                        <tr className="text-[#6b7280]">
                            <th scope="col" className="py-1 pr-3 font-semibold">Sesión</th>
                            <th scope="col" className="py-1 pr-3 font-semibold">Fecha</th>
                            <th scope="col" className="py-1 font-semibold">Valor</th>
                        </tr>
                    </thead>
                    <tbody className="text-[#3d485e]">
                        {series.points.map((point) => (
                            <tr key={point.sessionId} className="border-t border-[var(--border-subtle)]">
                                <td className="py-1 pr-3">{point.index}</td>
                                <td className="py-1 pr-3">
                                    {dateFormatter.format(new Date(point.startedAt))}
                                </td>
                                <td className="py-1 font-semibold text-[#212a3b]">
                                    {point.label || 'Sin medición'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

export default function ProgressCharts({ series }: { series: ProgressSeriesSet }) {
    if (series.drawable.length === 0) {
        return (
            <p className="rounded-2xl border border-[var(--border-subtle)] bg-white p-5 text-sm text-[#3d485e]">
                Todavía no hay ninguna medición registrada. Practica una sesión y evalúa sus
                respuestas en el informe para que estas series empiecen a llenarse.
            </p>
        );
    }

    return (
        <div className="grid gap-5 lg:grid-cols-2">
            {series.drawable.map((item) => (
                <SeriesCard key={item.id} series={item} />
            ))}
        </div>
    );
}
