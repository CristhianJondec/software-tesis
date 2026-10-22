'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { setGlobalVoiceLimit, setUserVoiceLimit } from '@/lib/actions/study.actions';

/**
 * Edits a cap on total voice-agent minutes. With `userId` it edits that
 * account's personal cap (empty = falls back to the global one); without it,
 * the global cap (empty = unlimited). Saves on blur or Enter.
 */
export default function VoiceLimitInput({
    userId,
    value,
    placeholder,
    label,
}: {
    userId?: string;
    value: number | null;
    placeholder: string;
    label: string;
}) {
    const initial = value === null ? '' : String(value);
    const [saved, setSaved] = useState(initial);
    const [current, setCurrent] = useState(initial);
    const [isPending, startTransition] = useTransition();

    const save = () => {
        const next = current.trim();
        if (next === saved) return;

        startTransition(async () => {
            const result = userId ? await setUserVoiceLimit(userId, next) : await setGlobalVoiceLimit(next);
            if (!result.success) {
                setCurrent(saved);
                toast.error(result.error ?? 'No se pudo guardar el límite.');
                return;
            }
            setSaved(next);
            toast.success(
                next
                    ? `${label}: ${next} minutos.`
                    : userId
                      ? `${label}: usa el límite general.`
                      : `${label}: sin límite.`,
            );
        });
    };

    return (
        <input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={current}
            placeholder={placeholder}
            disabled={isPending}
            aria-label={label}
            onChange={(event) => setCurrent(event.target.value)}
            onBlur={save}
            onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
            }}
            className="w-24 rounded-lg border border-black/15 bg-white px-2 py-1.5 text-sm disabled:opacity-60"
        />
    );
}
