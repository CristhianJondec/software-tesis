import { Check, Circle, Clock3, LockKeyhole, Minus, ShieldCheck, UsersRound } from 'lucide-react';

import ExportSurveyCsvButton from '@/components/admin/ExportSurveyCsvButton';
import { checkAdminAccess } from '@/lib/admin/access';
import { getAdminSurveyOverview, type SurveyStageStatus } from '@/lib/actions/survey.actions';
import { formatDateTime } from '@/lib/metrics/format';
import { SURVEY_INSTRUMENTS } from '@/lib/surveys/catalog';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Administración — Investfied' };
export const dynamic = 'force-dynamic';

const statusConfig: Record<SurveyStageStatus, { label: string; icon: typeof Circle; className: string }> = {
    pending: { label: 'Pendiente', icon: LockKeyhole, className: 'bg-gray-100 text-gray-600' },
    available: { label: 'Disponible', icon: Circle, className: 'bg-[#fff6e5] text-[#663820]' },
    completed: { label: 'Completada', icon: Check, className: 'bg-emerald-50 text-emerald-700' },
    not_applicable: { label: 'No aplica', icon: Minus, className: 'bg-slate-100 text-slate-600' },
};

function score(value: number | null): string {
    return value === null ? '—' : String(value);
}

export default async function AdminPage() {
    const access = await checkAdminAccess();
    if (!access.allowed) {
        return (
            <main className="wrapper container">
                <div className="max-w-2xl rounded-2xl border border-black/10 bg-white p-8 shadow-sm">
                    <ShieldCheck className="mb-4 size-10 text-[#663820]" />
                    <h1 className="page-title-xl">Panel de administración</h1>
                    <p className="subtitle mt-4">{access.reason}</p>
                </div>
            </main>
        );
    }

    const result = await getAdminSurveyOverview();
    if (!result.success || !result.data) {
        return (
            <main className="wrapper container">
                <h1 className="page-title-xl">Panel de administración</h1>
                <p className="subtitle mt-4">{result.error ?? 'No se pudo cargar el panel.'}</p>
            </main>
        );
    }

    const users = result.data;
    const completedUsers = users.filter((user) =>
        user.stages.filter((stage) => stage.status !== 'not_applicable').every((stage) => stage.status === 'completed'),
    ).length;

    return (
        <main className="wrapper container">
            <header className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
                <div>
                    <p className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-[#663820]">
                        <ShieldCheck className="size-4" /> Acceso restringido
                    </p>
                    <h1 className="page-title-xl">Usuarios y encuestas</h1>
                    <p className="subtitle mt-3">Registro completo de participantes, avance, respuestas crudas y puntajes calculados.</p>
                </div>
                <ExportSurveyCsvButton />
            </header>

            <section className="mb-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-black/10 bg-white p-5 shadow-sm">
                    <p className="text-sm font-semibold text-[var(--text-secondary)]">Usuarios registrados</p>
                    <p className="mt-2 font-serif text-3xl font-bold">{users.length}</p>
                </div>
                <div className="rounded-xl border border-black/10 bg-white p-5 shadow-sm">
                    <p className="text-sm font-semibold text-[var(--text-secondary)]">Instrumentos completados</p>
                    <p className="mt-2 font-serif text-3xl font-bold">
                        {users.reduce((total, user) => total + user.responses.length, 0)}
                    </p>
                </div>
                <div className="rounded-xl border border-black/10 bg-white p-5 shadow-sm">
                    <p className="text-sm font-semibold text-[var(--text-secondary)]">Usuarios con flujo completo</p>
                    <p className="mt-2 font-serif text-3xl font-bold">{completedUsers}</p>
                </div>
            </section>

            {users.length === 0 ? (
                <section className="rounded-2xl border border-dashed border-black/20 bg-white p-12 text-center">
                    <UsersRound className="mx-auto mb-4 size-10 text-[#663820]" />
                    <h2 className="font-serif text-2xl font-bold">Aún no hay usuarios registrados</h2>
                </section>
            ) : (
                <>
                    <section className="mb-8 overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
                        <div className="border-b border-black/10 px-5 py-4">
                            <h2 className="font-serif text-xl font-bold">Resumen para análisis</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1050px] text-left text-sm">
                                <thead className="bg-[#fff6e5]">
                                    <tr>
                                        <th className="px-4 py-3">Participante</th>
                                        <th className="px-4 py-3">Grupo</th>
                                        <th className="px-4 py-3 text-center">AE T1</th>
                                        <th className="px-4 py-3 text-center">AE T2</th>
                                        <th className="px-4 py-3 text-center">Δ AE</th>
                                        <th className="px-4 py-3 text-center">AC T1</th>
                                        <th className="px-4 py-3 text-center">AC T2</th>
                                        <th className="px-4 py-3 text-center">Δ AC</th>
                                        <th className="px-4 py-3 text-center">SUS</th>
                                        <th className="px-4 py-3">Etapas</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((user) => (
                                        <tr key={user.id} className="border-t border-black/5 align-top">
                                            <td className="px-4 py-3">
                                                <p className="font-semibold">{user.participantCode ?? 'Sin código'} · {user.name}</p>
                                                <p className="max-w-56 truncate text-xs text-[var(--text-secondary)]">{user.email}</p>
                                            </td>
                                            <td className="px-4 py-3 capitalize">{user.studyGroup ?? 'Sin asignar'}</td>
                                            <td className="px-4 py-3 text-center">{score(user.scores.aeT1)}</td>
                                            <td className="px-4 py-3 text-center">{score(user.scores.aeT2)}</td>
                                            <td className="px-4 py-3 text-center font-semibold">{score(user.scores.aeDelta)}</td>
                                            <td className="px-4 py-3 text-center">{score(user.scores.acT1)}</td>
                                            <td className="px-4 py-3 text-center">{score(user.scores.acT2)}</td>
                                            <td className="px-4 py-3 text-center font-semibold">{score(user.scores.acDelta)}</td>
                                            <td className="px-4 py-3 text-center">{score(user.scores.sus)}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-1.5">
                                                    {user.stages.map((stage) => {
                                                        const config = statusConfig[stage.status];
                                                        const Icon = config.icon;
                                                        return (
                                                            <span key={stage.id} title={`${stage.shortTitle}: ${config.label}`} className={cn('rounded-full p-1.5', config.className)}>
                                                                <Icon className="size-3.5" />
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section className="grid gap-4">
                        <h2 className="font-serif text-2xl font-bold">Detalle por usuario</h2>
                        {users.map((user) => (
                            <details key={user.id} className="group rounded-xl border border-black/10 bg-white shadow-sm">
                                <summary className="flex cursor-pointer list-none flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center">
                                    <div>
                                        <h3 className="font-serif text-lg font-bold">{user.participantCode ?? 'Sin código'} · {user.name}</h3>
                                        <p className="text-sm text-[var(--text-secondary)]">{user.email} · Alta: {formatDateTime(user.createdAt)}</p>
                                    </div>
                                    <span className="text-sm font-semibold text-[#663820] group-open:hidden">Ver respuestas y fechas</span>
                                    <span className="hidden text-sm font-semibold text-[#663820] group-open:inline">Ocultar detalle</span>
                                </summary>
                                <div className="border-t border-black/10 p-5">
                                    <div className="mb-6 grid gap-3 md:grid-cols-5">
                                        {user.stages.map((stage) => {
                                            const config = statusConfig[stage.status];
                                            const Icon = config.icon;
                                            return (
                                                <div key={stage.id} className="rounded-lg border border-black/10 p-3">
                                                    <p className="text-xs font-bold">{stage.shortTitle}</p>
                                                    <span className={cn('mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold', config.className)}>
                                                        <Icon className="size-3" /> {config.label}
                                                    </span>
                                                    {stage.submittedAt && <p className="mt-2 text-xs text-[var(--text-secondary)]"><Clock3 className="mr-1 inline size-3" />{formatDateTime(stage.submittedAt)}</p>}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {user.responses.length === 0 ? (
                                        <p className="text-sm text-[var(--text-secondary)]">Este usuario todavía no ha enviado ninguna encuesta.</p>
                                    ) : (
                                        <div className="grid gap-5">
                                            {user.responses.map((response) => {
                                                const stage = user.stages.find((item) => item.id === response.stageId)!;
                                                const questions = SURVEY_INSTRUMENTS[stage.type].questions;
                                                return (
                                                    <details key={response.stageId} className="rounded-lg border border-black/10">
                                                        <summary className="cursor-pointer list-none p-4 font-semibold">
                                                            {response.title} · {response.scoreLabel} = {response.computedScore}
                                                            <span className="ml-2 text-xs font-normal text-[var(--text-secondary)]">{formatDateTime(response.submittedAt)}</span>
                                                        </summary>
                                                        <ol className="border-t border-black/10 p-4 text-sm">
                                                            {questions.map((question, index) => (
                                                                <li key={question} className="grid gap-1 border-b border-black/5 py-3 last:border-0 sm:grid-cols-[1fr_auto] sm:gap-5">
                                                                    <span><strong>{index + 1}.</strong> {question}</span>
                                                                    <span className="font-bold text-[#663820]">Respuesta cruda: {response.answers[index]}</span>
                                                                </li>
                                                            ))}
                                                        </ol>
                                                    </details>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </details>
                        ))}
                    </section>
                </>
            )}
        </main>
    );
}
