'use server';

import { and, count, desc, eq, gte, ilike, inArray, isNull, lt, or, sql, type SQL } from 'drizzle-orm';

import { db } from '@/database/db';
import { books, systemLogs, users, voiceSessions } from '@/database/schema';
import { requireAdmin } from '@/lib/admin/access';
import { requireUser } from '@/lib/session';
import { isClientLogEvent, isLogLevel } from '@/lib/system-logs/catalog';
import {
    LOGS_PAGE_SIZE,
    SESSIONS_PAGE_SIZE,
    logDateRange,
    type SystemLogFilters,
} from '@/lib/system-logs/filters';
import { writeSystemLog } from '@/lib/system-logs/write.server';

/**
 * Server actions of the system log (database/schema/systemLogs.ts).
 *
 * `logClientEvent` is the only write a participant can make, and only for a
 * whitelisted event on a session of their own. Everything else here reads
 * across participants and is admin-only.
 */

export interface ClientLogInput {
    event: string;
    level: string;
    message: string;
    sessionId?: string | null;
    durationMs?: number | null;
    metadata?: Record<string, unknown> | null;
}

/** Fire-and-forget from the voice hook. Never throws and never reports back an error. */
export const logClientEvent = async (input: ClientLogInput): Promise<{ success: boolean }> => {
    try {
        const user = await requireUser();
        if (!isClientLogEvent(input.event) || !isLogLevel(input.level) || typeof input.message !== 'string') {
            return { success: false };
        }

        let sessionId: string | null = null;
        if (input.sessionId) {
            const [session] = await db
                .select({ id: voiceSessions.id })
                .from(voiceSessions)
                .where(and(eq(voiceSessions.id, input.sessionId), eq(voiceSessions.userId, user.id)))
                .limit(1);
            if (!session) return { success: false };
            sessionId = session.id;
        }

        await writeSystemLog({
            level: input.level,
            source: 'client',
            event: input.event,
            message: input.message,
            sessionId,
            userId: user.id,
            durationMs: typeof input.durationMs === 'number' ? input.durationMs : null,
            metadata: input.metadata ?? null,
        });
        return { success: true };
    } catch {
        return { success: false };
    }
};

export interface SystemLogRow {
    id: string;
    createdAt: Date;
    level: string;
    source: string;
    event: string;
    message: string;
    durationMs: number | null;
    metadata: Record<string, unknown> | null;
    sessionId: string | null;
    userId: string | null;
    participantCode: string | null;
    userName: string | null;
}

export interface AdminSessionRow {
    id: string;
    startedAt: Date;
    durationSeconds: number;
    difficultyLevel: number;
    bookTitle: string;
    userId: string;
    participantCode: string | null;
    userName: string;
    studyGroup: string | null;
    turns: number;
    warnings: number;
    errors: number;
}

export interface SystemLogOverview {
    logs: SystemLogRow[];
    total: number;
    pageSize: number;
    sessions: AdminSessionRow[];
    sessionsTotal: number;
    sessionsPageSize: number;
}

