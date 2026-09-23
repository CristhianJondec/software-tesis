'use client';

import { useEffect, useMemo, useState } from 'react';
import { Info, Loader2, NotebookPen, Play, Sparkles, Target } from 'lucide-react';

import AnxietyScale from '@/components/AnxietyScale';
import { getSessionPreparation } from '@/lib/actions/session.actions';
import { suggestDifficultyLevel } from '@/lib/difficulty/adaptation';
import {
    ORDERED_DIFFICULTY_LEVELS,
    type DifficultyLevelId,
} from '@/lib/difficulty/levels';
import { describeFocusTopics } from '@/lib/preparation/focus';
import type { PreparationTopicId } from '@/lib/preparation/topics';
import {
    MAX_PREDICTION_CHARS,
    ORDERED_PREDICTION_QUESTIONS,
    type PredictionAnswers,
    type PredictionQuestionId,
} from '@/lib/prediction/questions';
import type { SessionPreparation } from '@/types';

interface SessionSetupProps {
    bookId: string;
    disabled: boolean;
    /** Topics of the preparation map this session is limited to. Empty = full defense. */
    focusTopics?: PreparationTopicId[];
    onStart: (options: {
        difficultyLevel: DifficultyLevelId;
        preSessionAnxiety: number | null;
        focusTopics: PreparationTopicId[];
        prediction: PredictionAnswers;
    }) => void;
}

const dateFormatter = new Intl.DateTimeFormat('es-PE', { dateStyle: 'long' });

function describeRules(level: (typeof ORDERED_DIFFICULTY_LEVELS)[number]): string {
    const time =
        level.answerTimeLimitSeconds === null
            ? 'sin límite de tiempo'
            : `hasta ${level.answerTimeLimitSeconds} s por respuesta`;
    const rephrasing = level.allowsRephrasing ? 'puedes pedir que te reformulen' : 'no reformula';
    return `${level.targetQuestions} preguntas · ${time} · ${rephrasing}`;
}

/**
 * Pre-session screen of the graded-exposure simulation.
 *
 * The self-report is asked first because it is the leading input of the rule.
 * The suggested level then updates live as the student picks a number, with the
 * sentence that justifies it, and the student can override it — the system
 * suggests, it never imposes (docs/propuestas/01).
 */
