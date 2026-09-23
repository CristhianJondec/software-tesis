import { pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

import { voiceSessions } from './voiceSessions';

/**
 * What the student expected of a session, and what they decided to try next
 * (docs/propuestas/04).
 *
 * One row per session at most. The three predictions are written BEFORE the
 * call connects, so they cannot be edited once the student knows how it went:
 * a prediction rewritten after the fact is no longer a prediction, and the whole
 * point of the table is to hold the "antes" fixed while the session produces the
 * "después".
 *
 * THE CONTRAST IS NOT STORED HERE. It is recomputed on every read by
 * `lib/prediction/contrast.ts` from `session_turns` and `turn_feedback`, for the
 * same reason dimension 3 of the post-session report is not stored: a sentence
 * saved next to the prediction would drift from the evidence it claims to
 * summarise, and a re-evaluated answer would leave it stale. Recomputing keeps
 * every line of the contrast traceable to a row the thesis can query.
 *
 * Every column is nullable because every question is optional. A student who
 * skips all of them still practises (docs/propuestas/04, "qué NO hacer").
 */
export const sessionPredictions = pgTable('session_predictions', {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
        .notNull()
        .references(() => voiceSessions.id, { onDelete: 'cascade' }),
    // --- Asked in writing before the call (never by voice: it would spend
    // session time the student is paying for in nerves) ----------------------
    /** "¿Qué crees que te van a preguntar?" — verbatim. */
    expectedQuestions: text('expected_questions'),
    /**
     * JSON array of taxonomy ids found in `expected_questions` by the lexical
     * classifier (`lib/preparation/classify.ts`) at the moment it was written.
     * Stored, not recomputed, because the cue lists are versioned in code: if a
     * cue changes next month, the contrast the student actually read must stay
     * reconstructible.
     */
    expectedTopics: text('expected_topics').notNull().default('[]'),
    /** "¿Qué parte te da más temor?" — verbatim. */
    fearedPart: text('feared_part'),
    /** The single taxonomy id `feared_part` resolved to. NULL = no cue matched. */
    fearedTopic: text('feared_topic'),
    /** "¿Qué crees que pasaría si no recuerdas una respuesta?" — verbatim. */
    blankOutcome: text('blank_outcome'),
    // --- Asked when the session closes ---------------------------------------
    /**
     * "¿Qué vas a probar distinto en la siguiente sesión?". Shown back to the
     * student at the start of the next session with this document.
     */
    nextStrategy: text('next_strategy'),
    /** When the strategy was declared. NULL exactly when there is none. */
    strategyAt: timestamp('strategy_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
    uniqueIndex('session_predictions_session_idx').on(t.sessionId),
]);
