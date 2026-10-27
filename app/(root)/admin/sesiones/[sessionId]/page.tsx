import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ClipboardList, MessageSquareText, ScrollText, ShieldCheck } from 'lucide-react';

import SystemLogList, { LogLevelBadge } from '@/components/admin/SystemLogList';
import SessionReport from '@/components/SessionReport';
import Transcript from '@/components/Transcript';
import { getSessionFeedbackForAdmin } from '@/lib/actions/feedback.actions';
import { getConversationByIdForAdmin } from '@/lib/actions/session.actions';
import { getSessionLogsForAdmin } from '@/lib/actions/system-log.actions';
import { checkAdminAccess } from '@/lib/admin/access';
import { getDifficultyLevel } from '@/lib/difficulty/levels';
import { formatDateTime } from '@/lib/metrics/format';
import { STUDY_GROUP_LABELS, normalizeStudyGroup } from '@/lib/study/groups';
import { LOG_LEVELS } from '@/lib/system-logs/catalog';
import { formatLogDuration } from '@/lib/system-logs/format';
import { formatDuration } from '@/lib/utils';

export const metadata = { title: 'Sesión — Logs del sistema' };
export const dynamic = 'force-dynamic';

function average(values: Array<number | null>): number | null {
    const available = values.filter((value): value is number => value !== null);
    if (available.length === 0) return null;
    return Math.round(available.reduce((sum, value) => sum + value, 0) / available.length);
}

function selfReport(value: number | null): string {
    return value === null ? 'Sin respuesta' : `${value} / 10`;
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg border border-black/10 p-3">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">{label}</p>
            <p className="mt-1 font-semibold break-words">{value}</p>
        </div>
    );
}

function SectionHeading({ icon: Icon, title, description }: { icon: typeof ScrollText; title: string; description: string }) {
    return (
        <div className="mb-4 flex items-start gap-3">
            <span className="rounded-lg bg-[#f3e4c7] p-2 text-[#663820]">
                <Icon className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
                <h2 className="font-serif text-2xl font-bold">{title}</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p>
            </div>
        </div>
    );
}

