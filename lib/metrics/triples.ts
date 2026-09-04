/**
 * Assembles the (question, retrieved context, answer) triples that RAGAs scores.
 *
 * Where each part comes from, and why:
 *
 *  - The retriever runs while the student's turn is the most recent one, so
 *    `turn_retrievals` rows anchor to the STUDENT turn that provoked the search
 *    (see lib/retrievals.ts). That turn is the question.
 *  - The answer is the first agent turn that follows the anchor in the same
 *    session. Anything else would score the agent on a reply it had not given yet.
 *  - Rows whose `turnId` is null (webhook arrived before the turn was written)
 *    cannot be placed in the conversation and are reported as unanchored rather
 *    than guessed at.
 *
 * Pure module: no database, no imports. The caller does the queries.
 */

export interface TurnRow {
    id: string;
    sessionId: string;
    turnIndex: number;
    role: string;
    content: string;
}

export interface RetrievalRow {
    turnId: string | null;
    sessionId: string | null;
    query: string;
    rank: number;
    distance: number;
    segmentId: string;
    segmentContent: string;
    pageNumber: number | null;
}

export interface RetrievedContext {
    segmentId: string;
    content: string;
    rank: number;
    distance: number;
    pageNumber: number | null;
}

export interface RagasTriple {
    /** Turn the retrieval anchored to - the student's question. */
    anchorTurnId: string;
    sessionId: string;
    /** Agent turn being scored. RAGAs results are stored against this id. */
    answerTurnId: string;
    question: string;
    /** The text the LLM actually sent to the retriever; kept for auditing. */
    query: string;
    answer: string;
    contexts: RetrievedContext[];
}

export interface TripleBuildResult {
    triples: RagasTriple[];
    /** Retrieval rows with no `turnId`: not placeable in the conversation. */
    unanchoredRetrievals: number;
    /** Anchors whose search was never followed by an agent reply (call cut short). */
    anchorsWithoutAnswer: number;
}

export function buildRagasTriples(
    turns: ReadonlyArray<TurnRow>,
    retrievals: ReadonlyArray<RetrievalRow>,
): TripleBuildResult {
    const turnsById = new Map(turns.map((t) => [t.id, t]));

    const turnsBySession = new Map<string, TurnRow[]>();
    for (const turn of turns) {
        const list = turnsBySession.get(turn.sessionId);
        if (list) list.push(turn);
        else turnsBySession.set(turn.sessionId, [turn]);
    }
    for (const list of turnsBySession.values()) {
        list.sort((a, b) => a.turnIndex - b.turnIndex);
    }

    // One triple per (anchor turn, query): a single student turn can trigger
    // more than one search, and each search is its own retrieval to score.
    const groups = new Map<string, { anchorTurnId: string; query: string; rows: RetrievalRow[] }>();
    let unanchoredRetrievals = 0;

    for (const row of retrievals) {
        if (!row.turnId || !turnsById.has(row.turnId)) {
            unanchoredRetrievals++;
            continue;
        }
        const key = `${row.turnId} ${row.query}`;
        const group = groups.get(key);
        if (group) group.rows.push(row);
        else groups.set(key, { anchorTurnId: row.turnId, query: row.query, rows: [row] });
    }

    const triples: RagasTriple[] = [];
    let anchorsWithoutAnswer = 0;

    for (const { anchorTurnId, query, rows } of groups.values()) {
        const anchor = turnsById.get(anchorTurnId)!;
        const sessionTurnList = turnsBySession.get(anchor.sessionId) ?? [];

        const answerTurn = sessionTurnList.find(
            (t) => t.turnIndex > anchor.turnIndex && t.role === 'assistant',
        );
        if (!answerTurn) {
            anchorsWithoutAnswer++;
            continue;
        }

        // If the retrieval anchored to an agent turn (the student turn had not
        // been persisted yet), the question is the closest preceding student
        // turn; failing that, the retriever's own query stands in for it.
        const precedingStudentTurn = [...sessionTurnList]
            .reverse()
            .find((t) => t.turnIndex < anchor.turnIndex && t.role === 'user');
        const question = anchor.role === 'user' ? anchor.content : precedingStudentTurn?.content ?? query;

        const seen = new Set<string>();
        const contexts = rows
            .slice()
            .sort((a, b) => a.rank - b.rank)
            .filter((row) => {
                if (seen.has(row.segmentId)) return false;
                seen.add(row.segmentId);
                return true;
            })
            .map((row) => ({
                segmentId: row.segmentId,
                content: row.segmentContent,
                rank: row.rank,
                distance: row.distance,
                pageNumber: row.pageNumber,
            }));

        triples.push({
            anchorTurnId,
            sessionId: anchor.sessionId,
            answerTurnId: answerTurn.id,
            question,
            query,
            answer: answerTurn.content,
            contexts,
        });
    }

    triples.sort(
        (a, b) => a.sessionId.localeCompare(b.sessionId) || a.anchorTurnId.localeCompare(b.anchorTurnId),
    );

    return { triples, unanchoredRetrievals, anchorsWithoutAnswer };
}
