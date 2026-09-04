import { pgTable, text, boolean, real, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { sessionTurns } from './sessionTurns';

// Human judgement behind PR (Precisión de Respuestas) = (Rc / Rt) × 100.
// One row per reviewed agent turn: Rt is the number of rows, Rc the number of
// rows with `isCorrect` true. Turns without a row are still pending review and
// must never be counted as either correct or incorrect.
export const turnEvaluations = pgTable('turn_evaluations', {
    id: text('id').primaryKey(),
    turnId: text('turn_id').notNull().references(() => sessionTurns.id, { onDelete: 'cascade' }),
    isCorrect: boolean('is_correct').notNull(),
    notes: text('notes'),
    // Who marked it. Kept so a second rater can be added later without a migration.
    evaluatedBy: text('evaluated_by').references(() => users.id, { onDelete: 'set null' }),
    evaluatedAt: timestamp('evaluated_at').notNull().defaultNow(),
}, (t) => [
    // One verdict per turn: re-marking updates instead of piling up rows.
    uniqueIndex('turn_evaluations_turn_idx').on(t.turnId),
]);

// Cached RAGAs scores for one (question, retrieved context, answer) triple.
//
// The scores are cached rather than recomputed on every page view for two
// reasons: each triple costs several LLM judge calls, and the thesis needs the
// exact numbers that were reported to still be there when the jury asks.
// `promptVersion` pins the judge prompt that produced them, so changing the
// prompt yields new rows instead of silently rewriting past measurements.
export const ragasEvaluations = pgTable('ragas_evaluations', {
    id: text('id').primaryKey(),
    turnId: text('turn_id').notNull().references(() => sessionTurns.id, { onDelete: 'cascade' }),
    promptVersion: text('prompt_version').notNull(),
    // All four in [0, 1]. Null means "not computable for this triple" (for
    // example, faithfulness over an answer that makes no verifiable claim).
    faithfulness: real('faithfulness'),
    answerRelevancy: real('answer_relevancy'),
    contextPrecision: real('context_precision'),
    contextRecall: real('context_recall'),
    // JSON trace of the judge output (claims, verdicts) for auditing.
    detail: text('detail'),
    computedAt: timestamp('computed_at').notNull().defaultNow(),
}, (t) => [
    uniqueIndex('ragas_evaluations_turn_version_idx').on(t.turnId, t.promptVersion),
    index('ragas_evaluations_version_idx').on(t.promptVersion),
]);