/** Participant conditions shared by the log list and the session list. */
function participantConditions(filters: SystemLogFilters): SQL[] {
    const conditions: SQL[] = [];
    if (filters.q) {
        const pattern = `%${filters.q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
        conditions.push(or(
            ilike(users.name, pattern),
            ilike(users.email, pattern),
            ilike(users.participantCode, pattern),
        )!);
    }
    if (filters.grupo === 'sin_asignar') {
        conditions.push(isNull(users.studyGroup));
    } else if (filters.grupo !== 'todos') {
        conditions.push(eq(users.studyGroup, filters.grupo));
    }
    return conditions;
}

/**
 * The general view of /admin/logs: one page of log rows plus the sessions that
 * match the same participant and date filters, each with its warning and error
 * counts, so the admin can open any of them.
 */
export const getSystemLogOverview = async (
    filters: SystemLogFilters,
): Promise<{ success: boolean; data?: SystemLogOverview; error?: string }> => {
    try {
        await requireAdmin();

        const { from, to } = logDateRange(filters);
        const people = participantConditions(filters);

        const logConditions: SQL[] = [...people];
        if (filters.nivel !== 'todos') logConditions.push(eq(systemLogs.level, filters.nivel));
        if (filters.fuente !== 'todos') logConditions.push(eq(systemLogs.source, filters.fuente));
        if (filters.evento !== 'todos') logConditions.push(eq(systemLogs.event, filters.evento));
        if (from) logConditions.push(gte(systemLogs.createdAt, from));
        if (to) logConditions.push(lt(systemLogs.createdAt, to));
        const logWhere = logConditions.length > 0 ? and(...logConditions) : undefined;

        const [[{ total }], logs] = await Promise.all([
            db
                .select({ total: count() })
                .from(systemLogs)
                .leftJoin(users, eq(systemLogs.userId, users.id))
                .where(logWhere),
            db
                .select({
                    id: systemLogs.id,
                    createdAt: systemLogs.createdAt,
                    level: systemLogs.level,
                    source: systemLogs.source,
                    event: systemLogs.event,
                    message: systemLogs.message,
                    durationMs: systemLogs.durationMs,
                    metadata: systemLogs.metadata,
                    sessionId: systemLogs.sessionId,
                    userId: systemLogs.userId,
                    participantCode: users.participantCode,
                    userName: users.name,
                })
                .from(systemLogs)
                .leftJoin(users, eq(systemLogs.userId, users.id))
                .where(logWhere)
                .orderBy(desc(systemLogs.createdAt))
                .limit(LOGS_PAGE_SIZE)
                .offset((filters.pagina - 1) * LOGS_PAGE_SIZE),
        ]);

        const sessionConditions: SQL[] = [...people];
        if (from) sessionConditions.push(gte(voiceSessions.startedAt, from));
        if (to) sessionConditions.push(lt(voiceSessions.startedAt, to));

        const sessionWhere = sessionConditions.length > 0 ? and(...sessionConditions) : undefined;
        const [[{ sessionsTotal }], sessionRows] = await Promise.all([
            db
                .select({ sessionsTotal: count() })
                .from(voiceSessions)
                .innerJoin(users, eq(voiceSessions.userId, users.id))
                .innerJoin(books, eq(voiceSessions.bookId, books.id))
                .where(sessionWhere),
            db
                .select({
                    id: voiceSessions.id,
                    startedAt: voiceSessions.startedAt,
                    durationSeconds: voiceSessions.durationSeconds,
                    difficultyLevel: voiceSessions.difficultyLevel,
                    bookTitle: books.title,
                    userId: users.id,
                    participantCode: users.participantCode,
                    userName: users.name,
                    studyGroup: users.studyGroup,
                    turns: sql<number>`(select count(*) from session_turns st where st.session_id = ${voiceSessions.id})`.mapWith(Number),
                })
                .from(voiceSessions)
                .innerJoin(users, eq(voiceSessions.userId, users.id))
                .innerJoin(books, eq(voiceSessions.bookId, books.id))
                .where(sessionWhere)
                .orderBy(desc(voiceSessions.startedAt))
                .limit(SESSIONS_PAGE_SIZE)
                .offset((filters.paginaSesiones - 1) * SESSIONS_PAGE_SIZE),
        ]);

        const severity = sessionRows.length === 0
            ? []
            : await db
                .select({ sessionId: systemLogs.sessionId, level: systemLogs.level, n: count() })
                .from(systemLogs)
                .where(and(
                    inArray(systemLogs.sessionId, sessionRows.map((row) => row.id)),
                    inArray(systemLogs.level, ['warn', 'error']),
                ))
                .groupBy(systemLogs.sessionId, systemLogs.level);

        const sessions = sessionRows.map((row) => ({
            ...row,
            warnings: severity.find((item) => item.sessionId === row.id && item.level === 'warn')?.n ?? 0,
            errors: severity.find((item) => item.sessionId === row.id && item.level === 'error')?.n ?? 0,
        }));

        return {
            success: true,
            data: { logs, total, pageSize: LOGS_PAGE_SIZE, sessions, sessionsTotal, sessionsPageSize: SESSIONS_PAGE_SIZE },
        };
    } catch (e) {
        console.error('Error loading system logs', e);
        return { success: false, error: 'No se pudieron cargar los logs del sistema.' };
    }
};

export interface AdminSessionHeader {
    userId: string;
    userName: string;
    email: string;
    participantCode: string | null;
    studyGroup: string | null;
}

/** Every log row of one session, oldest first, plus who the session belongs to. */
export const getSessionLogsForAdmin = async (
    sessionId: string,
): Promise<{ success: boolean; data?: { participant: AdminSessionHeader; logs: SystemLogRow[] }; error?: string }> => {
    try {
        await requireAdmin();

        const [participant] = await db
            .select({
                userId: users.id,
                userName: users.name,
                email: users.email,
                participantCode: users.participantCode,
                studyGroup: users.studyGroup,
            })
            .from(voiceSessions)
            .innerJoin(users, eq(voiceSessions.userId, users.id))
            .where(eq(voiceSessions.id, sessionId))
            .limit(1);

        if (!participant) return { success: false, error: 'Sesión no encontrada.' };

        const rows = await db
            .select({
                id: systemLogs.id,
                createdAt: systemLogs.createdAt,
                level: systemLogs.level,
                source: systemLogs.source,
                event: systemLogs.event,
                message: systemLogs.message,
                durationMs: systemLogs.durationMs,
                metadata: systemLogs.metadata,
                sessionId: systemLogs.sessionId,
                userId: systemLogs.userId,
            })
            .from(systemLogs)
            .where(eq(systemLogs.sessionId, sessionId))
            .orderBy(systemLogs.createdAt);

        const logs = rows.map((row) => ({
            ...row,
            participantCode: participant.participantCode,
            userName: participant.userName,
        }));

        return { success: true, data: { participant, logs } };
    } catch (e) {
        console.error('Error loading session logs', e);
        return { success: false, error: 'No se pudieron cargar los logs de la sesión.' };
    }
};
