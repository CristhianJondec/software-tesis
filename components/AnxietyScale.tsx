'use client';

import { ANXIETY_SCALE_MAX, ANXIETY_SCALE_MIN } from '@/lib/difficulty/adaptation';

interface AnxietyScaleProps {
    /** Rendered as the <legend> of the group. */
    question: string;
    value: number | null;
    onChange: (value: number) => void;
    disabled?: boolean;
    /** Accessible name prefix, needed when two scales coexist on a page. */
    idPrefix: string;
}

const VALUES = Array.from(
    { length: ANXIETY_SCALE_MAX - ANXIETY_SCALE_MIN + 1 },
    (_, i) => ANXIETY_SCALE_MIN + i,
);

/**
 * The 0-10 self-report of the student.
 *
 * It is a SELF-REPORT and the labels say so ("¿qué tan nervioso te sientes?").
 * Nothing in this component, or in anything reading its value, may present the
 * number as a measurement the system took: the system asks, the student answers.
 */
export default function AnxietyScale({
    question,
    value,
    onChange,
    disabled = false,
    idPrefix,
}: AnxietyScaleProps) {
    return (
        <fieldset disabled={disabled} className="min-w-0">
            <legend className="text-sm font-semibold leading-6 text-[#212a3b]">{question}</legend>

            <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={question}>
                {VALUES.map((option) => {
                    const id = `${idPrefix}-${option}`;
                    const isSelected = value === option;
                    return (
                        <label
                            key={option}
                            htmlFor={id}
                            className={`flex size-10 cursor-pointer items-center justify-center rounded-lg border text-sm font-semibold transition-colors ${
                                isSelected
                                    ? 'border-[#663820] bg-[#663820] text-white'
                                    : 'border-black/10 bg-white text-[#212a3b] hover:bg-[#fff6e5]'
                            } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                        >
                            <input
                                id={id}
                                type="radio"
                                name={idPrefix}
                                className="sr-only"
                                checked={isSelected}
                                onChange={() => onChange(option)}
                            />
                            {option}
                        </label>
                    );
                })}
            </div>

            <div className="mt-2 flex justify-between text-xs text-[#6b7280]">
                <span>{ANXIETY_SCALE_MIN} — Nada nervioso</span>
                <span>{ANXIETY_SCALE_MAX} — Muy nervioso</span>
            </div>
        </fieldset>
    );
}
