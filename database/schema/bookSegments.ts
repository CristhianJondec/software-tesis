import { pgTable, text, integer, timestamp, index, uniqueIndex, vector } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { books } from './books';

export const bookSegments = pgTable('book_segments', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    segmentIndex: integer('segment_index').notNull(),
    pageNumber: integer('page_number'),
    wordCount: integer('word_count').notNull(),
    embedding: vector('embedding', { dimensions: 768 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
    uniqueIndex('book_segments_book_segment_idx').on(t.bookId, t.segmentIndex),
    index('book_segments_book_idx').on(t.bookId),
    // HNSW index added manually in 0000_init.sql:
    //   CREATE INDEX book_segments_embedding_hnsw
    //     ON book_segments USING hnsw (embedding vector_cosine_ops);
]);
