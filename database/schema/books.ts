import { pgTable, text, integer, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './auth';

export const books = pgTable('books', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    author: text('author').notNull(),
    persona: text('persona'),
    fileURL: text('file_url').notNull(),
    fileBlobKey: text('file_blob_key').notNull(),
    coverURL: text('cover_url'),
    coverBlobKey: text('cover_blob_key'),
    fileSize: integer('file_size').notNull(),
    totalSegments: integer('total_segments').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
    uniqueIndex('books_user_slug_idx').on(t.userId, t.slug),
    index('books_user_idx').on(t.userId),
    index('books_created_at_idx').on(t.createdAt),
]);
