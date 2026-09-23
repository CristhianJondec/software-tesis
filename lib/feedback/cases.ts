/**
 * Assembles the cases the post-session report evaluates: one per STUDENT answer.
 *
 * This is the mirror image of `lib/metrics/triples.ts`. That module scores the
 * AGENT's question against the document (RAGAs). This one scores the STUDENT's
 * answer, so the units are different and must not be confused:
 *
 *   triples.ts  -> answerTurnId is an agent turn   -> ragas_evaluations
 *   cases.ts    -> answerTurnId is a student turn  -> turn_feedback
 *
 * How the three parts are located, and why:
 *
 *  - The ANSWER is the student turn itself.
 *  - The QUESTION is the nearest preceding agent turn. Without one the answer is
 *    unsolicited speech (the student talking over the opening, say) and there is
 *    nothing to judge it against, so the case is reported as unprompted.
 *  - The CONTEXT is the set of segments the agent retrieved to build that
 *    question. `recordTurnRetrievals` attaches each search to the newest turn at
 *    the time of the search (see lib/retrievals.ts), and the search for question
 *    Q happens after the previous turn closed and before Q closes. So the
 *    searches behind Q are exactly the rows anchored to the turn immediately
 *    preceding Q. Anything anchored to Q itself happened after Q was persisted
 *    and belongs to the NEXT question, which is why it is not included here.
 *
 * A case with no context cannot ground a content verdict. It is kept in the
 * output, flagged, and the judge is never run on it: the proposal requires every
 * content judgement to cite a fragment, so an ungrounded one is reported as not
 * conclusive rather than guessed at.
 *
 * Pure module: no database, no network. The caller does the queries.
 */

export interface CaseTurnRow {
    id: string;
    sessionId: string;
    turnIndex: number;
    role: string;
    content: string;
}

export interface CaseRetrievalRow {
    turnId: string | null;
    query: string;
    rank: number;
    distance: number;
    segmentId: string;
    segmentContent: string;
    pageNumber: number | null;
}

export interface CaseContext {
    segmentId: string;
    content: string;
    rank: number;
    distance: number;
    pageNumber: number | null;
}

export interface AnswerCase {
    /** The student turn being evaluated. Feedback rows are stored against this id. */
    answerTurnId: string;
    sessionId: string;
    turnIndex: number;
    /** Agent turn the answer responds to, when there is one. */
    questionTurnId: string | null;
    question: string | null;
    answer: string;
    /** Segments the agent retrieved to build the question, in retriever order. */
    contexts: CaseContext[];
    /** The search strings behind those segments, kept for auditing. */
    queries: string[];
    /** No preceding agent turn: nothing was asked, so nothing is judged. */
    isUnprompted: boolean;
}

export interface CaseBuildResult {
    cases: AnswerCase[];
    /** Student answers with a question but no retrieved context: content stays unjudged. */
    withoutContext: number;
    /** Student answers with no preceding agent question at all. */
    unprompted: number;
}

function dedupeByRank(rows: ReadonlyArray<CaseRetrievalRow>): CaseContext[] {
    const seen = new Set<string>();
    return rows
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
}

export function buildAnswerCases(
    turns: ReadonlyArray<CaseTurnRow>,
    retrievals: ReadonlyArray<CaseRetrievalRow>,
): CaseBuildResult {
    const retrievalsByAnchor = new Map<string, CaseRetrievalRow[]>();
    for (const row of retrievals) {
        if (!row.turnId) continue;
        const list = retrievalsByAnchor.get(row.turnId);
        if (list) list.push(row);
        else retrievalsByAnchor.set(row.turnId, [row]);
    }

    const turnsBySession = new Map<string, CaseTurnRow[]>();
    for (const turn of turns) {
        const list = turnsBySession.get(turn.sessionId);
        if (list) list.push(turn);
        else turnsBySession.set(turn.sessionId, [turn]);
    }
    for (const list of turnsBySession.values()) {
        list.sort((a, b) => a.turnIndex - b.turnIndex);
    }

    const cases: AnswerCase[] = [];
    let withoutContext = 0;
    let unprompted = 0;

    for (const list of turnsBySession.values()) {
        list.forEach((turn, position) => {
            if (turn.role !== 'user') return;

            // Nearest preceding agent turn, and the turn just before it.
            let questionPosition = -1;
            for (let i = position - 1; i >= 0; i--) {
                if (list[i].role === 'assistant') {
                    questionPosition = i;
                    break;
                }
            }

            const questionTurn = questionPosition >= 0 ? list[questionPosition] : null;
            const anchorTurn = questionPosition > 0 ? list[questionPosition - 1] : null;
            const rows = anchorTurn ? (retrievalsByAnchor.get(anchorTurn.id) ?? []) : [];
            const contexts = dedupeByRank(rows);

            if (!questionTurn) unprompted++;
            else if (contexts.length === 0) withoutContext++;

            cases.push({
                answerTurnId: turn.id,
                sessionId: turn.sessionId,
                turnIndex: turn.turnIndex,
                questionTurnId: questionTurn?.id ?? null,
                question: questionTurn?.content ?? null,
                answer: turn.content,
                contexts,
                queries: Array.from(new Set(rows.map((row) => row.query))),
                isUnprompted: !questionTurn,
            });
        });
    }

    cases.sort(
        (a, b) => a.sessionId.localeCompare(b.sessionId) || a.turnIndex - b.turnIndex,
    );

    return { cases, withoutContext, unprompted };
}

/** A case the judge can ground: it has a question and at least one retrieved segment. */
export function isJudgeable(answerCase: AnswerCase): boolean {
    return !answerCase.isUnprompted && answerCase.contexts.length > 0 && answerCase.answer.trim() !== '';
}
