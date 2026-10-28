import Link from 'next/link';
import { headers } from 'next/headers';
import { AlertTriangle, ArrowLeft, CheckCircle2, CircleSlash, RefreshCw, Stethoscope, XCircle } from 'lucide-react';

import { checkAdminAccess } from '@/lib/admin/access';
import { RETRIEVER_MAX_DISTANCE } from '@/lib/constants';
import {
    diagnoseRecentSessions,
    listRetrieverBooks,
    probeRetriever,
    runDiagnostics,
    type CheckStatus,
    type DiagnosticCheck,
} from '@/lib/diagnostics/checks.server';
import { formatDateTime } from '@/lib/metrics/format';
import { cn, formatDuration } from '@/lib/utils';

export const metadata = { title: 'Diagnóstico — Investfied' };
export const dynamic = 'force-dynamic';

const STATUS: Record<CheckStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
    ok: { label: 'Bien', icon: CheckCircle2, className: 'text-emerald-700 bg-emerald-50' },
    warn: { label: 'Revisar', icon: AlertTriangle, className: 'text-amber-800 bg-amber-50' },
    fail: { label: 'Falla', icon: XCircle, className: 'text-red-700 bg-red-50' },
    skip: { label: 'Sin probar', icon: CircleSlash, className: 'text-slate-600 bg-slate-100' },
};

function StatusBadge({ status }: { status: CheckStatus }) {
    const config = STATUS[status];
    const Icon = config.icon;
    return (
        <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold', config.className)}>
            <Icon className="size-3.5" /> {config.label}
        </span>
    );
}

function CheckRow({ check }: { check: DiagnosticCheck }) {
    return (
        <li className="grid gap-1 border-t border-black/5 px-4 py-3 first:border-0 sm:grid-cols-[minmax(0,14rem)_1fr_auto] sm:items-start sm:gap-4">
            <p className="font-semibold break-words">{check.label}</p>
            <div className="min-w-0 text-sm">
                <p className="break-words text-[var(--text-secondary)]">{check.detail}</p>
                {check.fix && check.status !== 'ok' && (
                    <p className="mt-1 break-words font-semibold text-[#663820]">→ {check.fix}</p>
                )}
            </div>
            <div className="flex items-center gap-2 sm:justify-end">
                {check.durationMs !== undefined && check.durationMs > 50 && (
                    <span className="text-xs text-[var(--text-secondary)]">{check.durationMs} ms</span>
                )}
                <StatusBadge status={check.status} />
            </div>
        </li>
    );
}

