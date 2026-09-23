'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, CircleDashed, FileWarning, Loader2, RefreshCw, Target } from 'lucide-react';
import { toast } from 'sonner';

import { refreshTopicCoverage, type PreparationMapData } from '@/lib/actions/preparation.actions';
import { MAX_FOCUS_TOPICS } from '@/lib/preparation/focus';
import type { PreparationTopicEntry, ReviewReason } from '@/lib/preparation/map';
import { PREPARATION_STATE_COPY, type PreparationState } from '@/lib/preparation/status';
import type { PreparationTopicId } from '@/lib/preparation/topics';

/**
 * The preparation map (docs/propuestas/03).
 *
 * It is NOT a summary of the document: every section here is about what the
 * student can defend out loud, and the one section that IS about the document
 * says what it is MISSING. The copy has to keep that difference visible, which
 * is why the gaps come first and the mastered topics come last.
 */

interface PreparationMapProps {
    data: PreparationMapData;
}

/** Gaps first: a topic the thesis cannot answer is the most urgent thing to know. */
const STATE_ORDER: PreparationState[] = ['gap', 'partial', 'unpracticed', 'mastered'];

const STATE_STYLES: Record<
    PreparationState,
    { chip: string; card: string; dot: string; icon: typeof CheckCircle2 }
> = {
    gap: {
        chip: 'bg-red-50 text-red-900 border-red-200',
        card: 'border-red-200 bg-red-50/50',
        dot: 'bg-red-600',
        icon: FileWarning,
    },
    partial: {
        chip: 'bg-[#fff6e5] text-[#663820] border-[#f3e4c7]',
        card: 'border-[#f3e4c7] bg-[#fffdf8]',
        dot: 'bg-[#d98324]',
        icon: AlertTriangle,
    },
    unpracticed: {
        chip: 'bg-[#f1f3f6] text-[#3d485e] border-black/10',
        card: 'border-black/10 bg-white',
        dot: 'bg-[#8d97a8]',
        icon: CircleDashed,
    },
    mastered: {
        chip: 'bg-[#eef6f1] text-[#1f4434] border-[#c8dcd0]',
        card: 'border-[#c8dcd0] bg-[#fbfefc]',
        dot: 'bg-[#2f7a55]',
        icon: CheckCircle2,
    },
};

const REVIEW_REASON_COPY: Record<ReviewReason, string> = {
    unanswered: 'No llegaste a responderla',
    ungrounded: 'Respondiste, pero no se pudo anclar tu respuesta al documento',
    'below-mastery': 'Tu respuesta quedó por debajo del nivel esperado',
    unevaluated: 'Respondiste, pero esta respuesta todavía no está evaluada',
};

const dateFormatter = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' });
const dateTimeFormatter = new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
});

function describePages(pages: number[]): string {
    if (pages.length === 0) return 'Sin páginas identificadas';
    if (pages.length === 1) return `Página ${pages[0]}`;
    return `Páginas ${pages.join(', ')}`;
}

