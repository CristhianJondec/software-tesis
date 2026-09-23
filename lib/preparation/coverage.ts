/**
 * Turns what the retriever returned for a topic into the coverage row the map
 * reads: which pages of the document cover it, and whether it is covered at all.
 *
 * THE FOURTH STATE OF THE MAP IS BORN HERE. "Hueco en el documento" is not an
 * opinion about the thesis: it is the retriever returning nothing within the
 * relevance threshold it already applies during a live session. Coverage is
 * measured with the SAME threshold and the same top-k the agent runs with
 * (lib/constants.ts), so a topic reported as a gap is exactly a topic the agent
 * would have had to answer "that is not in your document" about.
 *
 * Pure module: no database, no network. The caller runs the vector search.
 */

import type { PreparationTopicId } from './topics.ts';

export interface CoverageSearchRow {
    segmentId: string;
    pageNumber: number | null;
    /** Cosine distance to the topic query. 0 = identical. */
    distance: number;
}

export interface TopicCoverageSummary {
    topicId: PreparationTopicId;
    /** False means the document has nothing for this topic: a gap. */
    covered: boolean;
    /** Segments within the threshold. Zero exactly when `covered` is false. */
    matchedSegments: number;
    /** Distance of the nearest segment, null when nothing matched. */
    bestDistance: number | null;
    /** Pages of the document that cover the topic, ascending, deduplicated. */
    pages: number[];
    /** Ids of the matched segments, nearest first. Kept so a page can be traced. */
    segmentIds: string[];
    /** Threshold applied, stored with the row so an old measurement stays readable. */
    maxDistance: number;
}

/**
 * `rows` may arrive unfiltered: the threshold is applied here as well so a
 * caller that forgets it cannot silently turn a gap into coverage.
 */
export function summarizeTopicCoverage(
    topicId: PreparationTopicId,
    rows: ReadonlyArray<CoverageSearchRow>,
    maxDistance: number,
): TopicCoverageSummary {
    const relevant = rows
        .filter((row) => Number.isFinite(row.distance) && row.distance <= maxDistance)
        .slice()
        .sort((a, b) => a.distance - b.distance);

    const pages = Array.from(
        new Set(
            relevant
                .map((row) => row.pageNumber)
                .filter((page): page is number => typeof page === 'number'),
        ),
    ).sort((a, b) => a - b);

    return {
        topicId,
        covered: relevant.length > 0,
        matchedSegments: relevant.length,
        bestDistance: relevant.length > 0 ? relevant[0].distance : null,
        pages,
        segmentIds: relevant.map((row) => row.segmentId),
        maxDistance,
    };
}

/** A coverage row as the database hands it over, with its JSON columns parsed. */
export interface StoredTopicCoverage {
    topicId: PreparationTopicId;
    covered: boolean;
    matchedSegments: number;
    bestDistance: number | null;
    pages: number[];
    maxDistance: number;
    computedAt: Date;
}

/** Defensive parse of a JSON array column. A corrupt value reads as empty. */
export function parsePageList(value: string | null): number[] {
    if (!value) return [];
    try {
        const parsed: unknown = JSON.parse(value);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((page): page is number => typeof page === 'number');
    } catch {
        return [];
    }
}
