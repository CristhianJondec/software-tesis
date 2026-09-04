'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { saveTurnEvaluation, type ReviewTurn } from '@/lib/actions/metrics.actions';
import { formatMs } from '@/lib/metrics/format';

/**
 * Internal review tool for PR (Precisión de Respuestas).
 *
 * One agent turn per card, with the question that provoked it and the fragments
 * the retriever actually returned, so the rater judges the answer against the
 * evidence the system had — not against their own memory of the thesis.
 *
 * Deliberately plain: it is used by the researcher, not by the students.
 */

interface Verdict {
    isCorrect: boolean | null;
    notes: string;
}

export default function TurnReviewList({ turns }: { turns: ReviewTurn[] }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [openContexts, setOpenContexts] = useState<Record<string, boolean>>({});
    const [verdicts, setVerdicts] = useState<Record<string, Verdict>>(() =>
        Object.fromEntries(
            turns.map((turn) => [turn.turnId, { isCorrect: turn.isCorrect, notes: turn.notes ?? '' }]),
        ),
    );
    const [savingId, setSavingId] = useState<string | null>(null);

    const mark = (turn: ReviewTurn, isCorrect: boolean) => {
        const notes = verdicts[turn.turnId]?.notes ?? '';
        // Optimistic: the rater goes through dozens of turns and should not wait
        // for a round trip between clicks.
        setVerdicts((prev) => ({ ...prev, [turn.turnId]: { isCorrect, notes } }));
        setSavingId(turn.turnId);

        startTransition(async () => {
            const result = await saveTurnEvaluation({ turnId: turn.turnId, isCorrect, notes });
            setSavingId(null);

            if (!result.success) {
                // Roll back so the screen never shows a verdict the database rejected.
                setVerdicts((prev) => ({
                    ...prev,
                    [turn.turnId]: { isCorrect: turn.isCorrect, notes },
                }));
                toast.error(result.error ?? 'No se pudo guardar la evaluación.');
                return;
            }

            router.refresh();
        });
    };

    if (turns.length === 0) {
        return (
            <p className="rounded-xl border border-dashed border-black/20 bg-white/60 p-6 text-sm text-[var(--text-secondary)]">
                No hay turnos que revisar con este filtro.
            </p>
        );
    }

    return (
        <ul className="mt-6 flex flex-col gap-5">
            {turns.map((turn) => {
                const verdict = verdicts[turn.turnId] ?? { isCorrect: null, notes: '' };
                const isOpen = openContexts[turn.turnId] ?? false;

                return (
                    <li
                        key={turn.turnId}
                        className="rounded-xl border border-black/10 bg-white p-5 shadow-soft-sm"
                    >
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]">
                            <span>{turn.participantCode ?? 'Sin código de participante'}</span>
                            <span>Sesión {turn.sessionNumber}</span>
                            <span>Turno {turn.turnIndex}</span>
                            <span>Latencia del sistema: {formatMs(turn.systemLatencyMs)}</span>
                            <span className="truncate">{turn.bookTitle}</span>
                        </div>

                        <div className="mt-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                                Intervención del estudiante
                            </p>
                            <p className="mt-1 text-sm leading-6">
                                {turn.question ?? <em>Sin turno previo del estudiante.</em>}
                            </p>
                        </div>

                        <div className="mt-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                                Respuesta del agente
                            </p>
                            <p className="mt-1 text-sm leading-6 text-black">{turn.answer}</p>
                        </div>

                        <div className="mt-4">
                            <button
                                type="button"
                                onClick={() =>
                                    setOpenContexts((prev) => ({ ...prev, [turn.turnId]: !isOpen }))
                                }
                                className="text-xs font-medium text-[var(--accent-warm)] underline underline-offset-2"
                            >
                                {turn.contexts.length === 0
                                    ? 'Sin fragmentos recuperados para este turno'
                                    : `${isOpen ? 'Ocultar' : 'Ver'} ${turn.contexts.length} fragmento(s) recuperado(s)`}
                            </button>

                            {isOpen && turn.contexts.length > 0 && (
                                <ul className="mt-3 flex flex-col gap-3">
                                    {turn.contexts.map((context) => (
                                        <li
                                            key={context.segmentId}
                                            className="rounded-lg bg-[var(--accent-light)] p-3 text-xs leading-5"
                                        >
                                            <p className="font-medium text-[var(--text-secondary)]">
                                                #{context.rank}
                                                {context.pageNumber != null && ` · página ${context.pageNumber}`}
                                                {` · distancia ${context.distance.toFixed(3)}`}
                                            </p>
                                            <p className="mt-1">{context.content}</p>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="mt-5 flex flex-wrap items-center gap-3">
                            <Button
                                type="button"
                                size="sm"
                                variant={verdict.isCorrect === true ? 'default' : 'outline'}
                                disabled={isPending && savingId === turn.turnId}
                                onClick={() => mark(turn, true)}
                            >
                                <Check className="icon-sm" />
                                Correcta
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant={verdict.isCorrect === false ? 'destructive' : 'outline'}
                                disabled={isPending && savingId === turn.turnId}
                                onClick={() => mark(turn, false)}
                            >
                                <X className="icon-sm" />
                                Incorrecta
                            </Button>

                            <input
                                type="text"
                                value={verdict.notes}
                                placeholder="Nota (opcional): por qué"
                                onChange={(event) =>
                                    setVerdicts((prev) => ({
                                        ...prev,
                                        [turn.turnId]: { ...verdict, notes: event.target.value },
                                    }))
                                }
                                onBlur={() => {
                                    // Notes only reach the database attached to a verdict:
                                    // a note without a judgement would not change PR anyway.
                                    if (verdict.isCorrect === null) return;
                                    if ((turn.notes ?? '') === verdict.notes) return;
                                    mark(turn, verdict.isCorrect);
                                }}
                                className="min-w-[220px] flex-1 rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-warm)]"
                            />
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
