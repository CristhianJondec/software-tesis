import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, ScrollText, ShieldCheck } from 'lucide-react';

import SystemLogFilters from '@/components/admin/SystemLogFilters';
import SystemLogList from '@/components/admin/SystemLogList';
import { getSystemLogOverview } from '@/lib/actions/system-log.actions';
import { checkAdminAccess } from '@/lib/admin/access';
import { formatDateTime } from '@/lib/metrics/format';
import { STUDY_GROUP_LABELS, normalizeStudyGroup } from '@/lib/study/groups';
import { parseSystemLogFilters, serializeSystemLogFilters, SESSIONS_LIST_LIMIT } from '@/lib/system-logs/filters';
import { formatDuration } from '@/lib/utils';

export const metadata = { title: 'Logs del sistema — Investfied' };
export const dynamic = 'force-dynamic';

export default async function SystemLogsPage({
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
                    <h1 className="page-title-xl">Logs del sistema</h1>
                    <p className="subtitle mt-4">{access.reason}</p>
                </div>
            </main>
        );
    }

    const filters = parseSystemLogFilters(await searchParams);
    const result = await getSystemLogOverview(filters);

    const pageHref = (pagina: number) => {
        const search = serializeSystemLogFilters({ ...filters, pagina });
        return search ? `/admin/logs?${search}` : '/admin/logs';
    };

    return (
        <main className="wrapper container">
            <Link
                href="/admin"
                className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[#3d485e] transition-colors hover:text-[#212a3b]"
            >
                <ArrowLeft className="size-4" /> Volver al panel
            </Link>

            <header className="mb-6">
                <p className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-[#663820]">
                    <ScrollText className="size-4" /> Acceso restringido
                </p>
                <h1 className="page-title-xl">Logs del sistema</h1>
                <p className="subtitle mt-3 max-w-3xl">
                    Eventos técnicos de todas las sesiones: conexión y corte de llamadas, búsquedas del retriever con su
                    tiempo, errores de Vapi y turnos que no se pudieron guardar. Abre una sesión para ver sus logs junto
                    con la conversación y el informe.
                </p>
            </header>

            <SystemLogFilters filters={filters} />

            {!result.success || !result.data ? (
                <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                    {result.error ?? 'No se pudieron cargar los logs.'}
                </p>
            ) : (
                <>
                    <section className="mb-10">
                        <h2 className="mb-1 font-serif text-2xl font-bold">Sesiones</h2>
                        <p className="mb-3 text-sm text-[var(--text-secondary)]">
                            Filtradas por participante, grupo y fechas. Se muestran las {SESSIONS_LIST_LIMIT} más recientes.
                        </p>
                        {result.data.sessions.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-black/20 bg-white p-8 text-center text-sm text-[var(--text-secondary)]">
                                Ninguna sesión coincide con los filtros.
                            </p>
                        ) : (
                            <div className="overflow-x-auto rounded-xl border border-black/10 bg-white shadow-sm">
                                <table className="w-full min-w-[760px] text-left text-sm">
                                    <thead className="bg-[#fff6e5]">
                                        <tr>
                                            <th className="px-4 py-3">Inicio</th>
                                            <th className="px-4 py-3">Participante</th>
                                            <th className="px-4 py-3">Investigación</th>
                                            <th className="px-4 py-3 text-center">Nivel</th>
                                            <th className="px-4 py-3 text-center">Duración</th>
                                            <th className="px-4 py-3 text-center">Turnos</th>
                                            <th className="px-4 py-3 text-center">Avisos</th>
                                            <th className="px-4 py-3 text-center">Errores</th>
                                            <th className="px-4 py-3" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {result.data.sessions.map((session) => {
                                            const group = normalizeStudyGroup(session.studyGroup);
                                            return (
                                                <tr key={session.id} className="border-t border-black/5">
                                                    <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(session.startedAt)}</td>
                                                    <td className="px-4 py-3">
                                                        <p className="font-semibold">{session.participantCode ?? 'Sin código'} · {session.userName}</p>
                                                        <p className="text-xs text-[var(--text-secondary)]">{group ? STUDY_GROUP_LABELS[group] : 'Sin asignar'}</p>
                                                    </td>
                                                    <td className="max-w-64 truncate px-4 py-3">{session.bookTitle}</td>
                                                    <td className="px-4 py-3 text-center">{session.difficultyLevel}</td>
                                                    <td className="px-4 py-3 text-center">{formatDuration(session.durationSeconds)}</td>
                                                    <td className="px-4 py-3 text-center">{session.turns}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className={session.warnings > 0 ? 'font-semibold text-amber-800' : ''}>{session.warnings}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className={session.errors > 0 ? 'font-semibold text-red-700' : ''}>{session.errors}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <Link href={`/admin/sesiones/${session.id}`} className="font-semibold whitespace-nowrap text-[#663820] hover:underline">
                                                            Abrir
                                                        </Link>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>

                    <section>
                        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                            <div>
                                <h2 className="font-serif text-2xl font-bold">Eventos</h2>
                                <p className="text-sm text-[var(--text-secondary)]">
                                    {result.data.total} {result.data.total === 1 ? 'registro' : 'registros'}, del más reciente al más antiguo.
                                </p>
                            </div>
                        </div>
                        <SystemLogList logs={result.data.logs} showParticipant />
                        {result.data.total > result.data.pageSize && (
                            <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Paginación">
                                {filters.pagina > 1 ? (
                                    <Link href={pageHref(filters.pagina - 1)} className="inline-flex items-center gap-1 font-semibold text-[#663820] hover:underline">
                                        <ChevronLeft className="size-4" /> Más recientes
                                    </Link>
                                ) : <span />}
                                <span className="text-[var(--text-secondary)]">
                                    Página {filters.pagina} de {Math.ceil(result.data.total / result.data.pageSize)}
                                </span>
                                {filters.pagina * result.data.pageSize < result.data.total ? (
                                    <Link href={pageHref(filters.pagina + 1)} className="inline-flex items-center gap-1 font-semibold text-[#663820] hover:underline">
                                        Más antiguos <ChevronRight className="size-4" />
                                    </Link>
                                ) : <span />}
                            </nav>
                        )}
                    </section>
                </>
            )}
        </main>
    );
}
