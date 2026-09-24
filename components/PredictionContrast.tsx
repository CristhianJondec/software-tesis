import { CircleHelp, ListChecks, NotebookPen } from 'lucide-react';

import type { PredictionContrast as PredictionContrastData } from '@/lib/prediction/contrast';
import { NEXT_STRATEGY_QUESTION } from '@/lib/prediction/questions';

interface PredictionContrastProps {
    contrast: PredictionContrastData;
}

const dateFormatter = new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'long',
    timeZone: 'America/Lima',
});

/**
 * What the student predicted before the session, next to what the session
 * recorded (docs/propuestas/04).
 *
 * This component writes NO prose of its own: every sentence comes from
 * `lib/prediction/contrast.ts`, which builds them from stored rows. The
 * prediction is shown as a quotation and never characterised — no badge here may
 * say the student was right or wrong, only whether the predicted event is in the
 * transcript.
 */
export default function PredictionContrast({ contrast }: PredictionContrastProps) {
    const answered = contrast.items.filter((item) => item.predicted !== null);

    return (
        <div className="space-y-4">
            {answered.length === 0 ? (
                <p className="flex items-start gap-2 rounded-xl border border-[var(--border-subtle)] bg-white p-5 text-sm text-[#3d485e]">
                    <CircleHelp className="mt-0.5 size-4 shrink-0 text-[#8B7355]" aria-hidden="true" />
                    <span>
                        No registraste predicciones antes de esta sesión. Las tres preguntas aparecen
                        en la pantalla previa y son opcionales: si las respondes la próxima vez, aquí
                        verás el contraste con lo que quedó registrado.
                    </span>
                </p>
            ) : (
                <ul className="space-y-3">
                    {answered.map((item) => (
                        <li
                            key={item.id}
                            className="rounded-xl border border-[var(--border-subtle)] bg-white p-5"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <h3 className="text-sm font-semibold text-[#212a3b]">{item.prompt}</h3>
                                <span className="shrink-0 rounded-full bg-[#fff6e5] px-3 py-1 text-xs font-semibold text-[#663820]">
                                    {item.verdictLabel}
                                </span>
                            </div>

                            <div className="mt-3 grid gap-4 sm:grid-cols-2">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                                        Predijiste
                                    </p>
                                    <p className="mt-1 whitespace-pre-wrap text-sm italic leading-6 text-[#3d485e]">
                                        “{item.predicted}”
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                                        Ocurrió
                                    </p>
                                    <ul className="mt-1 space-y-1 text-sm leading-6 text-[#3d485e]">
                                        {item.happened.map((note) => (
                                            <li key={note}>{note}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {contrast.unforeseenNotes.length > 0 && (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-5">
                    <p className="flex items-start gap-2 text-sm font-semibold text-[#212a3b]">
                        <ListChecks className="mt-0.5 size-4 shrink-0 text-[#8B7355]" aria-hidden="true" />
                        También te preguntaron por temas que no habías nombrado
                    </p>
                    <ul className="mt-2 space-y-1 pl-6 text-sm leading-6 text-[#3d485e]">
                        {contrast.unforeseenNotes.map((note) => (
                            <li key={note}>{note}</li>
                        ))}
                    </ul>
                </div>
            )}

            {contrast.nextStrategy && (
                <div className="rounded-xl border border-[#d6dbe8] bg-[#f4f6fb] p-5">
                    <p className="flex items-start gap-2 text-sm font-semibold text-[#212a3b]">
                        <NotebookPen className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        {NEXT_STRATEGY_QUESTION}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap pl-6 text-sm italic leading-6 text-[#3d485e]">
                        “{contrast.nextStrategy}”
                    </p>
                    {contrast.strategyAt && (
                        <p className="mt-1 pl-6 text-xs text-[#6b7280]">
                            Lo escribiste el {dateFormatter.format(new Date(contrast.strategyAt))}. Te
                            lo mostramos al iniciar tu próxima sesión con esta investigación.
                        </p>
                    )}
                </div>
            )}

            <p className="text-xs text-[#6b7280]">
                El contraste se calcula de los turnos registrados en esta sesión —{' '}
                {contrast.questionsAsked} pregunta(s) del jurado, {contrast.questionsAnswered} con
                respuesta — y de los niveles del informe. Ningún modelo redacta estas frases.
                {contrast.unevaluatedAnswers > 0 &&
                    ` ${contrast.unevaluatedAnswers} respuesta(s) todavía no están evaluadas: los niveles de contenido aparecen aquí cuando las evalúes en el informe.`}
            </p>
        </div>
    );
}
