import Link from 'next/link';
import { Check, Circle, Clock3, LockKeyhole, Minus, Timer } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getSurveyProgress, type SurveyStageStatus } from '@/lib/actions/survey.actions';
import { formatDateTime } from '@/lib/metrics/format';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Encuestas — Investfied' };
export const dynamic = 'force-dynamic';

const statusConfig: Record<SurveyStageStatus, { label: string; icon: typeof Circle; className: string }> = {
    pending: { label: 'Pendiente', icon: LockKeyhole, className: 'bg-gray-100 text-gray-600' },
    available: { label: 'Disponible', icon: Circle, className: 'bg-[#fff6e5] text-[#663820]' },
    completed: { label: 'Completada', icon: Check, className: 'bg-emerald-50 text-emerald-700' },
    not_applicable: { label: 'No aplica', icon: Minus, className: 'bg-slate-100 text-slate-600' },
};

export default async function SurveysPage() {
    const result = await getSurveyProgress();
    if (!result.success || !result.data) {
        return (
            <main className="wrapper container">
                <h1 className="page-title-xl">Encuestas</h1>
                <p className="subtitle mt-4">{result.error ?? 'No se pudieron cargar las encuestas.'}</p>
            </main>
        );
    }

    const progress = result.data;
    const percent = progress.applicableCount === 0 ? 0 : Math.round((progress.completedCount / progress.applicableCount) * 100);

    return (
        <main className="wrapper container">
            <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
                <div>
                    <p className="mb-2 text-sm font-bold uppercase tracking-[0.18em] text-[#663820]">Instrumentos de investigación</p>
                    <h1 className="page-title-xl">Encuestas</h1>
                    <p className="subtitle mt-3 max-w-2xl">
                        Completa las etapas en orden. Cada respuesta enviada queda cerrada para preservar la integridad del estudio.
                    </p>
                </div>
                {(progress.participantCode || progress.studyGroup) && (
                    <div className="rounded-xl border border-black/10 bg-white px-5 py-4 text-sm shadow-sm">
                        {progress.participantCode && <p><strong>Código:</strong> {progress.participantCode}</p>}
                        {progress.studyGroup && <p className="capitalize"><strong>Grupo:</strong> {progress.studyGroup}</p>}
                    </div>
                )}
            </div>

            <section className="mb-8 rounded-2xl bg-[#212a3b] p-6 text-white shadow-md">
                <div className="mb-3 flex items-center justify-between gap-4">
                    <p className="font-semibold">Progreso general</p>
                    <p className="text-sm">{progress.completedCount} de {progress.applicableCount} etapas · {percent}%</p>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-white/15">
                    <div className="h-full rounded-full bg-[#d4a853] transition-all" style={{ width: `${percent}%` }} />
                </div>
            </section>

            <section aria-label="Etapas de las encuestas" className="grid gap-4">
                {progress.stages.map((stage, index) => {
                    const status = statusConfig[stage.status];
                    const Icon = status.icon;
                    return (
                        <article key={stage.id} className="rounded-xl border border-black/10 bg-white p-5 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-6">
                            <div className="flex gap-4">
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#f3e4c7] font-serif text-lg font-bold text-[#663820]">
                                    {index + 1}
                                </span>
                                <div>
                                    <h2 className="font-serif text-xl font-bold text-[#212a3b]">{stage.title}</h2>
                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                                        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold', status.className)}>
                                            <Icon className="size-3.5" /> {status.label}
                                        </span>
                                        <span className="inline-flex items-center gap-1.5 text-[var(--text-secondary)]">
                                            <Timer className="size-3.5" /> ~ {stage.estimatedMinutes} minutos
                                        </span>
                                        {stage.submittedAt && (
                                            <span className="inline-flex items-center gap-1.5 text-[var(--text-secondary)]">
                                                <Clock3 className="size-3.5" /> {formatDateTime(stage.submittedAt)}
                                            </span>
                                        )}
                                    </div>
                                    {stage.status === 'pending' && stage.blockedReason && (
                                        <p className="mt-2 text-sm text-[var(--text-secondary)]">{stage.blockedReason}</p>
                                    )}
                                </div>
                            </div>
                            <div className="mt-4 shrink-0 sm:mt-0">
                                {stage.status === 'available' && (
                                    <Button asChild className="w-full bg-[#663820] hover:bg-[#7a4528] sm:w-auto">
                                        <Link href={`/surveys/${stage.id}`}>Responder ahora</Link>
                                    </Button>
                                )}
                            </div>
                        </article>
                    );
                })}
            </section>
        </main>
    );
}
