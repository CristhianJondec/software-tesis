'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import { toast } from 'sonner';

import AnxietyScale from '@/components/AnxietyScale';
import { saveNextStrategy } from '@/lib/actions/prediction.actions';
import { savePostSessionAnxiety } from '@/lib/actions/session.actions';
import { MAX_PREDICTION_CHARS, NEXT_STRATEGY_QUESTION } from '@/lib/prediction/questions';

interface PostSessionSurveyProps {
    sessionId: string;
    /** Called once the answer is stored, or when the student declines to answer. */
    onDone: () => void;
}

/**
 * Closing self-report of a finished session, on the same 0-10 scale as the one
 * asked before it. The pair (pre, post) is what the study compares within a
 * session; the T1/T2 instruments in `lib/surveys/` remain the validated measure
 * across the whole intervention.
 *
 * It also takes the closing question of the prediction record
 * (docs/propuestas/04): what the student will try differently next time. It is
 * asked here, while the session is still fresh, and shown back at the start of
 * the next session with the same document. Both answers are optional and
 * independent — one can be stored without the other.
 */
export default function PostSessionSurvey({ sessionId, onDone }: PostSessionSurveyProps) {
    const [value, setValue] = useState<number | null>(null);
    const [strategy, setStrategy] = useState('');
    const [isPending, startTransition] = useTransition();

    const hasStrategy = strategy.trim() !== '';
    const canSubmit = value !== null || hasStrategy;

    const submit = () => {
        if (!canSubmit) return;
        startTransition(async () => {
            const failures: string[] = [];

            if (value !== null) {
                const result = await savePostSessionAnxiety(sessionId, value);
                if (!result.success) failures.push(result.error ?? 'No se pudo guardar tu respuesta.');
            }

            if (hasStrategy) {
                const result = await saveNextStrategy(sessionId, strategy);
                if (!result.success) failures.push(result.error ?? 'No se pudo guardar tu estrategia.');
            }

            if (failures.length > 0) {
                toast.error(failures.join(' '));
                return;
            }

            toast.success('Respuesta registrada. Gracias.');
            onDone();
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="post-session-title"
                className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl sm:p-8"
            >
                <h2 id="post-session-title" className="text-xl font-bold text-[#212a3b]">
                    Terminaste la sesión
                </h2>
                <p className="mt-1 text-sm text-[#3d485e]">
                    Dos preguntas antes de cerrar. La primera ajusta la exigencia de la próxima
                    sesión; la segunda te la mostramos cuando vuelvas a practicar.
                </p>

                <div className="mt-6">
                    <AnxietyScale
                        idPrefix="post-session-anxiety"
                        question="Del 0 al 10, ¿qué tan nervioso te sientes ahora, al terminar?"
                        value={value}
                        onChange={setValue}
                        disabled={isPending}
                    />
                </div>

                <div className="mt-6">
                    <label
                        htmlFor="next-strategy"
                        className="block text-sm font-medium text-[#212a3b]"
                    >
                        {NEXT_STRATEGY_QUESTION}
                    </label>
                    <textarea
                        id="next-strategy"
                        rows={2}
                        maxLength={MAX_PREDICTION_CHARS}
                        value={strategy}
                        onChange={(event) => setStrategy(event.target.value)}
                        disabled={isPending}
                        placeholder="Lo que vas a hacer distinto la próxima vez."
                        className="mt-1 w-full rounded-lg border border-black/10 bg-white p-3 text-sm text-[#212a3b] placeholder:text-[#9aa3b2] focus:border-[#663820] focus:outline-none disabled:opacity-60"
                    />
                </div>

                <p className="mt-6 rounded-xl border border-[#f3e4c7] bg-[#fff6e5] p-3 text-sm text-[#663820]">
                    <Link
                        href={`/history/${sessionId}#informe`}
                        className="inline-flex items-center gap-2 font-semibold underline underline-offset-4"
                    >
                        <ClipboardList className="size-4" aria-hidden="true" />
                        Ver el informe de esta sesión
                    </Link>
                    <span className="mt-1 block text-xs text-[#8a7350]">
                        Tus respuestas en tres dimensiones —contenido, claridad y conducta
                        comunicativa registrada— y el contraste con lo que predijiste antes de
                        empezar.
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
                        disabled={!canSubmit || isPending}
                        className="rounded-lg bg-[#212a3b] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#3d485e] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isPending ? 'Guardando…' : 'Guardar respuestas'}
                    </button>
                </div>
            </div>
        </div>
    );
}