export default async function DiagnosticsPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const access = await checkAdminAccess();
    if (!access.allowed) {
        return (
            <main className="wrapper container">
                <div className="max-w-2xl rounded-2xl border border-black/10 bg-white p-8 shadow-sm">
                    <h1 className="page-title-xl">Diagnóstico</h1>
                    <p className="subtitle mt-4">{access.reason}</p>
                </div>
            </main>
        );
    }

    const requestHeaders = await headers();
    const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host') ?? 'localhost:3000';
    const protocol = requestHeaders.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
    const origin = `${protocol}://${host}`;

    const params = await searchParams;
    const first = (key: string) => {
        const value = params[key];
        return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
    };
    const probeBookId = first('libro');
    const probeQuery = first('consulta');

    const [checks, sessions, bookOptions, probe] = await Promise.all([
        runDiagnostics(origin),
        diagnoseRecentSessions(),
        listRetrieverBooks(),
        probeBookId && probeQuery ? probeRetriever(probeBookId, probeQuery) : Promise.resolve(null),
    ]);

    const groups = [...new Set(checks.map((check) => check.group))];
    const failures = checks.filter((check) => check.status === 'fail');
    const probeBook = bookOptions.find((book) => book.id === probeBookId);

    return (
        <main className="wrapper container">
            <Link
                href="/admin"
                className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[#3d485e] transition-colors hover:text-[#212a3b]"
            >
                <ArrowLeft className="size-4" /> Volver al panel
            </Link>

            <header className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                    <p className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-[#663820]">
                        <Stethoscope className="size-4" /> Acceso restringido
                    </p>
                    <h1 className="page-title-xl">Diagnóstico del sistema</h1>
                    <p className="subtitle mt-3 max-w-3xl">
                        Pruebas reales desde este servidor ({origin}) contra cada componente: configuración, base de
                        datos, Gemini, Vapi y R2. Las claves nunca se muestran, solo sus últimos 4 caracteres.
                    </p>
                </div>
                <Link
                    href="/admin/diagnostico"
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-[#663820] shadow-sm transition-colors hover:bg-[#fff6e5]"
                >
                    <RefreshCw className="size-4" /> Volver a ejecutar
                </Link>
            </header>

            <section
                className={cn(
                    'mb-8 rounded-xl border p-4 text-sm',
                    failures.length === 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-900',
                )}
            >
                {failures.length === 0 ? (
                    <p className="font-semibold">Todas las pruebas pasaron.</p>
                ) : (
                    <>
                        <p className="font-semibold">
                            {failures.length} {failures.length === 1 ? 'prueba falla' : 'pruebas fallan'}:
                        </p>
                        <ul className="mt-2 list-disc pl-5">
                            {failures.map((check) => (
                                <li key={check.id} className="break-words">
                                    <strong>{check.label}</strong>{check.fix ? ` — ${check.fix}` : ''}
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </section>

            {groups.map((group) => (
                <section key={group} className="mb-6">
                    <h2 className="mb-2 font-serif text-xl font-bold">{group}</h2>
                    <ul className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
                        {checks.filter((check) => check.group === group).map((check) => (
                            <CheckRow key={check.id} check={check} />
                        ))}
                    </ul>
                </section>
            ))}

            <section className="mb-8">
                <h2 className="mb-1 font-serif text-xl font-bold">Sesiones recientes</h2>
                <p className="mb-3 text-sm text-[var(--text-secondary)]">
                    Si el agente habló varias veces y no hay ninguna búsqueda registrada, Vapi nunca llegó al retriever.
                </p>
                {sessions.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-black/20 bg-white p-6 text-center text-sm text-[var(--text-secondary)]">
                        Todavía no hay sesiones.
                    </p>
                ) : (
                    <ul className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
                        {sessions.map((session) => (
                            <li key={session.id} className="grid gap-2 border-t border-black/5 px-4 py-3 first:border-0">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <Link href={`/admin/sesiones/${session.id}`} className="font-semibold text-[#663820] hover:underline">
                                        {session.participant}
                                    </Link>
                                    <StatusBadge status={session.verdict} />
                                </div>
                                <p className="text-xs text-[var(--text-secondary)]">
                                    {formatDateTime(session.startedAt)} · {formatDuration(session.durationSeconds)} ·{' '}
                                    {session.agentTurns} turnos del agente · {session.searches} búsquedas con fragmentos ·{' '}
                                    {session.noResults} sin fragmentos · {session.searchErrors} con error · fin: {session.endedReason}
                                </p>
                                <p className="text-sm">{session.explanation}</p>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section id="retriever" className="mb-8 scroll-mt-24">
                <h2 className="mb-1 font-serif text-xl font-bold">Probador del retriever</h2>
                <p className="mb-3 text-sm text-[var(--text-secondary)]">
                    Busca en una tesis como lo haría el agente y muestra los {probe?.rows.length || 5} fragmentos más cercanos
                    con su distancia. El agente solo recibe los que quedan por debajo de {RETRIEVER_MAX_DISTANCE}.
                </p>
                <form action="/admin/diagnostico#retriever" method="get" className="mb-4 grid gap-3 rounded-xl border border-black/10 bg-white p-4 shadow-sm md:grid-cols-[1fr_1fr_auto] md:items-end">
                    <label className="grid gap-1 text-sm">
                        <span className="font-semibold">Investigación</span>
                        <select name="libro" defaultValue={probeBookId} required className="rounded-lg border border-black/15 bg-white px-3 py-2">
                            <option value="" disabled>Elige una tesis</option>
                            {bookOptions.map((book) => (
                                <option key={book.id} value={book.id}>
                                    {book.label} ({book.segments} segmentos)
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="grid gap-1 text-sm">
                        <span className="font-semibold">Pregunta</span>
                        <input
                            name="consulta"
                            defaultValue={probeQuery || 'planteamiento del problema y justificación'}
                            required
                            className="rounded-lg border border-black/15 bg-white px-3 py-2"
                        />
                    </label>
                    <button type="submit" className="rounded-lg bg-[#663820] px-4 py-2 text-sm font-semibold text-white hover:bg-[#7a4528]">
                        Probar
                    </button>
                </form>

                {probe && (
                    !probe.success ? (
                        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">La búsqueda falló: {probe.error}</p>
                    ) : probe.rows.length === 0 ? (
                        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                            {probeBook && probeBook.segments === 0
                                ? 'Esta tesis no tiene segmentos: la subida no terminó de procesarse.'
                                : 'La búsqueda no devolvió ningún segmento.'}
                        </p>
                    ) : (
                        <>
                            <p className="mb-2 text-sm font-semibold">
                                {probe.rows.filter((row) => row.passes).length} de {probe.rows.length} fragmentos llegarían al agente.
                            </p>
                            <ul className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
                                {probe.rows.map((row, index) => (
                                    <li key={index} className="grid gap-1 border-t border-black/5 px-4 py-3 first:border-0">
                                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                            <span className="font-semibold">
                                                Distancia {row.distance.toFixed(3)} · página {row.pageNumber ?? '—'}
                                            </span>
                                            <StatusBadge status={row.passes ? 'ok' : 'fail'} />
                                        </div>
                                        <p className="text-xs break-words text-[var(--text-secondary)]">{row.preview}…</p>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )
                )}
            </section>
        </main>
    );
}
