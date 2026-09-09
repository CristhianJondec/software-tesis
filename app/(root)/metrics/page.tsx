import Link from 'next/link';

import ExportCsvButtons from '@/components/metrics/ExportCsvButtons';
import RagasControls from '@/components/metrics/RagasControls';
import { EmptyState, Section, StatCard, TableWrapper } from '@/components/metrics/StatCard';
import { getMetricsOverview } from '@/lib/actions/metrics.actions';
import { checkMetricsAccess } from '@/lib/metrics/access';
import {
    formatDeltaMs,
    formatMs,
    formatNumber,
    formatPercent,
    formatScore,
    formatDateTime,
} from '@/lib/metrics/format';
import { RAGAS_METRIC_IDS, RAGAS_METRIC_LABELS } from '@/lib/metrics/ragas';

export const metadata = { title: 'Métricas — Investfied' };

// Every figure is computed from the current rows; caching it would report a
// measurement the database no longer supports.
export const dynamic = 'force-dynamic';

const th = 'px-4 py-3 font-semibold text-[var(--text-secondary)] whitespace-nowrap';
const td = 'px-4 py-3 border-t border-black/5 whitespace-nowrap';

const MetricsPage = async () => {
    const access = await checkMetricsAccess();

    if (!access.allowed) {
        return (
            <main className="wrapper container">
                <h1 className="page-title-xl">Métricas</h1>
                <p className="subtitle mt-4 max-w-2xl">{access.reason}</p>
            </main>
        );
    }

    const result = await getMetricsOverview();

    if (!result.success || !result.data) {
        return (
            <main className="wrapper container">
                <h1 className="page-title-xl">Métricas</h1>
                <p className="subtitle mt-4 max-w-2xl">{result.error}</p>
            </main>
        );
    }

    const report = result.data;
    const hasTurns = report.corpus.turns > 0;

    return (
        <main className="wrapper container">
            <h1 className="page-title-xl">Métricas de la sustentación simulada</h1>
            <p className="subtitle mt-3 max-w-3xl">
                ICA, PR, LP y RAGAs calculados sobre las sesiones registradas. Todos los valores se
                derivan de la base de datos: una métrica sin datos se muestra vacía, nunca en cero.
            </p>
            <p className="mt-3 text-sm text-[var(--text-secondary)]">
                Generado el {formatDateTime(report.generatedAt)} ·{' '}
                {formatNumber(report.corpus.participants)} participante(s) ·{' '}
                {formatNumber(report.corpus.sessions)} sesión(es) ·{' '}
                {formatNumber(report.corpus.turns)} turno(s) ·{' '}
                {formatNumber(report.corpus.retrievals)} recuperación(es)
            </p>

            {!hasTurns && (
                <div className="mt-6 rounded-xl border border-dashed border-black/20 bg-white/60 p-6 text-sm leading-6 text-[var(--text-secondary)]">
                    Todavía no hay turnos registrados. El ICA ya es medible porque describe la
                    arquitectura; LP, PR y RAGAs necesitan al menos una sesión de voz completa.
                </div>
            )}

            {/* ================= ICA ================= */}
            <Section
                title="ICA — Índice de Completitud Arquitectónica"
                formula="(Ci / Ct) × 100"
                description="Se deriva del registro declarativo de lib/metrics/architecture.ts. Si un componente deja de estar integrado, el porcentaje baja solo."
            >
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        label="ICA"
                        value={formatPercent(report.ica.percentage)}
                        hint={`Ci = ${report.ica.integrated} · Ct = ${report.ica.total}`}
                    />
                </div>

                <div className="mt-5">
                    <TableWrapper>
                        <thead>
                            <tr className="bg-[var(--accent-light)]">
                                <th className={th}>Componente</th>
                                <th className={th}>Implementación</th>
                                <th className={th}>Corre en</th>
                                <th className={th}>Evidencia</th>
                                <th className={th}>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {report.components.map((component) => (
                                <tr key={component.id}>
                                    <td className={`${td} font-medium`}>{component.name}</td>
                                    <td className={`${td} whitespace-normal`}>{component.implementation}</td>
                                    <td className={td}>
                                        {component.runsOn === 'vapi' ? 'Vapi' : 'Este software'}
                                    </td>
                                    <td className={`${td} whitespace-normal`}>
                                        <code className="text-xs">{component.evidence.join(' · ')}</code>
                                    </td>
                                    <td className={td}>
                                        {component.integrated ? 'Integrado' : 'No integrado'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </TableWrapper>
                </div>
            </Section>

            {/* ================= LP ================= */}
            <Section
                title="LP — Latencia Promedio del sistema"
                formula="Σti / n"
                description="Tiempo entre el fin de la intervención del estudiante y el inicio de la réplica del agente, medido sobre los turnos del agente."
            >
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        label="Media (LP)"
                        value={formatMs(report.systemLatency.meanMs)}
                        n={report.systemLatency.n}
                    />
                    <StatCard label="Mediana" value={formatMs(report.systemLatency.medianMs)} />
                    <StatCard label="Mínimo" value={formatMs(report.systemLatency.minMs)} />
                    <StatCard
                        label="Máximo"
                        value={formatMs(report.systemLatency.maxMs)}
                        hint={`p95 = ${formatMs(report.systemLatency.p95Ms)}`}
                    />
                </div>
            </Section>

            {/* ========= Student verbal latency ========= */}
            <Section
                title="Latencia de respuesta verbal del estudiante"
                description="Tiempo entre el fin de la pregunta del agente y la primera palabra del estudiante. Es una dimensión de la variable dependiente de la investigación, no una latencia del sistema: se reporta aparte y nunca se promedia con LP."
            >
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        label="Media"
                        value={formatMs(report.studentLatency.meanMs)}
                        n={report.studentLatency.n}
                    />
                    <StatCard label="Mediana" value={formatMs(report.studentLatency.medianMs)} />
                    <StatCard label="Mínimo" value={formatMs(report.studentLatency.minMs)} />
                    <StatCard label="Máximo" value={formatMs(report.studentLatency.maxMs)} />
                </div>

                <h3 className="mt-8 font-serif text-lg font-semibold">Por participante y sesión</h3>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    Lo que interesa a la investigación es si la latencia baja con la práctica.
                </p>
                <div className="mt-3">
                    {report.studentByParticipantSession.length === 0 ? (
                        <EmptyState>Sin mediciones de latencia del estudiante todavía.</EmptyState>
                    ) : (
                        <TableWrapper>
                            <thead>
                                <tr className="bg-[var(--accent-light)]">
                                    <th className={th}>Participante</th>
                                    <th className={th}>Grupo</th>
                                    <th className={th}>Sesión</th>
                                    <th className={th}>n</th>
                                    <th className={th}>Media</th>
                                    <th className={th}>Mediana</th>
                                    <th className={th}>Mín</th>
                                    <th className={th}>Máx</th>
                                </tr>
                            </thead>
                            <tbody>
                                {report.studentByParticipantSession.map((row) => (
                                    <tr key={row.sessionId}>
                                        <td className={`${td} font-medium`}>
                                            {row.participantCode ?? 'sin código'}
                                        </td>
                                        <td className={td}>{row.studyGroup ?? '—'}</td>
                                        <td className={td}>{row.sessionNumber}</td>
                                        <td className={td}>{row.summary.n}</td>
                                        <td className={td}>{formatMs(row.summary.meanMs)}</td>
                                        <td className={td}>{formatMs(row.summary.medianMs)}</td>
                                        <td className={td}>{formatMs(row.summary.minMs)}</td>
                                        <td className={td}>{formatMs(row.summary.maxMs)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </TableWrapper>
                    )}
                </div>

                {report.studentTrend.length > 0 && (
                    <>
                        <h3 className="mt-8 font-serif text-lg font-semibold">
                            Primera vs. última sesión
                        </h3>
                        <div className="mt-3">
                            <TableWrapper>
                                <thead>
                                    <tr className="bg-[var(--accent-light)]">
                                        <th className={th}>Participante</th>
                                        <th className={th}>Sesiones</th>
                                        <th className={th}>Primera</th>
                                        <th className={th}>Última</th>
                                        <th className={th}>Δ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.studentTrend.map((row) => (
                                        <tr key={row.userId}>
                                            <td className={`${td} font-medium`}>
                                                {row.participantCode ?? 'sin código'}
                                            </td>
                                            <td className={td}>{row.sessions}</td>
                                            <td className={td}>{formatMs(row.firstSessionMeanMs)}</td>
                                            <td className={td}>{formatMs(row.lastSessionMeanMs)}</td>
                                            <td className={td}>{formatDeltaMs(row.deltaMs)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </TableWrapper>
                        </div>
                    </>
                )}
            </Section>

            {/* ================= PR ================= */}
            <Section
                title="PR — Precisión de Respuestas"
                formula="(Rc / Rt) × 100"
                description="Rt son los turnos del agente que un humano revisó; Rc, los que marcó como correctos. Los turnos sin revisar no entran en el denominador: se reportan como pendientes."
            >
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        label="PR"
                        value={formatPercent(report.precision.percentage)}
                        n={report.precision.reviewed}
                        hint={`Rc = ${report.precision.correct} · Rt = ${report.precision.reviewed}`}
                    />
                    <StatCard label="Correctas" value={formatNumber(report.precision.correct)} />
                    <StatCard label="Incorrectas" value={formatNumber(report.precision.incorrect)} />
                    <StatCard
                        label="Pendientes de revisión"
                        value={formatNumber(report.precision.pending)}
                        hint={`Cobertura de revisión: ${formatPercent(report.precision.coveragePercentage)} de ${report.precision.totalAgentTurns} turnos del agente`}
                    />
                </div>

                <Link
                    href="/metrics/revision"
                    className="btn-primary mt-5 w-fit text-base"
                >
                    Revisar turnos del agente
                </Link>
            </Section>

            {/* ================= RAGAs ================= */}
            <Section
                title="RAGAs"
                description="Adaptación en TypeScript de las métricas de Es et al. (2023): no se usa la librería oficial de Python. La nota metodológica completa está en la cabecera de lib/metrics/ragas.ts y debe declararse así en la investigación."
            >
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {RAGAS_METRIC_IDS.map((metric) => (
                        <StatCard
                            key={metric}
                            label={RAGAS_METRIC_LABELS[metric]}
                            value={formatScore(report.ragas[metric].mean)}
                            n={report.ragas[metric].n}
                        />
                    ))}
                </div>

                <p className="mt-4 text-sm text-[var(--text-secondary)]">
                    Ternas (pregunta, contexto, respuesta) disponibles:{' '}
                    {formatNumber(report.ragasCoverage.triples)} · evaluadas:{' '}
                    {formatNumber(report.ragasCoverage.scored)} · pendientes:{' '}
                    {formatNumber(report.ragasCoverage.pending)}.
                    {report.ragasCoverage.unanchoredRetrievals > 0 && (
                        <>
                            {' '}
                            {formatNumber(report.ragasCoverage.unanchoredRetrievals)} recuperación(es)
                            no quedaron ancladas a ningún turno y no se puntúan.
                        </>
                    )}
                    {report.ragasCoverage.anchorsWithoutAnswer > 0 && (
                        <>
                            {' '}
                            {formatNumber(report.ragasCoverage.anchorsWithoutAnswer)} búsqueda(s) no
                            fueron seguidas por una respuesta del agente.
                        </>
                    )}
                </p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    Juez: {report.judgeModel}, temperatura 0 · versión de prompts:{' '}
                    <code>{report.ragasPromptVersion}</code>
                </p>

                <div className="mt-5">
                    <RagasControls pending={report.ragasCoverage.pending} />
                </div>
            </Section>

            {/* ================= Export ================= */}
            <Section
                title="Exportación"
                description="Tres archivos CSV con codificación UTF-8 y separador de coma, listos para SPSS o R. Cada archivo trae el código de participante para cruzarlo con las encuestas."
            >
                <ExportCsvButtons />
            </Section>
        </main>
    );
};

export default MetricsPage;
