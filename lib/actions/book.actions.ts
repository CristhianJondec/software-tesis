'use server';

import { and, count, cosineDistance, desc, eq, ilike, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { revalidatePath } from 'next/cache';

import { db } from '@/database/db';
import { books, bookSegments } from '@/database/schema';
import { MAX_BOOKS_PER_USER, RETRIEVER_MAX_DISTANCE, RETRIEVER_TOP_K } from '@/lib/constants';
import { generateEmbeddings, generateQueryEmbedding } from '@/lib/embeddings';
import { getSession, requireUser } from '@/lib/session';
import { deleteObjects } from '@/lib/r2';
import { generateSlug } from '@/lib/utils';
import type { CreateBook, TextSegment } from '@/types';

export const getAllBooks = async (search?: string) => {
    try {
        const session = await getSession();
        if (!session?.user) {
            return { success: true, data: [] };
        }

        const userId = session.user.id;
        const filters = search
            ? and(
                  eq(books.userId, userId),
                  or(ilike(books.title, `%${search}%`), ilike(books.author, `%${search}%`)),
              )
            : eq(books.userId, userId);

        const rows = await db
            .select()
            .from(books)
            .where(filters)
            .orderBy(desc(books.createdAt));

        return { success: true, data: rows };
    } catch (e) {
        console.error('Error fetching books', e);
        return { success: false, error: e };
    }
};

export const checkBookExists = async (title: string) => {
    try {
        const session = await getSession();
        if (!session?.user) return { exists: false };

        const slug = generateSlug(title);
        const rows = await db
            .select()
            .from(books)
            .where(and(eq(books.userId, session.user.id), eq(books.slug, slug)))
            .limit(1);

        if (rows.length === 0) return { exists: false };
        return { exists: true, book: rows[0] };
    } catch (e) {
        console.error('Error checking book exists', e);
        return { exists: false, error: e };
    }
};

export const getUserBookCount = async () => {
    try {
        const session = await getSession();
        if (!session?.user) return { success: true, data: 0 };

        const [row] = await db
            .select({ value: count() })
            .from(books)
            .where(eq(books.userId, session.user.id));

        return { success: true, data: row?.value ?? 0 };
    } catch (e) {
        console.error('Error counting books', e);
        return { success: false, error: e, data: 0 };
    }
};

export const createBook = async (data: CreateBook) => {
    try {
        const user = await requireUser();
        const userId = user.id;

        const slug = generateSlug(data.title);

        const existing = await db
            .select()
            .from(books)
            .where(and(eq(books.userId, userId), eq(books.slug, slug)))
            .limit(1);

        if (existing.length > 0) {
            return { success: true, data: existing[0], alreadyExists: true };
        }

        const [{ value: bookCount }] = await db
            .select({ value: count() })
            .from(books)
            .where(eq(books.userId, userId));

        if (bookCount >= MAX_BOOKS_PER_USER) {
            return { success: false, error: 'limit_reached' };
        }

        const [book] = await db
            .insert(books)
            .values({
                id: nanoid(),
                userId,
                title: data.title,
                slug,
                author: data.author,
                persona: data.persona,
                fileURL: data.fileURL,
                fileBlobKey: data.fileBlobKey,
                coverURL: data.coverURL,
                coverBlobKey: data.coverBlobKey,
                fileSize: data.fileSize,
                totalSegments: 0,
            })
            .returning();

        return { success: true, data: book };
    } catch (e) {
        console.error('Error creating a book', e);
        return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
};

export const getBookBySlug = async (slug: string) => {
    try {
        const session = await getSession();
        if (!session?.user) return { success: false, error: 'Unauthorized' };

        const rows = await db
            .select()
            .from(books)
            .where(and(eq(books.userId, session.user.id), eq(books.slug, slug)))
            .limit(1);

        if (rows.length === 0) return { success: false, error: 'Book not found' };
        return { success: true, data: rows[0] };
    } catch (e) {
        console.error('Error fetching book by slug', e);
        return { success: false, error: e };
    }
};

export const deleteBook = async (bookId: string) => {
    try {
        const user = await requireUser();

        const deleted = await db
            .delete(books)
            .where(and(eq(books.id, bookId), eq(books.userId, user.id)))
            .returning({
                id: books.id,
                fileBlobKey: books.fileBlobKey,
                coverBlobKey: books.coverBlobKey,
            });

        if (deleted.length === 0) {
            return { success: false, error: 'Investigación no encontrada o sin autorización' };
        }

        try {
            await deleteObjects([deleted[0].fileBlobKey, deleted[0].coverBlobKey]);
        } catch (storageError) {
            // The database is authoritative. Do not restore an already deleted book if
            // remote object cleanup fails; log it so the orphaned files can be audited.
            console.error('Book deleted, but its storage objects could not be removed', storageError);
        }

        revalidatePath('/');
        return { success: true };
    } catch (e) {
        console.error('Error deleting book', e);
        return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
};

export const saveBookSegments = async (bookId: string, segments: TextSegment[]) => {
    try {
        const user = await requireUser();
        const userId = user.id;

        const ownerCheck = await db
            .select({ id: books.id })
            .from(books)
            .where(and(eq(books.id, bookId), eq(books.userId, userId)))
            .limit(1);

        if (ownerCheck.length === 0) {
            return { success: false, error: 'Book not found or unauthorized' };
        }

        console.log(`Generating embeddings for ${segments.length} segments...`);
        const embeddings = await generateEmbeddings(segments.map((s) => s.text));

        await db.transaction(async (tx) => {
            await tx.insert(bookSegments).values(
                segments.map((seg, i) => ({
                    id: nanoid(),
                    userId,
                    bookId,
                    content: seg.text,
                    segmentIndex: seg.segmentIndex,
                    pageNumber: seg.pageNumber,
                    wordCount: seg.wordCount,
                    embedding: embeddings[i],
                })),
            );

            await tx
                .update(books)
                .set({ totalSegments: segments.length, updatedAt: new Date() })
                .where(eq(books.id, bookId));
        });

        return { success: true, data: { segmentsCreated: segments.length } };
    } catch (e) {
        console.error('Error saving book segments', e);
        return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
};

// Semantic search via pgvector cosine distance over Gemini embeddings.
// `limit` and `maxDistance` default to the retriever parameters declared in
// lib/constants.ts (RETRIEVER_TOP_K, RETRIEVER_MAX_DISTANCE), which is where the
// values and their calibration criterion are documented.
export const searchBookSegments = async (
    bookId: string,
    query: string,
    limit: number = RETRIEVER_TOP_K,
    maxDistance: number = RETRIEVER_MAX_DISTANCE,
) => {
    try {
        console.log(`Searching for: "${query}" in book ${bookId}`);

        const queryEmbedding = await generateQueryEmbedding(query);
        const distance = cosineDistance(bookSegments.embedding, queryEmbedding);

        const results = await db
            .select({
                id: bookSegments.id,
                bookId: bookSegments.bookId,
                content: bookSegments.content,
                segmentIndex: bookSegments.segmentIndex,
                pageNumber: bookSegments.pageNumber,
                wordCount: bookSegments.wordCount,
                // Cosine distance to the query: needed to score retrieval quality.
                distance,
            })
            .from(bookSegments)
            .where(eq(bookSegments.bookId, bookId))
            .orderBy(distance)
            .limit(limit);

        // Relevance cut-off. Ordering alone always yields `limit` rows, so without
        // this the caller receives the least-bad segments for a question the
        // document does not answer. Applied after the ordered query so the HNSW
        // index still drives the scan.
        const relevant = results.filter((row) => Number(row.distance) <= maxDistance);

        console.log(
            `Search complete. ${results.length} nearest, ${relevant.length} within distance ${maxDistance}`,
        );

        return { success: true, data: relevant };
    } catch (error) {
        console.error('Error searching segments:', error);
        return { success: false, error: (error as Error).message, data: [] };
    }
};
