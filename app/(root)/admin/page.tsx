import { Check, Circle, Clock3, LockKeyhole, Minus, ShieldCheck, UsersRound } from 'lucide-react';

import ExportSurveyCsvButton from '@/components/admin/ExportSurveyCsvButton';
import AdminFilters from '@/components/admin/AdminFilters';
import ExportThesisXlsxButton from '@/components/admin/ExportThesisXlsxButton';
import MaterialsManager from '@/components/admin/MaterialsManager';
import StudyGroupSelect from '@/components/admin/StudyGroupSelect';
import VoiceLimitInput from '@/components/admin/VoiceLimitInput';
import ThesisUploadToggle from '@/components/admin/ThesisUploadToggle';
import { getThesisUploadEnabled, getVoiceUsageOverview } from '@/lib/actions/study.actions';
import { checkAdminAccess } from '@/lib/admin/access';
import { filterAdminUsers, parseAdminFilters } from '@/lib/admin/filters';
import { listStudyMaterialsForAdmin } from '@/lib/actions/material.actions';
import { getAdminSurveyOverview, type SurveyStageStatus } from '@/lib/actions/survey.actions';
import { formatDateTime } from '@/lib/metrics/format';
import { normalizeStudyGroup } from '@/lib/study/groups';
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

function formatMinutes(seconds: number): string {
    return `${Math.round((seconds / 60) * 10) / 10} min`;
}

