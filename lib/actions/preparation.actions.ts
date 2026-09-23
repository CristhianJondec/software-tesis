'use server';

import { and, asc, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { db } from '@/database/db';
import {
    books,
    bookTopicCoverage,
    sessionTurns,
    turnFeedback,
    voiceSessions,
} from '@/database/schema';
import { FEEDBACK_PROMPT_VERSION } from '@/lib/feedback/evaluate';
import { computeBookTopicCoverage } from '@/lib/preparation/compute';
import { parsePageList, type StoredTopicCoverage } from '@/lib/preparation/coverage';
import {
    buildPreparationMap,
    type PreparationMap,
    type PreparationTurnRow,
} from '@/lib/preparation/map';
import { isPreparationTopicId } from '@/lib/preparation/topics';
import { requireUser } from '@/lib/session';

/**
 * Server actions behind the preparation map (docs/propuestas/03).
 *
 * Ownership-scoped like `feedback.actions.ts`, not researcher-scoped: the map is
 * a diagnosis of one student's own preparation and nothing here reads across
 * participants.
 */

export interface PreparationMapData {
    book: { id: string; title: string; slug: string };
    map: PreparationMap;
    /** The document has never been analysed: the four states cannot be resolved yet. */
    needsCoverage: boolean;
}

export interface PreparationMapResult {
    success: boolean;
    data?: PreparationMapData;
    error?: string;
}

async function requireOwnedBook(bookId: string) {
    const user = await requireUser();

    const [book] = await db
        .select({ id: books.id, title: books.title, slug: books.slug })
        .from(books)
        .where(and(eq(books.id, bookId), eq(books.userId, user.id)))
        .limit(1);

    if (!book) throw new Error('Investigación no encontrada.');
    return { user, book };
}

export const getPreparationMap = async (bookId: string): Promise<PreparationMapResult> => {
    try {
        const { user, book } = await requireOwnedBook(bookId);

        const coverageRows = await db
            .select()
            .from(bookTopicCoverage)
            .where(eq(bookTopicCoverage.bookId, book.id));

        // A row whose topic id is no longer in the taxonomy is dropped rather
        // than shown: the taxonomy is versioned in code, and a stale row must
        // not resurrect a topic the map no longer defines.
        const coverage: StoredTopicCoverage[] = coverageRows
            .filter((row) => isPreparationTopicId(row.topicId))
            .map((row) => ({
                topicId: row.topicId as StoredTopicCoverage['topicId'],
                covered: row.covered,
                matchedSegments: row.matchedSegments,
                bestDistance: row.bestDistance,
                pages: parsePageList(row.pages),
                maxDistance: row.maxDistance,
                computedAt: row.computedAt,
            }));

        const sessions = await db
            .select({
                id: voiceSessions.id,
                startedAt: voiceSessions.startedAt,
                difficultyLevel: voiceSessions.difficultyLevel,
            })
            .from(voiceSessions)
            .where(and(eq(voiceSessions.userId, user.id), eq(voiceSessions.bookId, book.id)))
            .orderBy(asc(voiceSessions.startedAt));

        const sessionIds = sessions.map((session) => session.id);

        const turns: PreparationTurnRow[] =
            sessionIds.length === 0
                ? []
                : await db
                      .select({
                          id: sessionTurns.id,
                          sessionId: sessionTurns.sessionId,
                          turnIndex: sessionTurns.turnIndex,
                          role: sessionTurns.role,
                          content: sessionTurns.content,
                          topic: sessionTurns.topic,
                          startedAt: sessionTurns.startedAt,
                      })
                      .from(sessionTurns)
                      .where(inArray(sessionTurns.sessionId, sessionIds))
                      .orderBy(asc(sessionTurns.turnIndex));

        const turnIds = turns.map((turn) => turn.id);

        const feedback =
            turnIds.length === 0
                ? []
                : await db
                      .select({
                          turnId: turnFeedback.turnId,
                          contentLevel: turnFeedback.contentLevel,
                          contentSegmentId: turnFeedback.contentSegmentId,
                      })
                      .from(turnFeedback)
                      .where(
                          and(
                              inArray(turnFeedback.turnId, turnIds),
                              eq(turnFeedback.promptVersion, FEEDBACK_PROMPT_VERSION),
                          ),
                      );

        const map = buildPreparationMap({ coverage, sessions, turns, feedback });

        return {
            success: true,
            data: { book, map, needsCoverage: coverage.length === 0 },
        };
    } catch (e) {
        console.error('Error building preparation map', e);
        return { success: false, error: (e as Error).message || 'No se pudo cargar el mapa.' };
    }
};

export interface RefreshCoverageResult {
    success: boolean;
    data?: { topics: number; covered: number; gaps: number };
    error?: string;
}

/**
 * Re-measures the document against the taxonomy.
 *
 * Exposed as a button because the measurement can go stale in two ways the app
 * cannot detect on its own: the student re-uploads a corrected thesis, or the
 * relevance threshold is recalibrated after the pilot (see the note on
 * RETRIEVER_MAX_DISTANCE in lib/constants.ts).
 */
export const refreshTopicCoverage = async (bookId: string): Promise<RefreshCoverageResult> => {
    try {
        const { book } = await requireOwnedBook(bookId);

        if (!process.env.GEMINI_API_KEY) {
            return { success: false, error: 'Falta GEMINI_API_KEY: no se puede analizar el documento.' };
        }

        const result = await computeBookTopicCoverage(book.id);

        revalidatePath('/preparacion');

        return {
            success: true,
            data: { topics: result.topics, covered: result.covered, gaps: result.gaps },
        };
    } catch (e) {
        console.error('Error refreshing topic coverage', e);
        return { success: false, error: (e as Error).message || 'No se pudo analizar el documento.' };
    }
};
