'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { setParticipantCode } from '@/lib/actions/study.actions';

/**
 * Edits the participant code that de-identifies the exported data. Saved in
 * upper case on blur or Enter; empty clears it.
 */
export default function ParticipantCodeInput({
    userId,
    value,
    participantLabel,
}: {
    userId: string;
    value: string | null;
    participantLabel: string;
}) {
    const initial = value ?? '';
    const [saved, setSaved] = useState(initial);
    const [current, setCurrent] = useState(initial);
    const [isPending, startTransition] = useTransition();

    const save = () => {
        const next = current.trim().toUpperCase();
        if (next === saved) {
            setCurrent(saved);
            return;
        }

        startTransition(async () => {
            const result = await setParticipantCode(userId, next);
            if (!result.success) {
                setCurrent(saved);
                toast.error(result.error ?? 'No se pudo guardar el código.');
                return;
            }
            setSaved(next);
            setCurrent(next);
            toast.success(next ? `Código de ${participantLabel}: ${next}.` : `Código de ${participantLabel} eliminado.`);
        });
    };

    return (
        <input
            type="text"
            value={current}
            maxLength={32}
            placeholder="Sin código"
            disabled={isPending}
            aria-label={`Código de ${participantLabel}`}
            onChange={(event) => setCurrent(event.target.value)}
            onBlur={save}
            onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
                if (event.key === 'Escape') {
                    setCurrent(saved);
                    event.currentTarget.blur();
                }
            }}
            className="w-28 rounded-lg border border-black/15 bg-white px-2 py-1 font-mono text-sm uppercase placeholder:font-sans placeholder:normal-case disabled:opacity-60"
        />
    );
}
