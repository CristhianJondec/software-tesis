import Link from 'next/link';

import TurnReviewList from '@/components/metrics/TurnReviewList';
import { getTurnsForReview, type ReviewFilter } from '@/lib/actions/metrics.actions';
import { checkMetricsAccess } from '@/lib/metrics/access';
import { formatNumber, formatPercent } from '@/lib/metrics/format';

export const metadata = { title: 'Revisión de respuestas — Investfied' };

export const dynamic = 'force-dynamic';

const FILTERS: { value: ReviewFilter; label: string }[] = [
    { value: 'pendientes', label: 'Pendientes' },
    { value: 'revisados', label: 'Revisados' },
    { value: 'todos', label: 'Todos' },
];

function parseFilter(value: string | undefined): ReviewFilter {
    return value === 'revisados' || value === 'todos' ? value : 'pendientes';
}

const ReviewPage = async ({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) => {
    const access = await checkMetricsAccess();

    if (!access.allowed) {
        return (
            <main className="wrapper container">
                <h1 className="page-title-xl">Revisión de respuestas</h1>
                <p className="subtitle mt-4 max-w-2xl">{access.reason}</p>
            </main>
        );
    }

    const { filtro } = await searchParams;
    const filter = parseFilter(filtro);
    const result = await getTurnsForReview(filter);

    if (!result.success || !result.data) {
        return (
            <main className="wrapper container">
                <h1 className="page-title-xl">Revisión de respuestas</h1>
                <p className="subtitle mt-4 max-w-2xl">{result.error}</p>
            </main>
        );
    }

    const { turns, pending, reviewed, total } = result.data;
    const percentage = reviewed === 0 ? null : (reviewed / total) * 100;

    return (
        <main className="wrapper container">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h1 className="page-title-xl">Revisión de respuestas</h1>
                <Link href="/metrics" className="text-sm underline underline-offset-2">
                    Volver a métricas
                </Link>
            </div>

            <p className="subtitle mt-3 max-w-3xl">
                Marca cada respuesta del agente como correcta o incorrecta. Estas marcas son el
                numerador y el denominador de PR: un turno sin marcar no cuenta como error, cuenta
                como pendiente.
            </p>

            <div className="mt-5 max-w-3xl rounded-xl border border-black/10 bg-white/70 p-5 text-sm leading-6">
                <p className="font-semibold">Criterio de revisión</p>
                <p className="mt-1 text-[var(--text-secondary)]">
                    Marca <strong>Correcta</strong> cuando la intervención sea coherente con los
                    fragmentos recuperados, relevante para lo dicho por el estudiante y adecuada
                    al rol de docente evaluador. Marca <strong>Incorrecta</strong> si contradice el
                    documento, inventa información, resulta irrelevante o no constituye una
                    intervención comprensible. Usa la nota para justificar los casos dudosos.
                </p>
            </div>

            <p className="mt-3 text-sm text-[var(--text-secondary)]">
                {formatNumber(reviewed)} de {formatNumber(total)} turnos revisados (
                {formatPercent(percentage)}) · {formatNumber(pending)} pendientes
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
                {FILTERS.map((option) => (
                    <Link
                        key={option.value}
                        href={`/metrics/revision?filtro=${option.value}`}
                        className={
                            option.value === filter
                                ? 'rounded-full bg-[var(--accent-warm)] px-4 py-2 text-sm font-medium text-white'
                                : 'rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-medium'
                        }
                    >
                        {option.label}
                    </Link>
                ))}
            </div>

            <TurnReviewList key={filter} turns={turns} />

            {turns.length > 0 && turns.length < (filter === 'pendientes' ? pending : total) && (
                <p className="mt-6 text-sm text-[var(--text-secondary)]">
                    Se muestran los primeros {turns.length}. Marca estos y recarga para ver los
                    siguientes.
                </p>
            )}
        </main>
    );
};

export default ReviewPage;
