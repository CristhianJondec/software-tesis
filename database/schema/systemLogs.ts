import { index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { users } from './auth';
import { voiceSessions } from './voiceSessions';

/**
 * Technical event log of the system, read only by the admin (/admin/logs).
 *
 * It is NOT research evidence: turns, latencies and retrievals live in their own
 * tables. This records what the components did around them -- a call that
 * started or dropped, a webhook that took long or failed, a turn that could not
 * be saved -- so a broken session can be explained after the fact. The event
 * catalog lives in lib/system-logs/catalog.ts.
 */
export const systemLogs = pgTable('system_logs', {
    id: text('id').primaryKey(),
    // Both nullable: some events happen before a session exists (a rejected
    // start) or arrive from Vapi without a session that can be matched.
    sessionId: text('session_id').references(() => voiceSessions.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    level: text('level').notNull(), // 'info' | 'warn' | 'error'
    source: text('source').notNull(), // 'client' | 'server' | 'webhook'
    event: text('event').notNull(),
    message: text('message').notNull(),
    durationMs: integer('duration_ms'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
    index('system_logs_created_idx').on(t.createdAt),
    index('system_logs_session_created_idx').on(t.sessionId, t.createdAt),
    index('system_logs_user_created_idx').on(t.userId, t.createdAt),
]);
