import 'server-only';

import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { db } from '@/database/db';
import { systemLogs, voiceSessions } from '@/database/schema';
import { clampLogPayload, type LogEvent, type LogLevel, type LogSource } from '@/lib/system-logs/catalog';

export interface SystemLogEntry {
    level: LogLevel;
    source: LogSource;
    event: LogEvent;
    message: string;
    sessionId?: string | null;
    userId?: string | null;
    durationMs?: number | null;
    metadata?: Record<string, unknown> | null;
}

/**
 * Appends one row to the system log. Never throws: logging must not be the
 * reason a session breaks, so a failed write only reaches the server console.
 *
 * When only the session is known (the Vapi webhook), the owner is looked up so
 * the admin can still filter the row by participant.
 */
export async function writeSystemLog(entry: SystemLogEntry): Promise<void> {
    try {
        let userId = entry.userId ?? null;
        if (!userId && entry.sessionId) {
            const [session] = await db
                .select({ userId: voiceSessions.userId })
                .from(voiceSessions)
                .where(eq(voiceSessions.id, entry.sessionId))
                .limit(1);
            userId = session?.userId ?? null;
        }

        const { message, metadata } = clampLogPayload(entry.message, entry.metadata);
        const durationMs = entry.durationMs != null && Number.isFinite(entry.durationMs)
            ? Math.max(0, Math.round(entry.durationMs))
            : null;

        await db.insert(systemLogs).values({
            id: nanoid(),
            sessionId: entry.sessionId ?? null,
            userId,
            level: entry.level,
            source: entry.source,
            event: entry.event,
            message,
            durationMs,
            metadata,
        });
    } catch (error) {
        console.error('Failed to write system log', entry.event, error);
    }
}

/** Plain description of anything thrown, for the `message` of an error row. */
export function describeError(error: unknown): string {
    if (error instanceof Error) return error.message || error.name;
    if (typeof error === 'string') return error;
    try {
        return JSON.stringify(error);
    } catch {
        return String(error);
    }
}
