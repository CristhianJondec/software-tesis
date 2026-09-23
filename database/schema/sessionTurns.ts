import { pgTable, text, integer, real, timestamp, index } from 'drizzle-orm/pg-core';
import { voiceSessions } from './voiceSessions';
import { bookSegments } from './bookSegments';

// One row per intervention in a voice session (student or evaluator agent).
// Written turn by turn during the call so evidence survives a tab close.
export const sessionTurns = pgTable('session_turns', {
    id: text('id').primaryKey(),
    sessionId: text('session_id').notNull().references(() => voiceSessions.id, { onDelete: 'cascade' }),
    turnIndex: integer('turn_index').notNull(),
    role: text('role').notNull(), // 'assistant' | 'user'
    content: text('content').notNull(),
    startedAt: timestamp('started_at').notNull(),
    endedAt: timestamp('ended_at').notNull(),
    // Time between the end of the agent question and the student's first word.
    studentLatencyMs: integer('student_latency_ms'),
    // Time between the end of the student turn and the start of the agent reply.
    systemLatencyMs: integer('system_latency_ms'),
    // Longest gap between two consecutive partial transcripts of this turn.
    // Only on student turns. It is silence AS THE TRANSCRIBER SAW IT, not
    // acoustic silence: the STT emits partials in batches, so short gaps are
    // cadence rather than pausing. Feeds dimension 3 of the post-session report
    // (docs/propuestas/02); the threshold that makes a gap reportable lives in
    // lib/feedback/observations.ts.
    maxPauseMs: integer('max_pause_ms'),
    // Topic of the defense taxonomy this turn belongs to, on AGENT turns only
    // (docs/propuestas/03). Written by the lexical classifier in
    // lib/preparation/classify.ts when the turn is persisted, so the preparation
    // map can say which topics were actually practised. NULL means no cue
    // matched -- the question is left untagged rather than filed under a guess.
    topic: text('topic'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
    index('session_turns_session_turn_idx').on(t.sessionId, t.turnIndex),
]);

// Segments the retriever returned to answer a turn, with their ranking.
export const turnRetrievals = pgTable('turn_retrievals', {
    id: text('id').primaryKey(),
    // Nullable: the webhook may run before the turn row exists.
    turnId: text('turn_id').references(() => sessionTurns.id, { onDelete: 'cascade' }),
    sessionId: text('session_id').references(() => voiceSessions.id, { onDelete: 'cascade' }),
    segmentId: text('segment_id').notNull().references(() => bookSegments.id, { onDelete: 'cascade' }),
    query: text('query').notNull(),
    rank: integer('rank').notNull(),
    distance: real('distance').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
    index('turn_retrievals_turn_idx').on(t.turnId),
    index('turn_retrievals_session_idx').on(t.sessionId),
]);
