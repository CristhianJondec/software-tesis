import Link from 'next/link';
import {
    ArrowLeft,
    BarChart3,
    CheckCircle2,
    Cloud,
    Database,
    LockKeyhole,
    MessageSquareText,
    Timer,
} from 'lucide-react';
import { notFound } from 'next/navigation';

import Transcript from '@/components/Transcript';
import { getConversationById } from '@/lib/actions/session.actions';
import { formatDuration } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const dateFormatter = new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'long',
    timeStyle: 'short',
});

const numberFormatter = new Intl.NumberFormat('es-PE');
const costFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
});

function average(values: Array<number | null>): number | null {
    const available = values.filter((value): value is number => value !== null);
    if (available.length === 0) return null;
    return available.reduce((sum, value) => sum + value, 0) / available.length;
}

function formatMilliseconds(value: number | null): string {
    if (value === null) return 'Sin datos';
    return value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${Math.round(value)} ms`;
}

function formatScore(value: number | null): string {
    return value === null ? 'Pendiente' : `${(value * 100).toFixed(1)} %`;
}

function friendlyCallStatus(status: string | null): string {
    const labels: Record<string, string> = {
        ended: 'Finalizada',
        'in-progress': 'En curso',
        queued: 'En cola',
        ringing: 'Conectando',
        scheduled: 'Programada',
        'not-found': 'No encontrada',
        'deletion-failed': 'Error de eliminación',
    };
    return status ? (labels[status] ?? status) : 'Sin datos';
}

function friendlyEndedReason(reason: string | null): string {
    if (!reason) return 'Sin datos';
    const labels: Record<string, string> = {
        'customer-ended-call': 'El usuario finalizó la conversación',
        'assistant-ended-call': 'El asistente finalizó la conversación',
        'assistant-said-end-call-phrase': 'El asistente usó la frase de cierre',
        'exceeded-max-duration': 'Se alcanzó la duración máxima',
        'manually-canceled': 'La conversación fue cancelada manualmente',
        'silence-timed-out': 'La conversación terminó por inactividad',
        'customer-did-not-give-microphone-permission': 'No se concedió permiso al micrófono',
    };
    return labels[reason] ?? reason;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
    return (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">{label}</p>
            <p className="mt-2 text-xl font-bold text-[#212a3b]">{value}</p>
            {hint && <p className="mt-1 text-xs text-[#6b7280]">{hint}</p>}
        </div>
    );
}

function SectionTitle({
    icon: Icon,
    title,
    description,
}: {
    icon: typeof MessageSquareText;
    title: string;
    description: string;
}) {
    return (
        <div className="mb-4 flex items-start gap-3">
            <span className="rounded-lg bg-[#f3e4c7] p-2 text-[#663820]">
                <Icon className="size-5" aria-hidden="true" />
            </span>
            <div>
                <h2 className="font-serif text-xl font-bold text-[#212a3b]">{title}</h2>
                <p className="mt-1 text-sm leading-6 text-[#3d485e]">{description}</p>
            </div>
        </div>
    );
}

export default async function ConversationHistoryPage({
    params,
    searchParams,
}: {
    params: Promise<{ sessionId: string }>;
    searchParams: Promise<{ bookId?: string }>;
}) {
    const { sessionId } = await params;
    const { bookId } = await searchParams;
    const result = await getConversationById(sessionId);

    if (!result.success || !result.data) notFound();

    const { conversation, turns, retrievals, humanEvaluations, ragas, vapi } = result.data;
    const messages = turns.map((turn) => ({ role: turn.role, content: turn.content }));
    const backHref = bookId === conversation.bookId
        ? `/history?bookId=${encodeURIComponent(conversation.bookId)}`
        : '/history';

    const studentTurns = turns.filter((turn) => turn.role === 'user');
    const assistantTurns = turns.filter((turn) => turn.role === 'assistant');
    const studentLatency = average(studentTurns.map((turn) => turn.studentLatencyMs));
    const systemLatency = average(assistantTurns.map((turn) => turn.systemLatencyMs));

    const reviewed = humanEvaluations.length;
    const correct = humanEvaluations.filter((evaluation) => evaluation.isCorrect).length;
    const precision = reviewed > 0 ? correct / reviewed : null;

    // A turn can have scores from several prompt versions. The query is newest
    // first, so only the latest evaluation for each turn is shown to the user.
    const latestRagasByTurn = new Map<string, (typeof ragas)[number]>();
    for (const evaluation of ragas) {
        if (!latestRagasByTurn.has(evaluation.turnId)) {
            latestRagasByTurn.set(evaluation.turnId, evaluation);
        }
    }
    const latestRagas = Array.from(latestRagasByTurn.values());
    const ragasAverage = (key: 'faithfulness' | 'answerRelevancy' | 'contextPrecision' | 'contextRecall') =>
        average(latestRagas.map((evaluation) => evaluation[key]));

    return (
        <main className="wrapper container">
            <div className="mx-auto max-w-5xl">
                <Link
                    href={backHref}
                    className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[#3d485e] transition-colors hover:text-[#212a3b]"
                >
                    <ArrowLeft className="size-4" />
                    Volver al historial
                </Link>

                <div className="mb-6 rounded-2xl bg-[#f3e4c7] p-5 sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                            <h1 className="break-words font-serif text-2xl font-bold text-[#212a3b] sm:text-3xl">
                                {conversation.bookTitle}
                            </h1>
                            <p className="mt-1 break-words text-[#3d485e]">Por {conversation.bookAuthor}</p>
                            <p className="mt-3 text-sm text-[#3d485e]">
                                {dateFormatter.format(conversation.startedAt)} · {formatDuration(conversation.durationSeconds)}
                            </p>
                        </div>

                        <div className="inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-white px-3 py-2 text-xs font-semibold text-[#663820]">
                            <LockKeyhole className="size-4" />
                            Solo lectura
                        </div>
                    </div>
                </div>

                <nav className="mb-6 flex flex-wrap gap-2" aria-label="Secciones del detalle de la conversación">
                    {[
                        ['conversacion', 'Conversación'],
                        ['rendimiento', 'Rendimiento'],
                        ['recuperaciones', 'Recuperaciones'],
                        ['evaluacion', 'Evaluación'],
                        ['vapi', 'Datos de Vapi'],
                    ].map(([id, label]) => (
                        <a
                            key={id}
                            href={`#${id}`}
                            className="rounded-full border border-[var(--border-subtle)] bg-white px-3 py-2 text-sm font-semibold text-[#3d485e] transition-colors hover:bg-[#fff6e5]"
                        >
                            {label}
                        </a>
                    ))}
                </nav>

                <div className="space-y-6">
                    <section id="conversacion" className="scroll-mt-28 rounded-2xl bg-white p-5 sm:p-6">
                        <SectionTitle
                            icon={MessageSquareText}
                            title="Conversación"
                            description="Transcripción registrada durante esta sesión. No es posible continuarla desde el historial."
                        />
                        <div className="vapi-transcript-wrapper max-h-[70vh]">
                            <div className="transcript-container min-h-[420px] border border-[var(--border-subtle)]">
                                <Transcript messages={messages} currentMessage="" currentUserMessage="" />
                            </div>
                        </div>
                    </section>

                    <section id="rendimiento" className="scroll-mt-28 rounded-2xl bg-white p-5 sm:p-6">
                        <SectionTitle
                            icon={Timer}
                            title="Rendimiento de la sesión"
                            description="Tiempos medidos directamente durante la conversación. Una ausencia de datos se muestra como tal y no como cero."
                        />
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <Stat label="Duración" value={formatDuration(conversation.durationSeconds)} />
                            <Stat label="Turnos registrados" value={numberFormatter.format(turns.length)} />
                            <Stat
                                label="Respuesta del estudiante"
                                value={formatMilliseconds(studentLatency)}
                                hint={`Promedio de ${studentTurns.filter((turn) => turn.studentLatencyMs !== null).length} medición(es)`}
                            />
                            <Stat
                                label="Respuesta del sistema"
                                value={formatMilliseconds(systemLatency)}
                                hint={`Promedio de ${assistantTurns.filter((turn) => turn.systemLatencyMs !== null).length} medición(es)`}
                            />
                        </div>

                        <div className="mt-5 overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
                            <table className="w-full min-w-[640px] text-left text-sm">
                                <thead className="bg-[#fff6e5] text-[#3d485e]">
                                    <tr>
                                        <th className="px-4 py-3">Turno</th>
                                        <th className="px-4 py-3">Participante</th>
                                        <th className="px-4 py-3">Inicio</th>
                                        <th className="px-4 py-3">Duración del turno</th>
                                        <th className="px-4 py-3">Latencia medida</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {turns.map((turn) => {
                                        const turnDuration = Math.max(0, turn.endedAt.getTime() - turn.startedAt.getTime());
                                        const latency = turn.role === 'user' ? turn.studentLatencyMs : turn.systemLatencyMs;
                                        return (
                                            <tr key={turn.id} className="border-t border-[var(--border-subtle)]">
                                                <td className="px-4 py-3">{turn.turnIndex + 1}</td>
                                                <td className="px-4 py-3 font-medium">
                                                    {turn.role === 'user' ? 'Estudiante' : 'Agente evaluador'}
                                                </td>
                                                <td className="px-4 py-3">{turn.startedAt.toLocaleTimeString('es-PE')}</td>
                                                <td className="px-4 py-3">{formatMilliseconds(turnDuration)}</td>
                                                <td className="px-4 py-3">{formatMilliseconds(latency)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section id="recuperaciones" className="scroll-mt-28 rounded-2xl bg-white p-5 sm:p-6">
                        <SectionTitle
                            icon={Database}
                            title="Recuperaciones del documento"
                            description="Consultas y fragmentos que el recuperador entregó al agente para construir sus respuestas. Una distancia menor indica mayor cercanía semántica."
                        />
                        {retrievals.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-[var(--border-subtle)] p-5 text-sm text-[#3d485e]">
                                Esta sesión no tiene recuperaciones registradas.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {retrievals.map((retrieval) => (
                                    <article key={retrieval.id} className="rounded-xl border border-[var(--border-subtle)] p-4">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <p className="font-semibold text-[#212a3b]">Consulta: {retrieval.query}</p>
                                            <span className="rounded-full bg-[#fff6e5] px-3 py-1 text-xs font-semibold text-[#663820]">
                                                Posición {retrieval.rank}
                                                {retrieval.pageNumber ? ` · Página ${retrieval.pageNumber}` : ''}
                                            </span>
                                        </div>
                                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#3d485e]">{retrieval.content}</p>
                                        <p className="mt-2 text-xs text-[#6b7280]">
                                            Distancia vectorial: {retrieval.distance.toFixed(4)}
                                        </p>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* <section id="evaluacion" className="scroll-mt-28 rounded-2xl bg-white p-5 sm:p-6">
                        <SectionTitle
                            icon={BarChart3}
                            title="Evaluación de respuestas"
                            description="Resultados disponibles para esta sesión. Las evaluaciones pendientes se distinguen de una puntuación de cero."
                        />
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <Stat
                                label="Precisión revisada"
                                value={formatScore(precision)}
                                hint={`${correct} correctas de ${reviewed} revisadas`}
                            />
                            <Stat label="Fidelidad al contexto" value={formatScore(ragasAverage('faithfulness'))} />
                            <Stat label="Pertinencia" value={formatScore(ragasAverage('answerRelevancy'))} />
                            <Stat label="Precisión del contexto" value={formatScore(ragasAverage('contextPrecision'))} />
                            <Stat label="Cobertura del contexto" value={formatScore(ragasAverage('contextRecall'))} />
                            <Stat
                                label="Respuestas por revisar"
                                value={numberFormatter.format(Math.max(0, assistantTurns.length - reviewed))}
                            />
                        </div>
                    </section> */}

                    <section id="vapi" className="scroll-mt-28 rounded-2xl bg-white p-5 sm:p-6">
                        <SectionTitle
                            icon={Cloud}
                            title="Datos técnicos de Vapi"
                            description="Metadatos del servicio externo asociados a esta conversación. Investfied no muestra ni permite escuchar grabaciones."
                        />
                        {vapi.status === 'available' ? (
                            <div className="space-y-5">
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                    <Stat label="Estado" value={friendlyCallStatus(vapi.callStatus)} />
                                    <Stat label="Finalización" value={friendlyEndedReason(vapi.endedReason)} />
                                    <Stat
                                        label="Costo total"
                                        value={vapi.cost === null ? 'Sin datos' : costFormatter.format(vapi.cost)}
                                    />
                                    <Stat
                                        label="Tokens del modelo"
                                        value={numberFormatter.format(
                                            (vapi.costBreakdown.llmPromptTokens ?? 0) +
                                            (vapi.costBreakdown.llmCompletionTokens ?? 0),
                                        )}
                                        hint={
                                            vapi.costBreakdown.llmPromptTokens === null &&
                                            vapi.costBreakdown.llmCompletionTokens === null
                                                ? 'Sin datos de consumo'
                                                : `${numberFormatter.format(vapi.costBreakdown.llmPromptTokens ?? 0)} entrada · ${numberFormatter.format(vapi.costBreakdown.llmCompletionTokens ?? 0)} salida`
                                        }
                                    />
                                    <Stat
                                        label="Caracteres de voz"
                                        value={vapi.costBreakdown.ttsCharacters === null
                                            ? 'Sin datos'
                                            : numberFormatter.format(vapi.costBreakdown.ttsCharacters)}
                                    />
                                </div>

                                {vapi.summary && (
                                    <div className="rounded-xl border border-[var(--border-subtle)] p-4">
                                        <h3 className="font-semibold text-[#212a3b]">Resumen generado por Vapi</h3>
                                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#3d485e]">{vapi.summary}</p>
                                    </div>
                                )}

                                {vapi.endedMessage && (
                                    <div className="rounded-xl border border-[var(--border-subtle)] p-4">
                                        <h3 className="font-semibold text-[#212a3b]">Detalle de finalización</h3>
                                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#3d485e]">
                                            {vapi.endedMessage}
                                        </p>
                                    </div>
                                )}

                                {[
                                    ['Transporte', vapi.costBreakdown.transport],
                                    ['Reconocimiento de voz', vapi.costBreakdown.stt],
                                    ['Modelo de lenguaje', vapi.costBreakdown.llm],
                                    ['Síntesis de voz', vapi.costBreakdown.tts],
                                    ['Plataforma Vapi', vapi.costBreakdown.vapi],
                                ].some(([, value]) => value !== null) && (
                                    <details className="rounded-xl border border-[var(--border-subtle)] p-4">
                                        <summary className="cursor-pointer font-semibold text-[#212a3b]">
                                            Desglose de costos
                                        </summary>
                                        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                                            {[
                                                ['Transporte', vapi.costBreakdown.transport],
                                                ['Reconocimiento de voz', vapi.costBreakdown.stt],
                                                ['Modelo de lenguaje', vapi.costBreakdown.llm],
                                                ['Síntesis de voz', vapi.costBreakdown.tts],
                                                ['Plataforma Vapi', vapi.costBreakdown.vapi],
                                            ].map(([label, value]) => (
                                                <div key={String(label)} className="flex justify-between gap-3 text-sm">
                                                    <dt className="text-[#3d485e]">{label}</dt>
                                                    <dd className="font-semibold text-[#212a3b]">
                                                        {typeof value === 'number' ? costFormatter.format(value) : 'Sin datos'}
                                                    </dd>
                                                </div>
                                            ))}
                                        </dl>
                                    </details>
                                )}

                                {vapi.successEvaluation && (
                                    <div className="rounded-xl border border-[var(--border-subtle)] p-4">
                                        <h3 className="flex items-center gap-2 font-semibold text-[#212a3b]">
                                            <CheckCircle2 className="size-4" /> Evaluación posterior a la llamada
                                        </h3>
                                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#3d485e]">
                                            {vapi.successEvaluation}
                                        </p>
                                    </div>
                                )}

                                {vapi.structuredData && (
                                    <details className="rounded-xl border border-[var(--border-subtle)] p-4">
                                        <summary className="cursor-pointer font-semibold text-[#212a3b]">
                                            Datos estructurados
                                        </summary>
                                        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs leading-5 text-[#3d485e]">
                                            {JSON.stringify(vapi.structuredData, null, 2)}
                                        </pre>
                                    </details>
                                )}
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed border-[var(--border-subtle)] p-5 text-sm leading-6 text-[#3d485e]">
                                {vapi.status === 'not-linked' &&
                                    'Esta conversación es anterior a la vinculación con Vapi. Sus datos locales sí están disponibles en las secciones anteriores.'}
                                {vapi.status === 'not-configured' &&
                                    'La sesión está vinculada, pero la consulta de metadatos del servicio externo aún no está habilitada.'}
                                {vapi.status === 'not-found' &&
                                    'Vapi ya no encuentra esta llamada. Los datos guardados por Investfied permanecen disponibles.'}
                                {vapi.status === 'unavailable' &&
                                    'Vapi no está disponible en este momento. Intenta consultar nuevamente más tarde.'}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </main>
    );
}
