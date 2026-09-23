import { pgTable, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './auth';

/**
 * The preparation dossier handed to the control arm (and readable by everyone).
 *
 * Unlike `books`, these are NOT user-scoped: the researcher uploads one shared
 * set of PDFs that every participant sees, so the control condition is the same
 * material for all of them. Ownership is recorded only for the audit trail.
 */
export const studyMaterials = pgTable('study_materials', {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    fileName: text('file_name').notNull(),
    fileBlobKey: text('file_blob_key').notNull(),
    fileSize: integer('file_size').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    uploadedBy: text('uploaded_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
    index('study_materials_sort_idx').on(t.sortOrder, t.createdAt),
]);
