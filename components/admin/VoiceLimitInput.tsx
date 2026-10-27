'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import {
    setGlobalThesisUploadLimit,
    setGlobalVoiceLimit,
    setUserThesisUploadLimit,
    setUserVoiceLimit,
} from '@/lib/actions/study.actions';

const KINDS = {
    // Empty global = unlimited (lib/study/usage.ts).
    voice: { setGlobal: setGlobalVoiceLimit, setUser: setUserVoiceLimit, unit: 'minutos', emptyGlobal: 'sin límite' },
    // Empty global = the default cap (lib/study/uploads.ts).
    uploads: {
        setGlobal: setGlobalThesisUploadLimit,
        setUser: setUserThesisUploadLimit,
        unit: 'investigaciones',
        emptyGlobal: 'vuelve al valor por defecto',
    },
} as const;

/**
 * Edits a per-account cap: total voice-agent minutes (`kind="voice"`) or thesis
 * uploads (`kind="uploads"`). With `userId` it edits that account's personal
 * cap (empty = falls back to the global one); without it, the global cap.
 * Saves on blur or Enter.
 */
export default function VoiceLimitInput({
    kind = 'voice',
    userId,
    value,
    placeholder,
    label,
}: {
    kind?: keyof typeof KINDS;
    userId?: string;
    value: number | null;
    placeholder: string;
    label: string;
}) {
    const config = KINDS[kind];
    const initial = value === null ? '' : String(value);
    const [saved, setSaved] = useState(initial);
    const [current, setCurrent] = useState(initial);
    const [isPending, startTransition] = useTransition();

    const save = () => {
        const next = current.trim();
        if (next === saved) return;

        startTransition(async () => {
            const result = userId ? await config.setUser(userId, next) : await config.setGlobal(next);
            if (!result.success) {
                setCurrent(saved);
                toast.error(result.error ?? 'No se pudo guardar el límite.');
                return;
            }
            setSaved(next);
            toast.success(
                next
                    ? `${label}: ${next} ${config.unit}.`
                    : userId
                      ? `${label}: usa el límite general.`
                      : `${label}: ${config.emptyGlobal}.`,
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
