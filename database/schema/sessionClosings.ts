import { pgTable, integer, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

import { voiceSessions } from './voiceSessions';

/**
 * What the agent actually said out loud when it closed a session
 * (docs/propuestas/05).
 *
 * WHY THIS IS STORED WHEN THE EVIDENCE ITSELF IS NOT. The list of achievements
 * shown on screen is recomputed on every read by `lib/progress/evidence.ts`, for
 * the same reason dimension 3 of the report and the prediction contrast are
 * recomputed: a sentence saved next to the session would drift from the rows it
 * claims to summarise, and evaluating a pending answer has to sharpen it.
 *
 * The spoken closing is the opposite case. It is an EVENT: it happened once, in
 * front of the student, with the evidence available at that second — before the
 * judge had run over the answers of the session. It cannot be reconstructed
 * later from the transcript (Vapi's `say` does not always come back as a turn),
 * and the acceptance criterion of the proposal is about what was said, not about
 * what would be said now. So the text is kept verbatim, with the machine-readable
 * ids of the evidence behind it.
 *
 * One row per session at most: a session closes once.
 */
export const sessionClosings = pgTable('session_closings', {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
        .notNull()
        .references(() => voiceSessions.id, { onDelete: 'cascade' }),
    /** Exactly what was sent to the TTS, verbatim. */
    spokenText: text('spoken_text').notNull(),
    /**
     * JSON array of `{ id, kind, text, basis }` — the evidence items read out.
     * Stored so the thesis can count closings by kind instead of parsing Spanish.
     */
    evidence: text('evidence').notNull().default('[]'),
    /** How many achievements the closing carried. 0 means none was available. */
    evidenceCount: integer('evidence_count').notNull().default(0),
    /**
     * Pins `EVIDENCE_GENERATOR_VERSION`, so changing the selection rules yields
     * closings that are still readable as products of the rules of their time.
     */
    generatorVersion: text('generator_version').notNull(),
    spokenAt: timestamp('spoken_at').notNull().defaultNow(),
}, (t) => [
    uniqueIndex('session_closings_session_idx').on(t.sessionId),
]);
