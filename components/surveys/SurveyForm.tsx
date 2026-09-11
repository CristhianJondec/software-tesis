'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { submitSurvey } from '@/lib/actions/survey.actions';
import type { SurveyInstrument, SurveyStageId } from '@/lib/surveys/catalog';

interface SurveyFormProps {
    stageId: SurveyStageId;
    instrument: SurveyInstrument;
}

export default function SurveyForm({ stageId, instrument }: SurveyFormProps) {
    const router = useRouter();
    const [answers, setAnswers] = useState<Record<string, number>>({});
    const [isPending, startTransition] = useTransition();
    const answeredCount = Object.keys(answers).length;
    const isComplete = answeredCount === instrument.questions.length;

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!isComplete) {
            toast.error(`Responde las ${instrument.questions.length} preguntas antes de enviar.`);
            return;
        }

        startTransition(async () => {
            const result = await submitSurvey({ stageId, answers });
            if (!result.success) {
                toast.error(result.error ?? 'No se pudo guardar la encuesta.');
                return;
            }
            toast.success('Encuesta enviada correctamente. Tus respuestas quedaron registradas.');
            router.push('/surveys');
            router.refresh();
        });
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="sticky top-[74px] z-20 rounded-xl border border-black/10 bg-white/95 px-5 py-3 shadow-sm backdrop-blur">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--text-secondary)]">
                        Progreso: {answeredCount} de {instrument.questions.length} respondidas
                    </p>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[#f3e4c7] sm:w-52">
                        <div
                            className="h-full rounded-full bg-[#663820] transition-all"
                            style={{ width: `${(answeredCount / instrument.questions.length) * 100}%` }}
                        />
                    </div>
                </div>
            </div>

            {instrument.questions.map((question, index) => {
                const key = `item_${index + 1}`;
                return (
                    <fieldset key={key} className="rounded-xl border border-black/10 bg-white p-5 shadow-sm sm:p-6">
                        <legend className="sr-only">Pregunta {index + 1}</legend>
                        <p className="mb-5 text-base font-semibold leading-6 text-[#212a3b]">
                            <span className="mr-2 text-[#663820]">{index + 1}.</span>
                            {question}
                        </p>
                        <RadioGroup
                            value={answers[key]?.toString()}
                            onValueChange={(value) => setAnswers((current) => ({ ...current, [key]: Number(value) }))}
                            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                            aria-label={`Respuesta a la pregunta ${index + 1}`}
                        >
                            {instrument.options.map((option) => {
                                const optionId = `${key}-${option.value}`;
                                return (
                                    <label
                                        key={option.value}
                                        htmlFor={optionId}
                                        className="flex cursor-pointer items-center gap-3 rounded-lg border border-black/10 px-4 py-3 text-sm transition-colors hover:bg-[#fff6e5] has-[[data-state=checked]]:border-[#663820] has-[[data-state=checked]]:bg-[#fff6e5]"
                                    >
                                        <RadioGroupItem id={optionId} value={option.value.toString()} />
                                        <span><strong>{option.value}</strong> — {option.label}</span>
                                    </label>
                                );
                            })}
                        </RadioGroup>
                    </fieldset>
                );
            })}

            <div className="rounded-xl border border-black/10 bg-white p-5 sm:flex sm:items-center sm:justify-between">
                <p className="mb-4 max-w-xl text-sm text-[var(--text-secondary)] sm:mb-0">
                    Revisa tus respuestas antes de enviar. Una vez registrada esta etapa, no podrás modificarla ni volver a enviarla.
                </p>
                <Button type="submit" size="lg" disabled={!isComplete || isPending} className="bg-[#663820] hover:bg-[#7a4528]">
                    {isPending ? 'Guardando…' : 'Enviar encuesta'}
                </Button>
            </div>
        </form>
    );
}
