import { pgTable, text, integer, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { books } from './books';

export const voiceSessions = pgTable('voice_sessions', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
    // Links our research session to the exact Vapi call. Vapi details are read
    // server-side; its private API key must never be exposed to the browser.
    vapiCallId: text('vapi_call_id'),
    startedAt: timestamp('started_at').notNull().defaultNow(),
    endedAt: timestamp('ended_at'),
    durationSeconds: integer('duration_seconds').notNull().default(0),
    billingPeriodStart: timestamp('billing_period_start').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
    index('voice_sessions_user_period_idx').on(t.userId, t.billingPeriodStart),
    index('voice_sessions_book_idx').on(t.bookId),
    uniqueIndex('voice_sessions_vapi_call_idx').on(t.vapiCallId),
]);
