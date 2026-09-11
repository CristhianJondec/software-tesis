import { index, jsonb, pgTable, real, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

import { users } from './auth';

export type SurveyAnswers = Record<string, number>;

/**
 * Immutable submissions for the thesis instruments. Answers are deliberately
 * stored raw so the score can be audited or recalculated without changing what
 * the participant selected.
 */
export const surveyResponses = pgTable('survey_responses', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    surveyType: text('survey_type').notNull(), // STAI | PRCS12 | SUS
    phase: text('phase').notNull(), // T1 | T2 | UNICA
    answers: jsonb('answers').$type<SurveyAnswers>().notNull(),
    computedScore: real('computed_score').notNull(),
    submittedAt: timestamp('submitted_at').notNull().defaultNow(),
}, (t) => [
    uniqueIndex('survey_responses_user_instrument_phase_idx').on(t.userId, t.surveyType, t.phase),
    index('survey_responses_user_idx').on(t.userId),
]);
