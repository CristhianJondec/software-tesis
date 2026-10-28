'use client';

import { useState, useTransition } from 'react';
import { Copy, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

import { revealEnvVar } from '@/lib/actions/diagnostics.actions';

/**
 * Value cell of an environment variable in /admin/diagnostico. Secrets show
 * only their last four characters until "Mostrar" fetches the value from the
 * server, so it is never part of the rendered page.
 */
export default function EnvVarValue({ name, preview }: { name: string; preview: string }) {
    const [value, setValue] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const reveal = () => {
        startTransition(async () => {
            const result = await revealEnvVar(name);
            if (!result.success || result.value === undefined) {
                toast.error(result.error ?? 'No se pudo leer la variable.');
                return;
            }
            setValue(result.value);
        });
    };

    const copy = async () => {
        if (value === null) return;
        try {
            await navigator.clipboard.writeText(value);
            toast.success(`${name} copiada.`);
        } catch {
            toast.error('No se pudo copiar.');
        }
    };

    const buttonClass =
        'inline-flex items-center gap-1 rounded-md border border-black/15 bg-white px-2 py-1 text-xs font-semibold text-[#663820] hover:bg-[#fff6e5] disabled:opacity-60';

    return (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
            <code className="min-w-0 rounded bg-[#f7f2e6] px-2 py-1 text-xs break-all">{value ?? preview}</code>
            {value === null ? (
                <button type="button" onClick={reveal} disabled={isPending} className={buttonClass}>
                    <Eye className="size-3.5" /> {isPending ? 'Cargando…' : 'Mostrar'}
                </button>
            ) : (
                <>
                    <button type="button" onClick={copy} className={buttonClass}>
                        <Copy className="size-3.5" /> Copiar
                    </button>
                    <button type="button" onClick={() => setValue(null)} className={buttonClass}>
                        <EyeOff className="size-3.5" /> Ocultar
                    </button>
                </>
            )}
        </div>
    );
}
