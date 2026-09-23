'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpenText, ChevronDown, Ear, ListOrdered, RefreshCw, Target } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { evaluateSessionFeedback } from '@/lib/actions/feedback.actions';
import { describeLevel, RUBRIC, type RubricDimensionId } from '@/lib/feedback/rubric';
import type { SessionFeedbackReport, TurnReportItem } from '@/lib/feedback/report';

interface SessionReportProps {
    sessionId: string;
    report: SessionFeedbackReport;
    judgeModel: string;
    promptVersion: string;
}

/** 0-3 as "2 de 3", or the absence of a measurement as such. */
function formatLevel(level: number | null): string {
    return level === null ? 'No concluyente' : `${level} de 3`;
}

function formatMeanLevel(mean: number | null): string {
    return mean === null ? 'Sin datos' : `${mean.toFixed(2).replace('.', ',')} de 3`;
}

function DimensionCard({
    dimension,
    icon: Icon,
    summary,
}: {
    dimension: RubricDimensionId;
    icon: typeof Target;
    summary: { meanLevel: number | null; n: number; inconclusive: number };
}) {
    const rubric = RUBRIC[dimension];
    return (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-5">
            <div className="flex items-start gap-3">
                <span className="rounded-lg bg-[#f3e4c7] p-2 text-[#663820]">
                    <Icon className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                    <h3 className="font-serif text-lg font-bold text-[#212a3b]">{rubric.title}</h3>
                    <p className="mt-1 text-sm text-[#3d485e]">{rubric.question}</p>
                </div>
            </div>

            <p className="mt-4 text-2xl font-bold text-[#212a3b]">{formatMeanLevel(summary.meanLevel)}</p>
            <p className="mt-1 text-xs text-[#6b7280]">
                Promedio sobre {summary.n} {summary.n === 1 ? 'respuesta evaluada' : 'respuestas evaluadas'}
                {summary.inconclusive > 0 && ` · ${summary.inconclusive} no concluyente(s)`}
            </p>
        </div>
    );
}