export default function SessionSetup({
    bookId,
    disabled,
    focusTopics = [],
    onStart,
}: SessionSetupProps) {
    const [preparation, setPreparation] = useState<SessionPreparation | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [anxiety, setAnxiety] = useState<number | null>(null);
    const [chosenLevel, setChosenLevel] = useState<DifficultyLevelId | null>(null);
    // The three written predictions (docs/propuestas/04). All optional: nothing
    // here may block the start button.
    const [prediction, setPrediction] = useState<PredictionAnswers>({});

    const setAnswer = (id: PredictionQuestionId, value: string) =>
        setPrediction((current) => ({ ...current, [id]: value }));

    useEffect(() => {
        let cancelled = false;

        getSessionPreparation(bookId)
            .then((result) => {
                if (cancelled) return;
                if (!result.success || !result.data) {
                    setLoadError(result.error ?? 'No se pudo preparar la sesión.');
                    return;
                }
                setPreparation(result.data);
            })
            .catch(() => {
                if (!cancelled) setLoadError('No se pudo preparar la sesión.');
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [bookId]);

    // Re-run on every change of the self-report: the rule is pure and cheap, and
    // the student gets to see the suggestion move with their own answer.
    const suggestion = useMemo(
        () =>
            suggestDifficultyLevel({
                preSessionAnxiety: anxiety,
                previous: preparation?.previous ?? null,
            }),
        [anxiety, preparation],
    );

    // With no manual pick, the rule's suggestion is what runs. A pick stands
    // until the student changes their self-report, which resets it (see onChange
    // below): a new answer deserves a fresh suggestion, not a stale override.
    const effectiveLevel = chosenLevel ?? suggestion.level;
    const isOverridden = chosenLevel !== null && chosenLevel !== suggestion.level;

    if (isLoading) {
        return (
            <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white p-6 text-sm text-[#3d485e]">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Preparando tu sesión…
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-900">
                {loadError}
            </div>
        );
    }

    return (
        <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-[#212a3b]">Antes de empezar</h2>
            <p className="mt-1 text-sm text-[#3d485e]">
                Tu respuesta define con qué nivel de exigencia arranca el simulacro. Puedes cambiarlo
                tú mismo más abajo.
            </p>

            {preparation?.previousStrategy && (
                <div className="mt-4 rounded-xl border border-[#d6dbe8] bg-[#f4f6fb] p-4">
                    <p className="flex items-start gap-2 text-sm text-[#212a3b]">
                        <NotebookPen className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        <span>
                            <strong>Al terminar tu sesión anterior escribiste que ibas a probar esto:</strong>{' '}
                            <span className="italic">“{preparation.previousStrategy}”</span>
                        </span>
                    </p>
                </div>
            )}

            {focusTopics.length > 0 && (
                <div className="mt-4 rounded-xl border border-[#c8dcd0] bg-[#eef6f1] p-4">
                    <p className="flex items-start gap-2 text-sm text-[#1f4434]">
                        <Target className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        <span>
                            <strong>Sesión enfocada.</strong> El jurado te preguntará solo sobre{' '}
                            {describeFocusTopics(focusTopics)}. Queda registrado así en tu sesión.
                        </span>
                    </p>
                </div>
            )}

            <div className="mt-6">
                <AnxietyScale
                    idPrefix="pre-session-anxiety"
                    question="Del 0 al 10, ¿qué tan nervioso te sientes ahora mismo por sustentar?"
                    value={anxiety}
                    onChange={(value) => {
                        setAnxiety(value);
                        // A new self-report means a new suggestion; an override made
                        // for the previous answer should not silently carry over.
                        setChosenLevel(null);
                    }}
                    disabled={disabled}
                />
            </div>

            <div className="mt-6 rounded-xl border border-[#f3e4c7] bg-[#fff6e5] p-4">
                <p className="flex items-start gap-2 text-sm text-[#663820]">
                    <Sparkles className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>
                        <strong>Nivel sugerido: {ORDERED_DIFFICULTY_LEVELS[suggestion.level - 1].name}.</strong>{' '}
                        {suggestion.reason}
                    </span>
                </p>
                {preparation?.previousStartedAt && (
                    <p className="mt-2 pl-6 text-xs text-[#8a7350]">
                        Tu sesión anterior con esta investigación fue el{' '}
                        {dateFormatter.format(new Date(preparation.previousStartedAt))}.
                    </p>
                )}
            </div>

            <fieldset disabled={disabled} className="mt-6">
                <legend className="text-sm font-semibold text-[#212a3b]">
                    Nivel de exigencia de esta sesión
                </legend>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {ORDERED_DIFFICULTY_LEVELS.map((level) => {
                        const id = `difficulty-level-${level.id}`;
                        const isSelected = effectiveLevel === level.id;
                        const isSuggested = suggestion.level === level.id;
                        return (
                            <label
                                key={level.id}
                                htmlFor={id}
                                className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-4 transition-colors ${
                                    isSelected
                                        ? 'border-[#663820] bg-[#fff6e5]'
                                        : 'border-black/10 bg-white hover:bg-[#fff6e5]'
                                } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                            >
                                <span className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-semibold text-[#212a3b]">
                                        {level.id}. {level.name}
                                    </span>
                                    {isSuggested && (
                                        <span className="rounded-full bg-[#663820] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                                            Sugerido
                                        </span>
                                    )}
                                </span>
                                <input
                                    id={id}
                                    type="radio"
                                    name="difficulty-level"
                                    className="sr-only"
                                    checked={isSelected}
                                    onChange={() => setChosenLevel(level.id)}
                                />
                                <span className="text-xs text-[#3d485e]">{level.tagline}</span>
                                <span className="text-xs text-[#6b7280]">{describeRules(level)}</span>
                            </label>
                        );
                    })}
                </div>
            </fieldset>

            <fieldset disabled={disabled} className="mt-6 rounded-xl border border-black/10 p-4">
                <legend className="px-1 text-sm font-semibold text-[#212a3b]">
                    Antes de entrar (opcional)
                </legend>
                <p className="text-sm text-[#3d485e]">
                    Al terminar, el sistema contrasta lo que escribas aquí con lo que quedó
                    registrado en la sesión. Puedes dejarlo en blanco y empezar igual.
                </p>

                <div className="mt-4 space-y-4">
                    {ORDERED_PREDICTION_QUESTIONS.map((question) => {
                        const id = `prediction-${question.id}`;
                        return (
                            <div key={question.id}>
                                <label htmlFor={id} className="block text-sm font-medium text-[#212a3b]">
                                    {question.prompt}
                                </label>
                                <textarea
                                    id={id}
                                    rows={2}
                                    maxLength={MAX_PREDICTION_CHARS}
                                    value={prediction[question.id] ?? ''}
                                    onChange={(event) => setAnswer(question.id, event.target.value)}
                                    placeholder={question.placeholder}
                                    className="mt-1 w-full rounded-lg border border-black/10 bg-white p-3 text-sm text-[#212a3b] placeholder:text-[#9aa3b2] focus:border-[#663820] focus:outline-none disabled:opacity-60"
                                />
                            </div>
                        );
                    })}
                </div>
            </fieldset>

            {isOverridden && (
                <p className="mt-4 flex items-start gap-2 text-xs text-[#6b7280]">
                    <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    Elegiste un nivel distinto al sugerido. Queda registrado así en tu sesión.
                </p>
            )}

            <button
                type="button"
                disabled={disabled}
                onClick={() =>
                    onStart({
                        difficultyLevel: effectiveLevel,
                        preSessionAnxiety: anxiety,
                        focusTopics,
                        prediction,
                    })
                }
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#212a3b] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#3d485e] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
                <Play className="size-4" aria-hidden="true" />
                Iniciar {ORDERED_DIFFICULTY_LEVELS[effectiveLevel - 1].name}
            </button>

            {anxiety === null && (
                <p className="mt-3 text-xs text-[#6b7280]">
                    Puedes empezar sin responder la escala, pero tu respuesta es lo que permite
                    ajustar la exigencia sesión a sesión.
                </p>
            )}
        </section>
    );
}
