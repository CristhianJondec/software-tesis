// Observable behavioural signals of a finished session.
//
// IMPORTANT — what this file is NOT: this is not anxiety detection. Nothing here
// is a psychological measurement and no text produced from these numbers may
// call them one. They are counts and averages over evidence already stored in
// `session_turns`: how long the student took to start talking, how often the
// silence ran long, how often an answer was a fragment, how often the student
// asked for the question again. The self-report scale (0-10) remains the primary
// input of the adaptation rule; these signals only support it.
//
// Every threshold is exported so the thesis can report the exact criterion used.

/** A start-of-answer delay at or above this counts as a long silence. */
export const LONG_SILENCE_MS = 8_000;

/**
 * A student turn shorter than this many words counts as an incomplete answer.
 * Chosen because a genuine answer to a defense question ("¿cómo validó el
 * instrumento?") does not fit in ten words; below that the turn is an
 * acknowledgement, a hesitation or an abandoned sentence.
 */
export const INCOMPLETE_ANSWER_MAX_WORDS = 10;

/**
 * Spanish phrasings a student uses to ask the jury to say the question again.
 * Matched against the lowercased, accent-stripped turn so "repetir" catches
 * "repetír" and "no entendi" catches "no entendí".
 */
const REPHRASE_PATTERNS: RegExp[] = [
    /\brepit(?:a|e|ir|emelo|amelo)\b/,
    /\bvuelv(?:a|e) a (?:preguntar|decir|formular|plantear)\b/,
    /\breformul(?:e|a|ar)\b/,
    /\bno (?:le )?(?:entendi|comprendi|capt(?:e|o))\b/,
    /\bno (?:me )?qued(?:o|a) clar[ao]\b/,
    /\bpuede (?:usted )?(?:repetir|repetirmelo|volver a)\b/,
    /\bcomo dice\b/,
    /\bperdon,?\s*¿?\s*(?:como|que)\b/,
    /\bde nuevo la pregunta\b/,
    /\bmas clar[ao]\b/,
    /\botra (?:vez|manera|forma)\b/,
];

export interface SignalTurn {
    role: string;
    content: string;
    /** Only present on student turns: end of the agent question -> first word. */
    studentLatencyMs?: number | null;
}

export interface SessionSignals {
    /** Student interventions found in the session. 0 means there is no evidence at all. */
    studentTurnCount: number;
    /** Mean start-of-answer delay in ms, or null when no turn carried a measurement. */
    meanStudentLatencyMs: number | null;
    /** Student turns that started at or after LONG_SILENCE_MS. */
    longSilenceCount: number;
    /** Student turns shorter than INCOMPLETE_ANSWER_MAX_WORDS, excluding rephrase requests. */
    incompleteAnswerCount: number;
    /** Student turns asking the agent to repeat or rephrase the question. */
    rephraseRequestCount: number;
}

export const EMPTY_SESSION_SIGNALS: SessionSignals = {
    studentTurnCount: 0,
    meanStudentLatencyMs: null,
    longSilenceCount: 0,
    incompleteAnswerCount: 0,
    rephraseRequestCount: 0,
};

/** Lowercases and strips the diacritics transcription may or may not produce. */
function normalize(text: string): string {
    // \p{M} is every combining mark, so "í" decomposed by NFD becomes "i".
    return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

export function isRephraseRequest(content: string): boolean {
    const normalized = normalize(content);
    return REPHRASE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function countWords(content: string): number {
    const trimmed = content.trim();
    return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

/**
 * Summarises one session's student turns. Pure: same turns in, same signals out.
 * Agent turns are ignored — every signal here is about the student.
 */
export function summarizeSessionSignals(turns: SignalTurn[]): SessionSignals {
    const studentTurns = turns.filter((turn) => turn.role === 'user');
    if (studentTurns.length === 0) return { ...EMPTY_SESSION_SIGNALS };

    const latencies = studentTurns
        .map((turn) => turn.studentLatencyMs)
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0);

    let longSilenceCount = 0;
    let incompleteAnswerCount = 0;
    let rephraseRequestCount = 0;

    for (const turn of studentTurns) {
        const latency = turn.studentLatencyMs;
        if (typeof latency === 'number' && Number.isFinite(latency) && latency >= LONG_SILENCE_MS) {
            longSilenceCount += 1;
        }

        if (isRephraseRequest(turn.content)) {
            // A request to repeat the question is its own signal, never also an
            // incomplete answer: it is short by nature and counting it twice
            // would inflate the struggle evidence.
            rephraseRequestCount += 1;
            continue;
        }

        if (countWords(turn.content) < INCOMPLETE_ANSWER_MAX_WORDS) {
            incompleteAnswerCount += 1;
        }
    }

    return {
        studentTurnCount: studentTurns.length,
        meanStudentLatencyMs:
            latencies.length === 0
                ? null
                : Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length),
        longSilenceCount,
        incompleteAnswerCount,
        rephraseRequestCount,
    };
}
