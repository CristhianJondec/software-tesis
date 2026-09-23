import { index, integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

import { bookSegments } from './bookSegments';
import { sessionTurns } from './sessionTurns';

/**
 * Three-dimension feedback on a STUDENT answer (docs/propuestas/02).
 *
 * WHY THIS IS NOT `turn_evaluations`. That table is the human verdict on AGENT
 * turns and it is the denominator of PR = (Rc / Rt) × 100. This one is an LLM
 * verdict on STUDENT turns. Different subject, different rater, different unit
 * of analysis. Putting them in one table would force a meaningless `isCorrect`
 * on every student row and risk those rows reaching PR's denominator, which
 * would corrupt a reported metric. They stay apart on purpose.
 *
 * Only dimensions 1 and 2 are stored. Dimension 3 (observable communicative
 * behaviour) is NOT here: it is arithmetic over `session_turns`, recomputed on
 * every read by `lib/feedback/observations.ts`. Storing a derived number would
 * let it drift from the evidence it claims to summarise, and it is reproducible
 * by construction this way.
 *
 * `promptVersion` pins the judge prompts that produced the levels, so changing a
 * prompt yields new rows instead of silently rewriting past measurements.
 */
export const turnFeedback = pgTable('turn_feedback', {
    id: text('id').primaryKey(),
    // The student turn being evaluated.
    turnId: text('turn_id')
        .notNull()
        .references(() => sessionTurns.id, { onDelete: 'cascade' }),
    promptVersion: text('prompt_version').notNull(),
    // --- Dimension 1: command of the content --------------------------------
    // Rubric level 0-3 (lib/feedback/rubric.ts). NULL means "not conclusive" —
    // no valid citation, or the judge declined — and must never be read as 0.
    contentLevel: integer('content_level'),
    contentJustification: text('content_justification'),
    // The fragment of the student's own document that backs the content verdict.
    // A content level without one is rejected before it reaches this table, so a
    // non-null level always has a non-null segment here.
    contentSegmentId: text('content_segment_id').references(() => bookSegments.id, {
        onDelete: 'set null',
    }),
    // --- Dimension 2: clarity and structure ---------------------------------
    // Judged from question and answer only: it is not a claim about the document,
    // so it carries no citation.
    clarityLevel: integer('clarity_level'),
    clarityJustification: text('clarity_justification'),
    // JSON trace of the judge output (cited index, rejections, errors).
    detail: text('detail'),
    computedAt: timestamp('computed_at').notNull().defaultNow(),
}, (t) => [
    uniqueIndex('turn_feedback_turn_version_idx').on(t.turnId, t.promptVersion),
    index('turn_feedback_version_idx').on(t.promptVersion),
]);