export default async function AdminPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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

    const [result, materialsResult, usageResult, uploadFlagResult] = await Promise.all([
        getAdminSurveyOverview(),
        listStudyMaterialsForAdmin(),
        getVoiceUsageOverview(),
        getThesisUploadEnabled(),
    ]);
    if (!result.success || !result.data) {
        return (
            <main className="wrapper container">
                <h1 className="page-title-xl">Panel de administración</h1>
                <p className="subtitle mt-4">{result.error ?? 'No se pudo cargar el panel.'}</p>
            </main>
        );
    }

    const users = result.data;
    const filters = parseAdminFilters(await searchParams);
    const filteredUsers = filterAdminUsers(users, filters);
    const materials = materialsResult.success ? materialsResult.data ?? [] : [];
    const usage = usageResult.success ? usageResult.data : undefined;
    const globalLimit = usage?.globalLimitMinutes ?? null;
    const unassignedCount = users.filter((user) => normalizeStudyGroup(user.studyGroup) === null).length;
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
                    <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
                        El grupo se asigna aquí y decide qué ve cada participante: el <strong>experimental</strong>
                        {' '}accede al agente de voz y a todas las vistas; el <strong>control</strong> solo a encuestas
                        y materiales. Una cuenta <strong>sin asignar</strong> no puede entrar a ninguna de las dos.
                    </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
                    <ExportThesisXlsxButton />
                    <ExportSurveyCsvButton />
                </div>
            </header>

            <section className="mb-8 grid grid-cols-3 gap-2 sm:gap-4">
                <div className="rounded-xl border border-black/10 bg-white p-3 shadow-sm sm:p-5">
                    <p className="text-xs font-semibold text-[var(--text-secondary)] sm:text-sm">Usuarios registrados</p>
                    <p className="mt-2 font-serif text-2xl font-bold sm:text-3xl">{users.length}</p>
                </div>
                <div className="rounded-xl border border-black/10 bg-white p-3 shadow-sm sm:p-5">
                    <p className="text-xs font-semibold text-[var(--text-secondary)] sm:text-sm">Instrumentos completados</p>
                    <p className="mt-2 font-serif text-2xl font-bold sm:text-3xl">
                        {users.reduce((total, user) => total + user.responses.length, 0)}
                    </p>
                </div>
                <div className="rounded-xl border border-black/10 bg-white p-3 shadow-sm sm:p-5">
                    <p className="text-xs font-semibold text-[var(--text-secondary)] sm:text-sm">Usuarios con flujo completo</p>
                    <p className="mt-2 font-serif text-2xl font-bold sm:text-3xl">{completedUsers}</p>
                </div>
            </section>

            <section className="mb-8 grid grid-cols-3 gap-2 sm:gap-4">
                <div className="rounded-xl border border-black/10 bg-white p-3 shadow-sm sm:p-5">
                    <p className="text-xs font-semibold text-[var(--text-secondary)] sm:text-sm">Grupo experimental</p>
                    <p className="mt-2 font-serif text-2xl font-bold sm:text-3xl">
                        {users.filter((user) => normalizeStudyGroup(user.studyGroup) === 'experimental').length}
                    </p>
                </div>
                <div className="rounded-xl border border-black/10 bg-white p-3 shadow-sm sm:p-5">
                    <p className="text-xs font-semibold text-[var(--text-secondary)] sm:text-sm">Grupo control</p>
                    <p className="mt-2 font-serif text-2xl font-bold sm:text-3xl">
                        {users.filter((user) => normalizeStudyGroup(user.studyGroup) === 'control').length}
                    </p>
                </div>
                <div className="rounded-xl border border-black/10 bg-white p-3 shadow-sm sm:p-5">
                    <p className="text-xs font-semibold text-[var(--text-secondary)] sm:text-sm">Sin asignar (sin acceso)</p>
                    <p className="mt-2 font-serif text-2xl font-bold sm:text-3xl">{unassignedCount}</p>
                </div>
            </section>

            <section className="mb-10">
                <div className="mb-4">
                    <h2 className="font-serif text-2xl font-bold">Subida de tesis</h2>
                    <p className="subtitle mt-2 max-w-3xl">
                        Controla cuándo el grupo <strong>experimental</strong> puede subir su investigación. En{' '}
                        <strong>false</strong>, al entrar a «Agregar» verán un aviso de que la función estará disponible en
                        breve. Quien no haya respondido las dos encuestas de O₁ tampoco puede subir, esté como esté esta opción.
                    </p>
                </div>
                {!uploadFlagResult.success && <p className="mb-3 text-sm text-red-700">{uploadFlagResult.error}</p>}
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-black/10 bg-white p-5 shadow-sm">
                    <span className="text-sm font-semibold">Subida habilitada</span>
                    <ThesisUploadToggle enabled={uploadFlagResult.data ?? false} />
                </div>
            </section>

            <section className="mb-10">
                <div className="mb-4">
                    <h2 className="font-serif text-2xl font-bold">Tiempo de uso del agente</h2>
                    <p className="subtitle mt-2 max-w-3xl">
                        Minutos totales de conversación por voz que puede usar cada cuenta, sumando todas sus sesiones.
                        Todos parten con el <strong>límite general</strong>; si un participante tiene un{' '}
                        <strong>límite personal</strong> (columna «Límite agente» de la tabla), ese tiene prioridad.
                        Deja el campo vacío para quitar el límite.
                    </p>
                </div>
                {!usageResult.success && <p className="mb-3 text-sm text-red-700">{usageResult.error}</p>}
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-black/10 bg-white p-5 shadow-sm">
                    <span className="text-sm font-semibold">Límite general (minutos)</span>
                    <VoiceLimitInput value={globalLimit} placeholder="Sin límite" label="Límite general" />
                    <span className="text-sm text-[var(--text-secondary)]">
                        {globalLimit === null ? 'Actualmente sin límite.' : `Actualmente ${globalLimit} minutos por cuenta.`}
                    </span>
                </div>
            </section>

            <section className="mb-10">
                <div className="mb-4">
                    <h2 className="font-serif text-2xl font-bold">Materiales compartidos</h2>
                    <p className="subtitle mt-2 max-w-3xl">
                        Documentos PDF que acompañan a la guía escrita en la vista <strong>Materiales</strong> para el
                        grupo control.
                    </p>
                </div>
                {!materialsResult.success && (
                    <p className="mb-3 text-sm text-red-700">{materialsResult.error}</p>
                )}
                <MaterialsManager materials={materials} />
            </section>

            {users.length === 0 ? (
                <section className="rounded-2xl border border-dashed border-black/20 bg-white p-12 text-center">
                    <UsersRound className="mx-auto mb-4 size-10 text-[#663820]" />
                    <h2 className="font-serif text-2xl font-bold">Aún no hay usuarios registrados</h2>
                </section>
            ) : (
                <>
                    <section id="participantes" className="scroll-mt-24">
                        <h2 className="mb-3 font-serif text-2xl font-bold">Participantes</h2>
                        <AdminFilters filters={filters} shown={filteredUsers.length} total={users.length} />
                    </section>

                    {filteredUsers.length === 0 ? (
                        <section className="mb-8 rounded-xl border border-dashed border-black/20 bg-white p-8 text-center text-sm text-[var(--text-secondary)]">
                            Ningún participante coincide con los filtros.
                        </section>
                    ) : (
                        <>
                            <section className="mb-8 overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
                                <div className="border-b border-black/10 px-5 py-4">
                                    <h2 className="font-serif text-xl font-bold">Resumen para análisis</h2>
                                </div>
                                {/* Phones and tablets: one card per participant instead of the wide table. */}
                                <ul className="divide-y divide-black/5 xl:hidden">
                                    {filteredUsers.map((user) => (
                                        <li key={user.id} className="grid gap-4 p-4 sm:p-5">
                                            <div className="min-w-0">
                                                <p className="font-semibold">{user.participantCode ?? 'Sin código'} · {user.name}</p>
                                                <p className="truncate text-xs text-[var(--text-secondary)]">{user.email}</p>
                                            </div>
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <div className="grid gap-1">
                                                    <span className="text-xs font-semibold text-[var(--text-secondary)]">Grupo</span>
                                                    <StudyGroupSelect
                                                        userId={user.id}
                                                        value={normalizeStudyGroup(user.studyGroup)}
                                                        participantLabel={user.participantCode ?? user.name}
                                                    />
                                                </div>
                                                <div className="grid gap-1">
                                                    <span className="text-xs font-semibold text-[var(--text-secondary)]">Límite agente (min)</span>
                                                    <div className="flex items-center gap-3">
                                                        <VoiceLimitInput
                                                            userId={user.id}
                                                            value={usage?.users[user.id]?.personalLimitMinutes ?? null}
                                                            placeholder={globalLimit === null ? 'General' : String(globalLimit)}
                                                            label={`Límite de ${user.participantCode ?? user.name}`}
                                                        />
                                                        <span className="text-xs text-[var(--text-secondary)]">
                                                            Usados: {formatMinutes(usage?.users[user.id]?.usedSeconds ?? 0)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <dl className="grid grid-cols-4 gap-2 rounded-lg bg-[#fff6e5] p-3 text-center text-sm sm:grid-cols-7">
                                                {[
                                                    ['AE T1', user.scores.aeT1, false],
                                                    ['AE T2', user.scores.aeT2, false],
                                                    ['Δ AE', user.scores.aeDelta, true],
                                                    ['AC T1', user.scores.acT1, false],
                                                    ['AC T2', user.scores.acT2, false],
                                                    ['Δ AC', user.scores.acDelta, true],
                                                    ['SUS', user.scores.sus, false],
                                                ].map(([label, value, strong]) => (
                                                    <div key={label as string}>
                                                        <dt className="text-[11px] font-bold text-[#663820]">{label}</dt>
                                                        <dd className={cn('mt-0.5', strong && 'font-semibold')}>{score(value as number | null)}</dd>
                                                    </div>
                                                ))}
                                            </dl>
                                            <div className="flex flex-wrap gap-1.5">
                                                {user.stages.map((stage) => {
                                                    const config = statusConfig[stage.status];
                                                    const Icon = config.icon;
                                                    return (
                                                        <span key={stage.id} className={cn('inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold', config.className)}>
                                                            <Icon className="size-3" /> {stage.shortTitle}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                                <div className="hidden overflow-x-auto xl:block">
                                    <table className="w-full min-w-[1200px] text-left text-sm">
                                        <thead className="bg-[#fff6e5]">
                                            <tr>
                                                <th className="px-4 py-3">Participante</th>
                                                <th className="w-40 px-4 py-3">Grupo</th>
                                                <th className="px-4 py-3">Límite agente (min)</th>
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
                                            {filteredUsers.map((user) => (
                                                <tr key={user.id} className="border-t border-black/5 align-top">
                                                    <td className="px-4 py-3">
                                                        <p className="font-semibold">{user.participantCode ?? 'Sin código'} · {user.name}</p>
                                                        <p className="max-w-56 truncate text-xs text-[var(--text-secondary)]">{user.email}</p>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <StudyGroupSelect
                                                            userId={user.id}
                                                            value={normalizeStudyGroup(user.studyGroup)}
                                                            participantLabel={user.participantCode ?? user.name}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <VoiceLimitInput
                                                            userId={user.id}
                                                            value={usage?.users[user.id]?.personalLimitMinutes ?? null}
                                                            placeholder={globalLimit === null ? 'General' : String(globalLimit)}
                                                            label={`Límite de ${user.participantCode ?? user.name}`}
                                                        />
                                                        <p className="mt-1 whitespace-nowrap text-xs text-[var(--text-secondary)]">
                                                            Usados: {formatMinutes(usage?.users[user.id]?.usedSeconds ?? 0)}
                                                        </p>
                                                    </td>
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
                                {filteredUsers.map((user) => (
                                    <details key={user.id} className="group rounded-xl border border-black/10 bg-white shadow-sm">
                                        <summary className="flex cursor-pointer list-none flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
                                            <div className="min-w-0">
                                                <h3 className="font-serif text-lg font-bold">{user.participantCode ?? 'Sin código'} · {user.name}</h3>
                                                <p className="break-words text-sm text-[var(--text-secondary)]">{user.email} · Alta: {formatDateTime(user.createdAt)}</p>
                                            </div>
                                            <span className="text-sm font-semibold text-[#663820] group-open:hidden">Ver respuestas y fechas</span>
                                            <span className="hidden text-sm font-semibold text-[#663820] group-open:inline">Ocultar detalle</span>
                                        </summary>
                                        <div className="border-t border-black/10 p-4 sm:p-5">
                                            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
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
                </>
            )}
        </main>
    );
}
