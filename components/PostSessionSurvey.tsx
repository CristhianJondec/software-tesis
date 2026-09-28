'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ClipboardList, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import AnxietyScale from '@/components/AnxietyScale';
import { getSessionEvidence, type SessionEvidenceData } from '@/lib/actions/progress.actions';
import { savePostSessionAnxiety } from '@/lib/actions/session.actions';

interface PostSessionSurveyProps {
    sessionId: string;
    /** Called when the student declines to answer. */
    onDone: () => void;
}

/**
 * Closing modal of a finished session.
 *
 * It shows, in writing, the summary of the session (the evidence built by
 * `lib/progress/evidence.ts`, the same list as the "Evidencias de avance"
 * section of the session page), and asks the closing self-report on the same
 * 0-10 scale as the one asked before it. The pair (pre, post) is what the study
 * compares within a session. Saving the answer takes the student straight to
 * the session report.
 */
export default function PostSessionSurvey({ sessionId, onDone }: PostSessionSurveyProps) {
    const router = useRouter();
    const [value, setValue] = useState<number | null>(null);
    const [isPending, startTransition] = useTransition();
    const [summary, setSummary] = useState<SessionEvidenceData | null>(null);
    const [summaryLoading, setSummaryLoading] = useState(true);

    const reportHref = `/history/${sessionId}#informe`;

    useEffect(() => {
        let cancelled = false;
        getSessionEvidence(sessionId)
            .then((result) => {
                if (!cancelled && result.success && result.data) setSummary(result.data);
            })
            .catch((error) => console.error('Failed to load the session summary:', error))
            .finally(() => {
                if (!cancelled) setSummaryLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [sessionId]);

    const submit = () => {
        if (value === null) return;
        startTransition(async () => {
            const result = await savePostSessionAnxiety(sessionId, value);
            if (!result.success) {
                toast.error(result.error ?? 'No se pudo guardar tu respuesta.');
                return;
            }

            toast.success('Respuesta registrada. Gracias.');
            router.push(reportHref);
        });
    };

    const evidence = summary?.evidence ?? [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="post-session-title"
                className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl sm:p-8"
            >
                <h2 id="post-session-title" className="text-xl font-bold text-[#212a3b]">
                    Terminaste la sesión
                </h2>

                <section className="mt-4 rounded-xl border border-[#d6dbe8] bg-[#f4f6fb] p-4">
                    <h3 className="text-sm font-semibold text-[#212a3b]">Resumen de la sesión</h3>
                    {summaryLoading ? (
                        <p className="mt-2 flex items-center gap-2 text-sm text-[#3d485e]">
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                            Preparando el resumen…
                        </p>
                    ) : evidence.length > 0 ? (
                        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-[#212a3b]">
                            {evidence.map((item) => (
                                <li key={item.id}>{item.text}</li>
                            ))}
                        </ul>
                    ) : (
                        <p className="mt-2 text-sm text-[#3d485e]">
                            Esta vez no hay datos suficientes para un resumen. El informe completo
                            estará disponible cuando se evalúen tus respuestas.
                        </p>
                    )}
                    {summary?.setback && (
                        <p className="mt-3 text-sm text-[#3d485e]">{summary.setback.text}</p>
                    )}
                </section>

                <div className="mt-6">
                    <AnxietyScale
                        idPrefix="post-session-anxiety"
                        question="Del 0 al 10, ¿qué tan nervioso te sientes ahora, al terminar?"
                        value={value}
                        onChange={setValue}
                        disabled={isPending}
                    />
                </div>

                <p className="mt-6 rounded-xl border border-[#f3e4c7] bg-[#fff6e5] p-3 text-sm text-[#663820]">
                    <Link
                        href={reportHref}
                        className="inline-flex items-center gap-2 font-semibold underline underline-offset-4"
                    >
                        <ClipboardList className="size-4" aria-hidden="true" />
                        Ver el informe de esta sesión
                    </Link>
                    <span className="mt-1 block text-xs text-[#8a7350]">
                        Tus respuestas en tres dimensiones: contenido, claridad y conducta
                        comunicativa registrada.
                    </span>
                </p>

                <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={onDone}
                        disabled={isPending}
                        className="rounded-lg px-4 py-2.5 text-sm font-semibold text-[#3d485e] transition-colors hover:bg-[#fff6e5] disabled:opacity-60"
                    >
                        Prefiero no responder
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={value === null || isPending}
                        className="rounded-lg bg-[#212a3b] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#3d485e] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isPending ? 'Guardando…' : 'Guardar respuesta'}
                    </button>
                </div>
            </div>
        </div>
    );
}
