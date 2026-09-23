// Dimension 3 of the post-session report: observable communicative behaviour.
//
// READ THIS BEFORE CHANGING ANYTHING HERE.
//
// This dimension is COUNTED, never judged and never scored. Every value below
// is arithmetic over columns already written during the call, so the same
// session always yields the same result and no model opinion enters.
//
// It also carries NO composite score, on purpose. A single number labelled
// "seguridad comunicativa" would be read as a measurement of how the student
// felt, which is exactly the claim rule 1 of docs/propuestas/00 forbids the
// system from making. What the student sees are facts with their numbers
// attached ("tardaste 9 segundos en empezar"), which they can check against the
// transcript. The per-session aggregate is the same facts, summed.
//
// The vocabulary is constrained to match: the words "ansiedad", "nervioso",
// "inseguro" and their relatives must never appear in a sentence produced here,
// and `lib/feedback.test.mts` asserts it over every generated note.

// Relative with an explicit extension, like the rest of the pure modules: this
// file is reachable from `lib/feedback.test.mts`, and `node --test` does not
// resolve the `@/` alias.
import {
    INCOMPLETE_ANSWER_MAX_WORDS,
    LONG_SILENCE_MS,
    isRephraseRequest,
} from '../difficulty/signals.ts';

/**
 * Intra-answer gap at or above which the pause is reported to the student.
 *
 * Measured as the longest gap between consecutive partial transcripts of the
 * same turn (see `hooks/useVapi.ts`), so it is really "silence as the
 * transcriber saw it", not acoustic silence: the STT emits partials in batches,
 * so a short gap can be transcriber cadence rather than the student pausing. 3 s
 * is above that cadence, which is why nothing below it is reported.
 *
 * PROVISIONAL: not yet calibrated against real sessions (the database is empty).
 * To calibrate, run pilot sessions, read the `max_pause_ms` column, and set this
 * above the noise floor of the transcriber actually in use.
 */
export const LONG_PAUSE_MS = 3_000;

export interface ObservationTurn {
    /** End of the agent question -> the student's first word. */
    studentLatencyMs?: number | null;
    /** Longest gap between consecutive partial transcripts inside this turn. */
    maxPauseMs?: number | null;
    /** Epoch ms or Date; only the difference is used. */
    startedAt: Date | number;
    endedAt: Date | number;
    content: string;
}

export interface TurnObservations {
    startLatencyMs: number | null;
    longestPauseMs: number | null;
    answerDurationMs: number;
    wordCount: number;
    askedForRephrasing: boolean;
    /** Shorter than INCOMPLETE_ANSWER_MAX_WORDS and not a request to repeat. */
    isIncomplete: boolean;
    /** Whether the start delay reached LONG_SILENCE_MS. */
    hadLongStartSilence: boolean;
    /** Whether a pause inside the answer reached LONG_PAUSE_MS. */
    hadLongPause: boolean;
    /** Factual sentences, each one traceable to a number above. Spanish, for the UI. */
    notes: string[];
}

function toMs(value: Date | number): number {
    return value instanceof Date ? value.getTime() : value;
}