function TopicCard({
    entry,
    selectable,
    selected,
    onToggle,
}: {
    entry: PreparationTopicEntry;
    selectable: boolean;
    selected: boolean;
    onToggle: (id: PreparationTopicId) => void;
}) {
    const styles = STATE_STYLES[entry.state];

    return (
        <article className={`rounded-xl border p-4 ${styles.card}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="text-sm font-bold text-[#212a3b]">{entry.topic.name}</h3>
                    <p className="mt-1 text-xs text-[#3d485e]">{entry.topic.description}</p>
                </div>

                {selectable && (
                    <label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-[#212a3b]">
                        <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => onToggle(entry.topic.id)}
                            className="size-3.5 accent-[#212a3b]"
                        />
                        Practicar
                    </label>
                )}
            </div>

            <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs text-[#3d485e] sm:grid-cols-2">
                <div className="flex gap-1">
                    <dt className="font-semibold">En tu documento:</dt>
                    <dd>
                        {entry.covered
                            ? describePages(entry.pages)
                            : 'Sin fragmentos por encima del umbral'}
                    </dd>
                </div>
                <div className="flex gap-1">
                    <dt className="font-semibold">Preguntas recibidas:</dt>
                    <dd>{entry.questionsAsked}</dd>
                </div>
                <div className="flex gap-1">
                    <dt className="font-semibold">Respuestas dadas:</dt>
                    <dd>
                        {entry.answersGiven}
                        {entry.unevaluatedAnswers > 0 && ` (${entry.unevaluatedAnswers} sin evaluar)`}
                    </dd>
                </div>
                <div className="flex gap-1">
                    <dt className="font-semibold">Nivel medio de contenido:</dt>
                    <dd>
                        {entry.meanContentLevel === null
                            ? 'Sin medición'
                            : `${entry.meanContentLevel} de 3 (${entry.conclusiveAnswers} respuesta${entry.conclusiveAnswers === 1 ? '' : 's'})`}
                    </dd>
                </div>
            </dl>

            {entry.lastPracticedAt && (
                <p className="mt-2 text-[11px] text-[#6b7280]">
                    Última vez que te lo preguntaron:{' '}
                    {dateFormatter.format(new Date(entry.lastPracticedAt))}.
                </p>
            )}

            {entry.state === 'gap' && (
                <p className="mt-3 rounded-lg bg-white/70 p-3 text-xs text-red-900">
                    El jurado puede preguntar esto y tu documento no tiene con qué responder. Esto
                    no se arregla practicando: se arregla desarrollando esa sección de tu
                    investigación y volviéndola a subir.
                </p>
            )}

            {entry.reviewQuestions.length > 0 && (
                <details className="mt-3 group">
                    <summary className="cursor-pointer text-xs font-semibold text-[#663820] underline underline-offset-4">
                        Preguntas que conviene volver a practicar ({entry.reviewQuestions.length})
                    </summary>
                    <ul className="mt-2 space-y-2">
                        {entry.reviewQuestions.map((question) => (
                            <li
                                key={question.questionTurnId}
                                className="rounded-lg border border-black/10 bg-white p-3"
                            >
                                <p className="text-xs font-medium text-[#212a3b]">
                                    “{question.question}”
                                </p>
                                <p className="mt-1 text-[11px] text-[#6b7280]">
                                    {REVIEW_REASON_COPY[question.reason]} ·{' '}
                                    {dateTimeFormatter.format(new Date(question.askedAt))} ·{' '}
                                    <Link
                                        href={`/history/${question.sessionId}`}
                                        className="underline underline-offset-2"
                                    >
                                        ver la sesión
                                    </Link>
                                </p>
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </article>
    );
}

export default function PreparationMap({ data }: PreparationMapProps) {
    const router = useRouter();
    const [isRefreshing, startRefresh] = useTransition();
    const { map, book, needsCoverage } = data;

    // Pre-selected with the weakest topics, capped at what a session can carry:
    // the student arrives here to be told where to practise, not to configure.
    const [selected, setSelected] = useState<PreparationTopicId[]>(() =>
        map.weakTopics.slice(0, MAX_FOCUS_TOPICS),
    );

    const grouped = useMemo(() => {
        const byState = new Map<PreparationState, PreparationTopicEntry[]>();
        for (const state of STATE_ORDER) byState.set(state, []);
        for (const entry of map.topics) byState.get(entry.state)?.push(entry);
        return byState;
    }, [map.topics]);

    const toggle = (id: PreparationTopicId) => {
        setSelected((current) => {
            if (current.includes(id)) return current.filter((item) => item !== id);
            if (current.length >= MAX_FOCUS_TOPICS) {
                toast.error(`Puedes enfocar hasta ${MAX_FOCUS_TOPICS} temas en una sesión.`);
                return current;
            }
            return [...current, id];
        });
    };

    const handleRefresh = () => {
        startRefresh(async () => {
            const result = await refreshTopicCoverage(book.id);
            if (!result.success || !result.data) {
                toast.error(result.error ?? 'No se pudo analizar el documento.');
                return;
            }
            toast.success(
                `Documento analizado: ${result.data.covered} temas cubiertos y ${result.data.gaps} huecos.`,
            );
            router.refresh();
        });
    };

    const startFocusedSession = () => {
        if (selected.length === 0) return;
        router.push(`/books/${book.slug}?focus=${selected.join(',')}`);
    };

    return (
        <div className="flex flex-col gap-6">
            <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h2 className="text-lg font-bold text-[#212a3b]">Cómo estás hoy</h2>
                        <p className="mt-1 text-sm text-[#3d485e]">
                            Cada tema de una sustentación, en uno de cuatro estados, según lo que
                            respondiste en tus sesiones y lo que tu documento puede sostener.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[#212a3b] transition-colors hover:bg-[#fff6e5] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isRefreshing ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        ) : (
                            <RefreshCw className="size-4" aria-hidden="true" />
                        )}
                        {needsCoverage ? 'Analizar mi documento' : 'Volver a analizar'}
                    </button>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {STATE_ORDER.map((state) => {
                        const styles = STATE_STYLES[state];
                        const Icon = styles.icon;
                        return (
                            <div key={state} className={`rounded-xl border p-4 ${styles.chip}`}>
                                <p className="flex items-center gap-2 text-2xl font-bold">
                                    <Icon className="size-5" aria-hidden="true" />
                                    {map.counts[state]}
                                </p>
                                <p className="mt-1 text-sm font-semibold">
                                    {PREPARATION_STATE_COPY[state].name}
                                </p>
                                <p className="mt-1 text-xs opacity-80">
                                    {PREPARATION_STATE_COPY[state].description}
                                </p>
                            </div>
                        );
                    })}
                </div>

                {map.coverageComputedAt ? (
                    <p className="mt-4 text-xs text-[#6b7280]">
                        Tu documento se analizó el{' '}
                        {dateTimeFormatter.format(new Date(map.coverageComputedAt))}. Si subiste una
                        versión corregida, vuelve a analizarlo.
                    </p>
                ) : (
                    <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
                        Todavía no analizamos tu documento contra los temas de una sustentación.
                        Hasta que lo hagas, no podemos distinguir un tema que no practicaste de un
                        hueco en tu investigación.
                    </p>
                )}

                {map.unevaluatedAnswers > 0 && (
                    <p className="mt-3 text-xs text-[#6b7280]">
                        Hay {map.unevaluatedAnswers} respuesta{map.unevaluatedAnswers === 1 ? '' : 's'}{' '}
                        sin evaluar. Abre el informe de esa sesión en tu{' '}
                        <Link href="/history" className="underline underline-offset-2">
                            historial
                        </Link>{' '}
                        y ejecútalo: el mapa se afina con cada evaluación.
                    </p>
                )}
            </section>

            <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-lg font-bold text-[#212a3b]">
                    <Target className="size-5 text-[#663820]" aria-hidden="true" />
                    Practicar solo estos temas
                </h2>
                <p className="mt-1 text-sm text-[#3d485e]">
                    Elige hasta {MAX_FOCUS_TOPICS} temas y el jurado te preguntará únicamente sobre
                    ellos. Los huecos no se pueden practicar: sin contenido en tu documento, el
                    agente no tendría de dónde preguntar.
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                    {selected.length === 0 ? (
                        <span className="text-sm text-[#6b7280]">
                            No hay temas seleccionados. Marca alguno en la lista de abajo.
                        </span>
                    ) : (
                        selected.map((id) => {
                            const entry = map.topics.find((item) => item.topic.id === id);
                            if (!entry) return null;
                            return (
                                <span
                                    key={id}
                                    className="rounded-full border border-[#f3e4c7] bg-[#fff6e5] px-3 py-1 text-xs font-semibold text-[#663820]"
                                >
                                    {entry.topic.name}
                                </span>
                            );
                        })
                    )}
                </div>

                <button
                    type="button"
                    onClick={startFocusedSession}
                    disabled={selected.length === 0}
                    className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-[#212a3b] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#3d485e] disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <Target className="size-4" aria-hidden="true" />
                    Iniciar sesión enfocada
                </button>
            </section>

            {STATE_ORDER.map((state) => {
                const entries = grouped.get(state) ?? [];
                if (entries.length === 0) return null;

                return (
                    <section
                        key={state}
                        className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm"
                    >
                        <h2 className="flex items-center gap-2 text-lg font-bold text-[#212a3b]">
                            <span
                                className={`inline-block size-2.5 rounded-full ${STATE_STYLES[state].dot}`}
                                aria-hidden="true"
                            />
                            {PREPARATION_STATE_COPY[state].name} ({entries.length})
                        </h2>
                        <p className="mt-1 text-sm text-[#3d485e]">
                            {PREPARATION_STATE_COPY[state].description}
                        </p>

                        <div className="mt-4 grid gap-3">
                            {entries.map((entry) => (
                                <TopicCard
                                    key={entry.topic.id}
                                    entry={entry}
                                    selectable={state === 'partial' || state === 'unpracticed'}
                                    selected={selected.includes(entry.topic.id)}
                                    onToggle={toggle}
                                />
                            ))}
                        </div>
                    </section>
                );
            })}

            {map.sessions.length > 0 && (
                <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-bold text-[#212a3b]">Cómo cambió tu mapa</h2>
                    <p className="mt-1 text-sm text-[#3d485e]">
                        Estado de cada tema considerando solo esa sesión, de la más antigua a la más
                        reciente. Un tema en gris es un tema que esa sesión no tocó.
                    </p>

                    <div className="mt-4 overflow-x-auto">
                        <table className="w-full min-w-[520px] border-collapse text-left text-xs">
                            <thead>
                                <tr className="border-b border-black/10 text-[#3d485e]">
                                    <th scope="col" className="py-2 pr-4 font-semibold">
                                        Tema
                                    </th>
                                    {map.sessions.map((session, index) => (
                                        <th
                                            key={session.id}
                                            scope="col"
                                            className="px-2 py-2 text-center font-semibold"
                                        >
                                            S{index + 1}
                                            <span className="block font-normal text-[10px] text-[#6b7280]">
                                                {dateFormatter.format(new Date(session.startedAt))}
                                            </span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {map.topics.map((entry) => (
                                    <tr key={entry.topic.id} className="border-b border-black/5">
                                        <th
                                            scope="row"
                                            className="py-2 pr-4 font-medium text-[#212a3b]"
                                        >
                                            {entry.topic.name}
                                        </th>
                                        {entry.history.map((point) => (
                                            <td key={point.sessionId} className="px-2 py-2 text-center">
                                                <span
                                                    title={PREPARATION_STATE_COPY[point.state].name}
                                                    className={`inline-block size-3 rounded-full ${STATE_STYLES[point.state].dot}`}
                                                />
                                                <span className="sr-only">
                                                    {PREPARATION_STATE_COPY[point.state].name}
                                                </span>
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <ul className="mt-4 flex flex-wrap gap-4 text-xs text-[#3d485e]">
                        {STATE_ORDER.map((state) => (
                            <li key={state} className="flex items-center gap-2">
                                <span
                                    className={`inline-block size-3 rounded-full ${STATE_STYLES[state].dot}`}
                                    aria-hidden="true"
                                />
                                {PREPARATION_STATE_COPY[state].name}
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {map.untaggedQuestions > 0 && (
                <p className="text-xs text-[#6b7280]">
                    {map.untaggedQuestions} pregunta{map.untaggedQuestions === 1 ? '' : 's'} del
                    jurado no se pudo clasificar en ningún tema y no entra en este mapa. Se prefiere
                    dejarla fuera antes que contarla en un tema equivocado.
                </p>
            )}
        </div>
    );
}
