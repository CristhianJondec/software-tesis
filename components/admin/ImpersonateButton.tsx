'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, LogOut } from 'lucide-react';
import { toast } from 'sonner';

import { startImpersonation, stopImpersonation } from '@/lib/actions/impersonation.actions';

/** "Entrar como" button of the participant list in /admin. */
export function ImpersonateButton({ userId, label }: { userId: string; label: string }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    return (
        <button
            type="button"
            disabled={isPending}
            onClick={() =>
                startTransition(async () => {
                    const result = await startImpersonation(userId);
                    if (!result.success || !result.data) {
                        toast.error(result.error ?? 'No se pudo entrar como el usuario.');
                        return;
                    }
                    toast.success(`Ahora actúas como ${label}.`);
                    router.push(result.data.redirectTo);
                    router.refresh();
                })
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-black/15 bg-white px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-[#663820] transition-colors hover:bg-[#fff6e5] disabled:opacity-60"
        >
            <LogIn className="size-3.5" /> {isPending ? 'Entrando…' : 'Entrar como'}
        </button>
    );
}

/** Banner shown on every page while the admin is acting as a participant. */
export function ImpersonationBanner({ label }: { label: string }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    return (
        <div className="sticky top-0 z-[60] flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-[#663820] px-4 py-2 text-center text-sm text-white">
            <span>
                Estás actuando como <strong>{label}</strong>. Todo lo que hagas se guarda en su cuenta.
            </span>
            <button
                type="button"
                disabled={isPending}
                onClick={() =>
                    startTransition(async () => {
                        await stopImpersonation();
                        router.push('/admin');
                        router.refresh();
                    })
                }
                className="inline-flex items-center gap-1.5 rounded-md bg-white/15 px-3 py-1 font-semibold hover:bg-white/25 disabled:opacity-60"
            >
                <LogOut className="size-3.5" /> {isPending ? 'Saliendo…' : 'Volver a mi cuenta'}
            </button>
        </div>
    );
}
