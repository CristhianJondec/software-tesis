import Link from 'next/link';
import { AlertTriangle, CircleAlert, Info } from 'lucide-react';

import type { SystemLogRow } from '@/lib/actions/system-log.actions';
import {
    LOG_LEVEL_LABELS,
    LOG_SOURCE_LABELS,
    describeLogEvent,
    isLogLevel,
    isLogSource,
    type LogLevel,
} from '@/lib/system-logs/catalog';
import { formatLogDuration, formatLogTimestamp, formatSessionOffset } from '@/lib/system-logs/format';
import { cn } from '@/lib/utils';

const levelStyle: Record<LogLevel, { icon: typeof Info; className: string }> = {
    info: { icon: Info, className: 'bg-slate-100 text-slate-700' },
    warn: { icon: AlertTriangle, className: 'bg-amber-50 text-amber-800' },
    error: { icon: CircleAlert, className: 'bg-red-50 text-red-700' },
};

export function LogLevelBadge({ level }: { level: string }) {
    const style = isLogLevel(level) ? levelStyle[level] : levelStyle.info;
    const Icon = style.icon;
    return (
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap', style.className)}>
            <Icon className="size-3" /> {isLogLevel(level) ? LOG_LEVEL_LABELS[level] : level}
        </span>
    );
}

/**
 * Log rows as a list of cards. Shared by the general view and the session view:
 * the general one shows who and which session, the session one shows the time
 * since the session started.
 */
export default function SystemLogList({
    logs,
    sessionStart,
    showParticipant = false,
}: {
    logs: SystemLogRow[];
    /** When given, each row shows its offset from the session start. */
    sessionStart?: Date;
    showParticipant?: boolean;
}) {
    if (logs.length === 0) {
        return (
            <p className="rounded-xl border border-dashed border-black/20 bg-white p-8 text-center text-sm text-[var(--text-secondary)]">
                No hay registros para mostrar.
            </p>
        );
    }

    return (
        <ul className="divide-y divide-black/5 overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
            {logs.map((log) => {
                const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;
                return (
                    <li
                        key={log.id}
                        className={cn(
                            'grid gap-2 p-4 text-sm',
                            log.level === 'error' && 'bg-red-50/40',
                            log.level === 'warn' && 'bg-amber-50/40',
                        )}
                    >
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <LogLevelBadge level={log.level} />
                            <span className="font-semibold">{describeLogEvent(log.event)}</span>
                            <span className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-secondary)]">
                                {log.event}
                            </span>
                            <span className="text-xs text-[var(--text-secondary)]">
                                {isLogSource(log.source) ? LOG_SOURCE_LABELS[log.source] : log.source}
                            </span>
                            <span className="ml-auto font-mono text-xs text-[var(--text-secondary)]">
                                {sessionStart && (
                                    <strong className="mr-2 text-[#663820]">{formatSessionOffset(log.createdAt, sessionStart)}</strong>
                                )}
                                {formatLogTimestamp(log.createdAt)}
                            </span>
                        </div>
                        <p className="break-words">{log.message}</p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]">
                            {log.durationMs !== null && <span>Duración: {formatLogDuration(log.durationMs)}</span>}
                            {showParticipant && (
                                <span>
                                    Participante: {log.participantCode ?? 'Sin código'}
                                    {log.userName ? ` · ${log.userName}` : ''}
                                </span>
                            )}
                            {showParticipant && log.sessionId && (
                                <Link href={`/admin/sesiones/${log.sessionId}`} className="font-semibold text-[#663820] hover:underline">
                                    Ver sesión
                                </Link>
                            )}
                        </div>
                        {hasMetadata && (
                            <details className="text-xs">
                                <summary className="cursor-pointer font-semibold text-[#663820]">Detalle técnico</summary>
                                <pre className="mt-2 overflow-x-auto rounded-lg bg-[#f9fafb] p-3 font-mono text-[11px] leading-relaxed">
                                    {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                            </details>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}
