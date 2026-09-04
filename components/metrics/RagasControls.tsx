'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { clearRagasScores, recomputeRagas } from '@/lib/actions/metrics.actions';

/**
 * Runs the RAGAs judge over the triples that do not have a score yet.
 *
 * One batch per click on purpose: each triple costs six judge calls, so a
 * "score everything" button would time out on a real corpus and leave the run
 * half done with no way to tell how far it got.
 */
export default function RagasControls({ pending }: { pending: number }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const handleCompute = () => {
        startTransition(async () => {
            const result = await recomputeRagas();

            if (!result.success || !result.data) {
                toast.error(result.error ?? 'No se pudo calcular RAGAs.');
                return;
            }

            const { computed, failed, remaining } = result.data;
            if (computed === 0 && failed === 0) {
                toast.info('No quedan ternas pendientes.');
            } else {
                toast.success(
                    `${computed} ternas evaluadas${failed > 0 ? `, ${failed} con error` : ''}. ` +
                        `Quedan ${remaining}.`,
                );
            }

            router.refresh();
        });
    };

    const handleClear = () => {
        const confirmed = window.confirm(
            'Se borrarán todos los puntajes RAGAs de la versión de prompt actual. ' +
                'Habrá que volver a calcularlos. ¿Continuar?',
        );
        if (!confirmed) return;

        startTransition(async () => {
            const result = await clearRagasScores();
            if (!result.success) {
                toast.error(result.error ?? 'No se pudieron borrar los puntajes.');
                return;
            }
            toast.success('Puntajes borrados.');
            router.refresh();
        });
    };

    return (
        <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleCompute} disabled={isPending || pending === 0} className="w-fit">
                <RefreshCw className={`icon-sm ${isPending ? 'animate-spin' : ''}`} />
                {isPending ? 'Evaluando…' : `Calcular ternas pendientes (${pending})`}
            </Button>
            <Button variant="ghost" onClick={handleClear} disabled={isPending} className="w-fit">
                <Trash2 className="icon-sm" />
                Borrar puntajes y recalcular desde cero
            </Button>
        </div>
    );
}