function TurnDetail({ item }: { item: TurnReportItem }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <li className="rounded-xl border border-[var(--border-subtle)] bg-white">
            <button
                type="button"
                onClick={() => setIsOpen((current) => !current)}
                aria-expanded={isOpen}
                className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-[#fff6e5]"
            >
                <ChevronDown
                    className={`mt-0.5 size-5 shrink-0 text-[#8B7355] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-[#212a3b]">
                        {item.question ?? 'Intervención sin pregunta previa'}
                    </span>
                    <span className="mt-1 block text-xs text-[#6b7280]">
                        Contenido: {formatLevel(item.content.level)} · Claridad:{' '}
                        {formatLevel(item.clarity.level)}
                    </span>
                </span>
            </button>

            {isOpen && (
                <div className="border-t border-[var(--border-subtle)] p-4 pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                        Tu respuesta
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[#3d485e]">{item.answer}</p>

                    <div className="mt-5 grid gap-4 lg:grid-cols-3">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-[#663820]">
                                {RUBRIC.content.title}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-[#212a3b]">
                                {formatLevel(item.content.level)}
                            </p>
                            <p className="mt-1 text-sm text-[#3d485e]">
                                {describeLevel('content', item.content.level)}
                            </p>
                            {item.content.justification && (
                                <p className="mt-2 text-sm text-[#3d485e]">{item.content.justification}</p>
                            )}
                            {item.content.citedSegment ? (
                                <figure className="mt-3 rounded-lg border border-[#f3e4c7] bg-[#fff6e5] p-3">
                                    <figcaption className="text-xs font-semibold text-[#663820]">
                                        De tu documento
                                        {item.content.citedSegment.pageNumber !== null &&
                                            `, página ${item.content.citedSegment.pageNumber}`}
                                    </figcaption>
                                    <blockquote className="mt-1 text-xs leading-5 text-[#663820]">
                                        {item.content.citedSegment.content.slice(0, 400)}
                                        {item.content.citedSegment.content.length > 400 && '…'}
                                    </blockquote>
                                </figure>
                            ) : (
                                <p className="mt-3 text-xs text-[#6b7280]">
                                    {item.isUnprompted
                                        ? 'Esta intervención no respondió a una pregunta, así que no se evalúa el contenido.'
                                        : item.lacksContext
                                          ? 'No hubo fragmentos recuperados de tu documento para esta pregunta, así que el contenido no se evalúa.'
                                          : 'Sin fragmento citado, el juicio de contenido queda como no concluyente.'}
                                </p>
                            )}
                        </div>

                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-[#663820]">
                                {RUBRIC.clarity.title}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-[#212a3b]">
                                {formatLevel(item.clarity.level)}
                            </p>
                            <p className="mt-1 text-sm text-[#3d485e]">
                                {describeLevel('clarity', item.clarity.level)}
                            </p>
                            {item.clarity.justification && (
                                <p className="mt-2 text-sm text-[#3d485e]">{item.clarity.justification}</p>
                            )}
                        </div>

                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-[#663820]">
                                Conducta comunicativa registrada
                            </p>
                            <ul className="mt-1 space-y-1 text-sm text-[#3d485e]">
                                {item.observations.notes.map((note) => (
                                    <li key={note}>{note}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </li>
    );
}

/**
 * The post-session report, with the three dimensions kept visually apart.
 *
 * There is no overall grade and none must be added: a student can be accurate
 * but disorganised, or fluent but wrong, and the report exists to show which.
 * Dimension 3 lists facts with their numbers, never an interpretation of how the
 * student felt (docs/propuestas/00, regla 1).
 */
export default function SessionReport({
    sessionId,
    report,
    judgeModel,
    promptVersion,
}: SessionReportProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const { coverage } = report;

    const handleEvaluate = () => {
        startTransition(async () => {
            const result = await evaluateSessionFeedback(sessionId);

            if (!result.success || !result.data) {
                toast.error(result.error ?? 'No se pudo evaluar la sesión.');
                return;
            }

            const { evaluated, failed, remaining } = result.data;
            if (evaluated === 0 && failed === 0) {
                toast.info('No quedan respuestas pendientes de evaluar.');
            } else {
                toast.success(
                    `${evaluated} ${evaluated === 1 ? 'respuesta evaluada' : 'respuestas evaluadas'}` +
                        `${failed > 0 ? `, ${failed} con error` : ''}. Quedan ${remaining}.`,
                );
            }

            router.refresh();
        });
    };

    if (coverage.answers === 0) {
        return (
            <p className="rounded-xl border border-[var(--border-subtle)] bg-white p-5 text-sm text-[#3d485e]">
                Esta sesión no registró respuestas tuyas, así que no hay nada que informar.
            </p>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-3">
                <DimensionCard dimension="content" icon={BookOpenText} summary={report.content} />
                <DimensionCard dimension="clarity" icon={ListOrdered} summary={report.clarity} />

                <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-5">
                    <div className="flex items-start gap-3">
                        <span className="rounded-lg bg-[#f3e4c7] p-2 text-[#663820]">
                            <Ear className="size-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                            <h3 className="font-serif text-lg font-bold text-[#212a3b]">
                                Conducta comunicativa
                            </h3>
                            <p className="mt-1 text-sm text-[#3d485e]">
                                Hechos registrados durante la conversación. No lleva puntaje.
                            </p>
                        </div>
                    </div>

                    <ul className="mt-4 space-y-1 text-sm text-[#3d485e]">
                        {report.observations.notes.map((note) => (
                            <li key={note}>{note}</li>
                        ))}
                    </ul>
                </div>
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-[#3d485e]">
                        {coverage.evaluated} de {coverage.answers} respuestas evaluadas
                        {coverage.pending > 0 && ` · ${coverage.pending} pendiente(s)`}
                        {coverage.withoutContext > 0 &&
                            ` · ${coverage.withoutContext} sin fragmento recuperado`}
                        {coverage.unprompted > 0 && ` · ${coverage.unprompted} sin pregunta previa`}
                    </p>

                    <Button onClick={handleEvaluate} disabled={isPending || coverage.pending === 0} className="w-fit">
                        <RefreshCw className={`icon-sm ${isPending ? 'animate-spin' : ''}`} />
                        {isPending ? 'Evaluando…' : `Evaluar pendientes (${coverage.pending})`}
                    </Button>
                </div>

                <p className="mt-2 text-xs text-[#6b7280]">
                    Las dimensiones de contenido y claridad las califica un juez LLM ({judgeModel}) a
                    temperatura 0, obligado a citar un fragmento de tu propio documento; sin cita válida, el
                    contenido queda como no concluyente. La conducta comunicativa se calcula de los tiempos
                    registrados, sin intervención del modelo. Versión de prompts:{' '}
                    <code>{promptVersion}</code>
                </p>
            </div>

            <div>
                <h3 className="font-serif text-lg font-semibold text-[#212a3b]">Detalle por pregunta</h3>
                <ul className="mt-3 space-y-3">
                    {report.turns.map((item) => (
                        <TurnDetail key={item.answerTurnId} item={item} />
                    ))}
                </ul>
            </div>
        </div>
    );
}
