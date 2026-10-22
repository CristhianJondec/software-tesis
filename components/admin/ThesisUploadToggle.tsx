'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { setThesisUploadEnabled } from '@/lib/actions/study.actions';
import { cn } from '@/lib/utils';

/** True/false switch that opens thesis upload to the experimental arm. */
export default function ThesisUploadToggle({ enabled }: { enabled: boolean }) {
    const [current, setCurrent] = useState(enabled);
    const [isPending, startTransition] = useTransition();

    const toggle = () => {
        const next = !current;
        setCurrent(next);
        startTransition(async () => {
            const result = await setThesisUploadEnabled(next);
            if (!result.success) {
                setCurrent(!next);
                toast.error(result.error ?? 'No se pudo cambiar el estado.');
                return;
            }
            toast.success(next ? 'Subida de tesis habilitada.' : 'Subida de tesis deshabilitada.');
        });
    };

    return (
        <button
            type="button"
            role="switch"
            aria-checked={current}
            aria-label="Habilitar la subida de tesis para el grupo experimental"
            disabled={isPending}
            onClick={toggle}
            className={cn(
                'inline-flex items-center gap-3 rounded-full border px-2 py-1.5 text-sm font-semibold transition-colors disabled:opacity-60',
                current ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-black/15 bg-gray-100 text-gray-600',
            )}
        >
            <span
                className={cn(
                    'relative h-6 w-11 rounded-full transition-colors',
                    current ? 'bg-emerald-600' : 'bg-gray-400',
                )}
            >
                <span
                    className={cn(
                        'absolute top-0.5 size-5 rounded-full bg-white shadow transition-all',
                        current ? 'left-[22px]' : 'left-0.5',
                    )}
                />
            </span>
            <span className="pr-2">{current ? 'true · Habilitada' : 'false · Deshabilitada'}</span>
        </button>
    );
}