export default async function AdminSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
    const access = await checkAdminAccess();
    if (!access.allowed) {
        return (
            <main className="wrapper container">
                <div className="max-w-2xl rounded-2xl border border-black/10 bg-white p-8 shadow-sm">
                    <ShieldCheck className="mb-4 size-10 text-[#663820]" />
                    <h1 className="page-title-xl">Sesión</h1>
                    <p className="subtitle mt-4">{access.reason}</p>
                </div>
            </main>
        );
    }

    const { sessionId } = await params;
    const [conversationResult, logsResult, feedbackResult] = await Promise.all([
        getConversationByIdForAdmin(sessionId),
        getSessionLogsForAdmin(sessionId),
        getSessionFeedbackForAdmin(sessionId),
    ]);

    if (!conversationResult.success || !conversationResult.data || !logsResult.success || !logsResult.data) notFound();

    const { conversation, turns, vapi } = conversationResult.data;
    const { participant, logs } = logsResult.data;
    const group = normalizeStudyGroup(participant.studyGroup);
    const level = getDifficultyLevel(conversation.difficultyLevel);
    const messages = turns.map((turn) => ({ role: turn.role, content: turn.content }));
    const studentLatency = average(turns.filter((turn) => turn.role === 'user').map((turn) => turn.studentLatencyMs));
    const systemLatency = average(turns.filter((turn) => turn.role === 'assistant').map((turn) => turn.systemLatencyMs));
    const levelCounts = LOG_LEVELS.map((logLevel) => ({
        level: logLevel,
        n: logs.filter((log) => log.level === logLevel).length,
    }));

    return (
        <main className="wrapper container">
            <div className="mx-auto max-w-5xl">
                <Link
                    href={`/admin/logs?q=${encodeURIComponent(participant.participantCode ?? participant.email)}`}
                    className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[#3d485e] transition-colors hover:text-[#212a3b]"
                >
                    <ArrowLeft className="size-4" /> Volver a los logs del participante
                </Link>

                <header className="mb-6">
                    <p className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-[#663820]">
                        <ShieldCheck className="size-4" /> Vista de administración
                    </p>
                    <h1 className="page-title-xl">
                        {participant.participantCode ?? 'Sin código'} · {participant.userName}
                    </h1>
                    <p className="subtitle mt-2">
                        {participant.email} · {group ? `Grupo ${STUDY_GROUP_LABELS[group].toLowerCase()}` : 'Sin grupo asignado'}
                    </p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                        Investigación: <strong>{conversation.bookTitle}</strong>
                    </p>
                </header>

                <section className="mb-6 grid grid-cols-2 gap-3 rounded-2xl bg-white p-5 sm:grid-cols-3 lg:grid-cols-4">
                    <Stat label="Inicio" value={formatDateTime(conversation.startedAt)} />
                    <Stat label="Duración" value={formatDuration(conversation.durationSeconds)} />
                    <Stat
                        label="Nivel de exigencia"
                        value={`${level.id} · ${level.name} (${conversation.levelSource === 'auto' ? 'sugerido' : 'manual'})`}
                    />
                    <Stat label="Turnos registrados" value={String(turns.length)} />
                    <Stat label="Ansiedad antes" value={selfReport(conversation.preSessionAnxiety)} />
                    <Stat label="Ansiedad después" value={selfReport(conversation.postSessionAnxiety)} />
                    <Stat label="Latencia del estudiante (prom.)" value={formatLogDuration(studentLatency)} />
                    <Stat label="Latencia del sistema (prom.)" value={formatLogDuration(systemLatency)} />
                    <Stat label="ID de llamada Vapi" value={conversation.vapiCallId ?? 'No vinculada'} />
                    <Stat
                        label="Motivo de fin (Vapi)"
                        value={vapi.status === 'available' ? vapi.endedReason ?? 'Sin datos' : 'No disponible'}
                    />
                    <Stat
                        label="Costo (Vapi)"
                        value={vapi.status === 'available' && vapi.cost !== null ? `US$ ${vapi.cost.toFixed(4)}` : 'Sin datos'}
                    />
                    <Stat label="ID de sesión" value={conversation.id} />
                </section>

                <div className="space-y-6">
                    <section className="rounded-2xl bg-white p-5 sm:p-6">
                        <SectionHeading
                            icon={ScrollText}
                            title="Logs del sistema"
                            description="Eventos de esta sesión en orden cronológico. El tiempo en marrón se cuenta desde el inicio de la sesión."
                        />
                        <div className="mb-4 flex flex-wrap gap-2">
                            {levelCounts.map(({ level: logLevel, n }) => (
                                <span key={logLevel} className="inline-flex items-center gap-1.5 text-sm">
                                    <LogLevelBadge level={logLevel} /> {n}
                                </span>
                            ))}
                        </div>
                        <SystemLogList logs={logs} sessionStart={conversation.startedAt} />
                    </section>

                    <section className="rounded-2xl bg-white p-5 sm:p-6">
                        <SectionHeading
                            icon={MessageSquareText}
                            title="Conversación"
                            description="Transcripción registrada durante la sesión, tal como la ve el estudiante en su historial."
                        />
                        <div className="vapi-transcript-wrapper max-h-[70vh]">
                            <div className="transcript-container min-h-[420px] border border-[var(--border-subtle)]">
                                <Transcript messages={messages} currentMessage="" currentUserMessage="" />
                            </div>
                        </div>
                    </section>

                    <section className="rounded-2xl bg-white p-5 sm:p-6">
                        <SectionHeading
                            icon={ClipboardList}
                            title="Informe de la sesión"
                            description="El mismo informe que ve el estudiante, en solo lectura: el juez solo lo ejecuta el estudiante desde su historial."
                        />
                        {feedbackResult.success && feedbackResult.data ? (
                            <SessionReport
                                sessionId={conversation.id}
                                report={feedbackResult.data}
                                judgeModel={feedbackResult.data.judgeModel}
                                promptVersion={feedbackResult.data.promptVersion}
                                readOnly
                            />
                        ) : (
                            <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                                {feedbackResult.error ?? 'No se pudo cargar el informe.'}
                            </p>
                        )}
                    </section>
                </div>
            </div>
        </main>
    );
}
