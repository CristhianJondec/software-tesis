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
    // --- Graded exposure (docs/propuestas/01) --------------------------------
    // Difficulty the simulation actually ran at, 1-4. Defaults to the safest
    // level so a row written by older code is never read as a hard session.
    difficultyLevel: integer('difficulty_level').notNull().default(1),
    // 'auto'   = the adaptation rule suggested it and the student kept it.
    // 'manual' = the student overrode the suggestion. The distinction matters:
    // an analysis of the rule must not count sessions the student chose.
    levelSource: text('level_source').notNull().default('auto'),
    // Self-report 0-10 taken right before and right after the session. Null
    // means unanswered, which is not the same as 0 and must never be read as it.
    preSessionAnxiety: integer('pre_session_anxiety'),
    postSessionAnxiety: integer('post_session_anxiety'),
    // --- Focused practice (docs/propuestas/03) -------------------------------
    // JSON array of topic ids the student asked to practise, from the
    // preparation map. NULL = an ordinary session covering the whole defense.
    // Stored so a session run on weak topics is never compared with a full one
    // as if they were the same simulation.
    focusTopics: text('focus_topics'),
    billingPeriodStart: timestamp('billing_period_start').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
    index('voice_sessions_user_period_idx').on(t.userId, t.billingPeriodStart),
    index('voice_sessions_book_idx').on(t.bookId),
    uniqueIndex('voice_sessions_vapi_call_idx').on(t.vapiCallId),
]);
