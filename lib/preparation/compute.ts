/**
 * Measures which topics of the taxonomy the student's document can answer, and
 * caches the result in `book_topic_coverage`.
 *
 * Server-only helper, deliberately NOT a server action: it is called both from
 * the ingestion path (`saveBookSegments`) and from an action that has already
 * checked ownership. Callers are responsible for authorisation — nothing here
 * verifies who is asking.
 *
 * The vector search is written out here instead of calling `searchBookSegments`
 * to avoid an import cycle between `book.actions` and this module. It must stay
 * identical in top-k and threshold to that function: coverage is only meaningful
 * if it reports what the agent would actually have retrieved.
 */

import { cosineDistance, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { db } from '@/database/db';
import { bookSegments, bookTopicCoverage } from '@/database/schema';
import { RETRIEVER_MAX_DISTANCE, RETRIEVER_TOP_K } from '@/lib/constants';
import { generateQueryEmbedding } from '@/lib/embeddings';

import { summarizeTopicCoverage, type CoverageSearchRow } from './coverage.ts';
import { ORDERED_PREPARATION_TOPICS } from './topics.ts';

export interface CoverageComputation {
    topics: number;
    covered: number;
    gaps: number;
    maxDistance: number;
}

async function searchTopic(bookId: string, query: string): Promise<CoverageSearchRow[]> {
    const embedding = await generateQueryEmbedding(query);
    const distance = cosineDistance(bookSegments.embedding, embedding);

    const rows = await db
        .select({
            segmentId: bookSegments.id,
            pageNumber: bookSegments.pageNumber,
            distance,
        })
        .from(bookSegments)
        .where(eq(bookSegments.bookId, bookId))
        .orderBy(distance)
        .limit(RETRIEVER_TOP_K);

    return rows.map((row) => ({
        segmentId: row.segmentId,
        pageNumber: row.pageNumber,
        distance: Number(row.distance),
    }));
}

/**
 * Recomputes every topic of the taxonomy for one document and replaces its rows.
 *
 * One embedding call per topic, run sequentially: this happens once per document
 * (and on demand from the map), and Gemini's rate limit is not worth racing for
 * twelve queries.
 */
export async function computeBookTopicCoverage(bookId: string): Promise<CoverageComputation> {
    const summaries = [];

    for (const topic of ORDERED_PREPARATION_TOPICS) {
        const rows = await searchTopic(bookId, topic.query);
        summaries.push(summarizeTopicCoverage(topic.id, rows, RETRIEVER_MAX_DISTANCE));
    }

    const computedAt = new Date();

    for (const summary of summaries) {
        const values = {
            covered: summary.covered,
            matchedSegments: summary.matchedSegments,
            bestDistance: summary.bestDistance,
            pages: JSON.stringify(summary.pages),
            segmentIds: JSON.stringify(summary.segmentIds),
            maxDistance: summary.maxDistance,
            computedAt,
        };

        await db
            .insert(bookTopicCoverage)
            .values({ id: nanoid(), bookId, topicId: summary.topicId, ...values })
            .onConflictDoUpdate({
                target: [bookTopicCoverage.bookId, bookTopicCoverage.topicId],
                set: values,
            });
    }

    const covered = summaries.filter((summary) => summary.covered).length;

    return {
        topics: summaries.length,
        covered,
        gaps: summaries.length - covered,
        maxDistance: RETRIEVER_MAX_DISTANCE,
    };
}