function isMeasured(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function countWords(content: string): number {
    const trimmed = content.trim();
    return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

/** "9 segundos", "1,4 segundos", "1 segundo" — Spanish prose, decimal comma. */
export function formatSecondsLong(ms: number): string {
    const seconds = ms / 1000;
    if (seconds >= 10) {
        return `${Math.round(seconds)} segundos`;
    }
    const text = seconds.toFixed(1).replace(/\.0$/, '').replace('.', ',');
    return `${text} ${text === '1' ? 'segundo' : 'segundos'}`;
}

/**
 * Observations for one student answer. Pure.
 *
 * `notes` is the only part meant to be shown as prose. It reports what is
 * notable and, when nothing is, says so with the numbers anyway — a student who
 * answered fluently deserves to read the evidence of that, not an empty panel.
 */
export function observeTurn(turn: ObservationTurn): TurnObservations {
    const startLatencyMs = isMeasured(turn.studentLatencyMs) ? turn.studentLatencyMs : null;
    const longestPauseMs = isMeasured(turn.maxPauseMs) ? turn.maxPauseMs : null;
    const answerDurationMs = Math.max(0, toMs(turn.endedAt) - toMs(turn.startedAt));
    const wordCount = countWords(turn.content);
    const askedForRephrasing = isRephraseRequest(turn.content);
    const isIncomplete = !askedForRephrasing && wordCount < INCOMPLETE_ANSWER_MAX_WORDS;
    const hadLongStartSilence = startLatencyMs !== null && startLatencyMs >= LONG_SILENCE_MS;
    const hadLongPause = longestPauseMs !== null && longestPauseMs >= LONG_PAUSE_MS;

    const notes: string[] = [];

    if (startLatencyMs !== null) {
        notes.push(
            hadLongStartSilence
                ? `Tardaste ${formatSecondsLong(startLatencyMs)} en empezar a responder.`
                : `Empezaste a responder en ${formatSecondsLong(startLatencyMs)}.`,
        );
    }

    if (hadLongPause) {
        notes.push(`Hiciste una pausa de ${formatSecondsLong(longestPauseMs as number)} dentro de la respuesta.`);
    } else if (longestPauseMs !== null && startLatencyMs !== null) {
        notes.push('No hiciste pausas largas dentro de la respuesta.');
    }

    if (askedForRephrasing) {
        notes.push('Pediste que se te repitiera o reformulara la pregunta.');
    }

    if (isIncomplete) {
        notes.push(`Tu respuesta tuvo ${wordCount} ${wordCount === 1 ? 'palabra' : 'palabras'}.`);
    }

    if (notes.length === 0) {
        notes.push('No hay tiempos registrados para esta respuesta.');
    }

    return {
        startLatencyMs,
        longestPauseMs,
        answerDurationMs,
        wordCount,
        askedForRephrasing,
        isIncomplete,
        hadLongStartSilence,
        hadLongPause,
        notes,
    };
}

export interface ObservationSummary {
    /** Student answers the summary covers. */
    answers: number;
    meanStartLatencyMs: number | null;
    /** How many answers carried a start-delay measurement. */
    startLatencyN: number;
    longestPauseMs: number | null;
    longStartSilences: number;
    longPauses: number;
    rephraseRequests: number;
    incompleteAnswers: number;
    /** Factual sentences about the session as a whole. */
    notes: string[];
}

export const EMPTY_OBSERVATION_SUMMARY: ObservationSummary = {
    answers: 0,
    meanStartLatencyMs: null,
    startLatencyN: 0,
    longestPauseMs: null,
    longStartSilences: 0,
    longPauses: 0,
    rephraseRequests: 0,
    incompleteAnswers: 0,
    notes: [],
};

/** Session-level roll-up of the same facts. Pure. */
export function summarizeObservations(
    observations: ReadonlyArray<TurnObservations>,
): ObservationSummary {
    if (observations.length === 0) {
        return { ...EMPTY_OBSERVATION_SUMMARY, notes: ['Esta sesión no registró respuestas del estudiante.'] };
    }

    const latencies = observations
        .map((observation) => observation.startLatencyMs)
        .filter((value): value is number => value !== null);
    const pauses = observations
        .map((observation) => observation.longestPauseMs)
        .filter((value): value is number => value !== null);

    const summary: ObservationSummary = {
        answers: observations.length,
        meanStartLatencyMs:
            latencies.length === 0
                ? null
                : Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length),
        startLatencyN: latencies.length,
        longestPauseMs: pauses.length === 0 ? null : Math.max(...pauses),
        longStartSilences: observations.filter((observation) => observation.hadLongStartSilence).length,
        longPauses: observations.filter((observation) => observation.hadLongPause).length,
        rephraseRequests: observations.filter((observation) => observation.askedForRephrasing).length,
        incompleteAnswers: observations.filter((observation) => observation.isIncomplete).length,
        notes: [],
    };

    const notes: string[] = [];

    notes.push(
        summary.meanStartLatencyMs === null
            ? `Respondiste ${summary.answers} ${summary.answers === 1 ? 'vez' : 'veces'}, sin tiempos de inicio registrados.`
            : `Respondiste ${summary.answers} ${summary.answers === 1 ? 'vez' : 'veces'} y empezaste a hablar en ${formatSecondsLong(summary.meanStartLatencyMs)} en promedio.`,
    );

    if (summary.longStartSilences > 0) {
        notes.push(
            `En ${summary.longStartSilences} de ellas tardaste más de ${formatSecondsLong(LONG_SILENCE_MS)} en empezar.`,
        );
    }

    if (summary.longPauses > 0) {
        notes.push(
            `En ${summary.longPauses} hiciste una pausa de más de ${formatSecondsLong(LONG_PAUSE_MS)} a mitad de la respuesta; la más larga fue de ${formatSecondsLong(summary.longestPauseMs as number)}.`,
        );
    }

    if (summary.rephraseRequests > 0) {
        notes.push(
            `Pediste que se te repitiera la pregunta ${summary.rephraseRequests} ${summary.rephraseRequests === 1 ? 'vez' : 'veces'}.`,
        );
    }

    if (summary.incompleteAnswers > 0) {
        notes.push(
            `${summary.incompleteAnswers} ${summary.incompleteAnswers === 1 ? 'respuesta' : 'respuestas'} quedaron en menos de ${INCOMPLETE_ANSWER_MAX_WORDS} palabras.`,
        );
    }

    if (notes.length === 1) {
        notes.push('No hubo silencios largos, pausas largas ni pedidos de reformulación.');
    }

    return { ...summary, notes };
}
