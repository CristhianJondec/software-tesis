import { boolean, index, integer, pgTable, real, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

import { books } from './books';

/**
 * Which topics of the defense taxonomy the student's document can answer
 * (docs/propuestas/03).
 *
 * One row per (document, topic), written by running the retriever over the
 * canonical query of each topic with the SAME top-k and the SAME relevance
 * threshold a live session uses. A row with `covered = false` is the fourth
 * state of the preparation map — "hueco en el documento" — and it is the only
 * one of the four that is a claim about the thesis rather than about the
 * student's performance.
 *
 * The result is cached rather than recomputed on every page view because it
 * costs one embedding call per topic, and because the thesis has to be able to
 * say when a gap was measured. `max_distance` stores the threshold that produced
 * the row, so a measurement taken before the threshold was calibrated stays
 * readable instead of being silently reinterpreted.
 */
export const bookTopicCoverage = pgTable('book_topic_coverage', {
    id: text('id').primaryKey(),
    bookId: text('book_id')
        .notNull()
        .references(() => books.id, { onDelete: 'cascade' }),
    // Id from PREPARATION_TOPIC_IDS (lib/preparation/topics.ts). Text and not an
    // enum: the taxonomy is versioned in code, and a new topic must not need a
    // migration to be measured.
    topicId: text('topic_id').notNull(),
    // False = the retriever returned nothing within the threshold: a gap.
    covered: boolean('covered').notNull(),
    matchedSegments: integer('matched_segments').notNull(),
    // Cosine distance of the nearest segment. Null exactly when nothing matched.
    bestDistance: real('best_distance'),
    // JSON arrays. Pages are what the student reads in the map; segment ids are
    // what makes a page traceable back to the fragment that justified it.
    pages: text('pages').notNull(),
    segmentIds: text('segment_ids').notNull(),
    // Threshold applied when this row was written (RETRIEVER_MAX_DISTANCE).
    maxDistance: real('max_distance').notNull(),
    computedAt: timestamp('computed_at').notNull().defaultNow(),
}, (t) => [
    uniqueIndex('book_topic_coverage_book_topic_idx').on(t.bookId, t.topicId),
    index('book_topic_coverage_book_idx').on(t.bookId),
]);
