/**
 * Evidence of progress shown when a session closes (docs/propuestas/05).
 *
 * READ THIS BEFORE CHANGING ANYTHING HERE.
 *
 * 1. NO MODEL WRITES THESE SENTENCES, and no sentence here may exist without a
 *    number or a recorded fact inside it. The proposal forbids "¡Excelente
 *    trabajo!", "vas muy bien" and "se nota tu esfuerzo" by name: praise with no
 *    datum does not build confidence and it contaminates the measurement. Every
 *    string below is arithmetic over rows already stored, so the same session
 *    always yields the same list and the student can check each line against the
 *    transcript.
 *
 * 2. AN IMPROVEMENT IS NEVER FABRICATED. A comparison is emitted only when the
 *    SAME measurement exists on both sides, each over enough answers to mean
 *    something, and the difference clears the margin below. When there is no
 *    improvement the list falls back to absolute achievements of this session —
 *    it never stretches a flat number into a rising one.
 *
 * 3. A REGRESSION IS SAID, NOT HIDDEN. `setback` carries the one measurement
 *    that got worse, with its number, and offers a lower level. "No maquillar
 *    resultados malos" is an explicit requirement of the proposal.
 *
 * 4. THE VOCABULARY IS CONSTRAINED, like `lib/feedback/observations.ts`: the
 *    words "ansiedad", "nervioso", "inseguro", "miedo" and their relatives must
 *    never appear in a sentence produced here. This file reports what the
 *    student DID, never how they felt.
 *
 * Pure module: no database, no judge, no network.
 */

import { FLUENT_MEAN_LATENCY_MS } from '../difficulty/adaptation.ts';
import type { DifficultyLevelId } from '../difficulty/levels.ts';
import { LONG_SILENCE_MS } from '../difficulty/signals.ts';
import { formatSecondsLong } from '../feedback/observations.ts';
import { PREPARATION_TOPICS, type PreparationTopicId } from '../preparation/topics.ts';
import { rate, type ProgressSessionSummary } from './summary.ts';

/**
 * Pins the selection rules that produced a spoken closing, stored alongside it
 * in `session_closings`. Bump it whenever a detector or a margin changes, so a
 * closing read months later is still readable as the product of its own rules.
 */
export const EVIDENCE_GENERATOR_VERSION = 'progress-evidence-1';

/**
 * Achievements shown per session. The proposal caps it at four: a list longer
 * than that reads as a wall of congratulation and stops being evidence.
 */
export const MAX_EVIDENCE_PER_SESSION = 4;

/** Achievements the agent reads out loud before saying goodbye. */
export const SPOKEN_EVIDENCE_COUNT = 2;

// ---------------------------------------------------------------------------
// Margins
//
// PROVISIONAL: not yet calibrated against real sessions (the database is empty).
// They exist so transcriber noise and a single lucky answer cannot be reported
// as progress. To calibrate, run the pilot sessions and look at the spread of
// each measurement between consecutive sessions of the same student.
// ---------------------------------------------------------------------------

/** Start-delay drop, in ms, below which the change is noise and is not reported. */
export const LATENCY_IMPROVEMENT_MIN_MS = 500;
/** Rise in a 0-3 rubric mean below which the change is not reported. */
export const LEVEL_IMPROVEMENT_MIN = 0.25;
/** Change in a proportion below which it is not reported. */
export const RATE_IMPROVEMENT_MIN = 0.1;
/** Conclusive answers each side of a mean needs before the means are compared. */
export const MIN_COMPARABLE_ANSWERS = 2;
/** Questions each side needs before proportions over questions are compared. */
export const MIN_COMPARABLE_QUESTIONS = 3;

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------

export type EvidenceKind = 'improvement' | 'achievement';

/**
 * Machine-readable name of what was detected. The thesis counts closings by
 * these instead of parsing Spanish.
 */
export type EvidenceBasis =
    // improvements, compared against the previous session
    | 'latency-improved'
    | 'content-improved'
    | 'clarity-improved'
    | 'answer-rate-improved'
    | 'fewer-long-silences'
    | 'fewer-incomplete-answers'
    | 'fewer-rephrase-requests'
    | 'new-topics-practiced'
    | 'higher-level-sustained'
    // absolute achievements of this session
    | 'correct-answers-by-topic'
    | 'grounded-answers'
    | 'structured-answers'
    | 'answered-every-question'
    | 'no-long-silences'
    | 'fast-start'
    | 'no-rephrase-requests'
    | 'topics-practiced'
    | 'answers-given';

export interface ProgressEvidence {
    /** Unique within a list: the basis, plus the topic when there is one. */
    id: string;
    kind: EvidenceKind;
    basis: EvidenceBasis;
    /** The full sentence the student reads or hears. Always carries its number. */
    text: string;
    /** The number alone, for the badge next to the sentence. */
    datum: string;
}

export type SetbackBasis =
    | 'latency-worse'
    | 'content-worse'
    | 'clarity-worse'
    | 'answer-rate-worse';

export interface ProgressSetback {
    basis: SetbackBasis;
    /** The measurement that got worse, with both numbers. Never softened. */
    text: string;
    /**
     * Level to offer for the next session. Null when the session already ran at
     * level 1: there is nothing lower to step down to, and offering one anyway
     * would be an empty gesture.
     */
    suggestedLevel: DifficultyLevelId | null;
}

export interface ProgressEvidenceResult {
    /** At most `MAX_EVIDENCE_PER_SESSION`, improvements first. */
    evidence: ProgressEvidence[];
    /** Everything detected, before the cap. Useful for the thesis, not for the UI. */
    allEvidence: ProgressEvidence[];
    /** The worst comparable regression, or null when there was none. */
    setback: ProgressSetback | null;
    /** Id of the session every comparison was made against. Null on a first session. */
    comparedSessionId: string | null;
    /** True when a previous session existed but nothing improved beyond the margin. */
    hasComparison: boolean;
}

export interface ProgressEvidenceInput {
    /** The session that just closed. */
    current: ProgressSessionSummary;
    /**
     * Every earlier session of the same student and document, oldest first. The
     * last one is what comparisons run against; the whole list decides which
     * topics count as newly practised.
     */
    earlier: ReadonlyArray<ProgressSessionSummary>;
}

// ---------------------------------------------------------------------------
// Spanish formatting
// ---------------------------------------------------------------------------

function questions(count: number): string {
    return count === 1 ? '1 pregunta' : `${count} preguntas`;
}

function answers(count: number): string {
    return count === 1 ? '1 respuesta' : `${count} respuestas`;
}

/** "2", "2,5", "2,33" — decimal comma, no trailing zeros. */
function formatLevel(value: number): string {
    return value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',');
}

function formatPercent(value: number): string {
    return `${Math.round(value * 100)} %`;
}

/** "Metodología", "Metodología y Muestra", "A, B y C". */
function joinNames(names: ReadonlyArray<string>): string {
    if (names.length === 0) return '';
    if (names.length === 1) return names[0];
    return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

// ---------------------------------------------------------------------------
// Comparability
// ---------------------------------------------------------------------------

function isMeasured(value: number | null): value is number {
    return value !== null && Number.isFinite(value);
}

/**
 * A rate is only compared when both sessions asked enough questions for the
 * proportion to mean something. Two questions against eight would otherwise
 * report a swing of fifty points as progress.
 */
function comparableRates(
    current: ProgressSessionSummary,
    previous: ProgressSessionSummary,
): boolean {
    return (
        current.questionsAsked >= MIN_COMPARABLE_QUESTIONS &&
        previous.questionsAsked >= MIN_COMPARABLE_QUESTIONS
    );
}

// ---------------------------------------------------------------------------
// Improvements
// ---------------------------------------------------------------------------

type Detector = (
    current: ProgressSessionSummary,
    previous: ProgressSessionSummary,
) => ProgressEvidence | null;

/**
 * The flagship comparison of the proposal: "Empezaste a responder en 4 s
 * promedio; en la sesión anterior fueron 9 s."
 */
const latencyImproved: Detector = (current, previous) => {
    const now = current.signals.meanStudentLatencyMs;
    const before = previous.signals.meanStudentLatencyMs;
    if (!isMeasured(now) || !isMeasured(before)) return null;
    if (
        current.signals.studentTurnCount < MIN_COMPARABLE_ANSWERS ||
        previous.signals.studentTurnCount < MIN_COMPARABLE_ANSWERS
    ) {
        return null;
    }
    if (before - now < LATENCY_IMPROVEMENT_MIN_MS) return null;

    return {
        id: 'latency-improved',
        kind: 'improvement',
        basis: 'latency-improved',
        text: `Empezaste a responder en ${formatSecondsLong(now)} en promedio; en la sesión anterior fueron ${formatSecondsLong(before)}.`,
        datum: formatSecondsLong(now),
    };
};

function levelImproved(
    id: 'content-improved' | 'clarity-improved',
    label: string,
    now: number | null,
    nowN: number,
    before: number | null,
    beforeN: number,
): ProgressEvidence | null {
    if (!isMeasured(now) || !isMeasured(before)) return null;
    if (nowN < MIN_COMPARABLE_ANSWERS || beforeN < MIN_COMPARABLE_ANSWERS) return null;
    if (now - before < LEVEL_IMPROVEMENT_MIN) return null;

    return {
        id,
        kind: 'improvement',
        basis: id,
        text: `${label} subió de ${formatLevel(before)} a ${formatLevel(now)} sobre 3, sobre ${answers(nowN)} evaluadas.`,
        datum: `${formatLevel(now)} de 3`,
    };
}

const contentImproved: Detector = (current, previous) =>
    levelImproved(
        'content-improved',
        'Tu dominio del contenido',
        current.contentMeanLevel,
        current.contentN,
        previous.contentMeanLevel,
        previous.contentN,
    );

const clarityImproved: Detector = (current, previous) =>
    levelImproved(
        'clarity-improved',
        'Tu claridad y estructura',
        current.clarityMeanLevel,
        current.clarityN,
        previous.clarityMeanLevel,
        previous.clarityN,
    );

const answerRateImproved: Detector = (current, previous) => {
    if (!comparableRates(current, previous)) return null;
    const now = rate(current.questionsAnswered, current.questionsAsked);
    const before = rate(previous.questionsAnswered, previous.questionsAsked);
    if (!isMeasured(now) || !isMeasured(before)) return null;
    if (now - before < RATE_IMPROVEMENT_MIN) return null;

    return {
        id: 'answer-rate-improved',
        kind: 'improvement',
        basis: 'answer-rate-improved',
        text: `Respondiste ${current.questionsAnswered} de ${questions(current.questionsAsked)} (${formatPercent(now)}); en la sesión anterior fueron ${previous.questionsAnswered} de ${previous.questionsAsked} (${formatPercent(before)}).`,
        datum: `${current.questionsAnswered}/${current.questionsAsked}`,
    };
};

/** Counted over student turns, which is the denominator these signals live on. */
function signalDropped(
    id: 'fewer-long-silences' | 'fewer-incomplete-answers' | 'fewer-rephrase-requests',
    text: (nowCount: number, beforeCount: number) => string,
    nowCount: number,
    beforeCount: number,
    current: ProgressSessionSummary,
    previous: ProgressSessionSummary,
): ProgressEvidence | null {
    const nowTurns = current.signals.studentTurnCount;
    const beforeTurns = previous.signals.studentTurnCount;
    if (nowTurns < MIN_COMPARABLE_QUESTIONS || beforeTurns < MIN_COMPARABLE_QUESTIONS) return null;

    const now = rate(nowCount, nowTurns);
    const before = rate(beforeCount, beforeTurns);
    if (!isMeasured(now) || !isMeasured(before)) return null;
    if (before - now < RATE_IMPROVEMENT_MIN) return null;

    return {
        id,
        kind: 'improvement',
        basis: id,
        text: text(nowCount, beforeCount),
        datum: `${nowCount} de ${nowTurns}`,
    };
}

const fewerLongSilences: Detector = (current, previous) =>
    signalDropped(
        'fewer-long-silences',
        (now, before) =>
            `Tardaste más de ${formatSecondsLong(LONG_SILENCE_MS)} en empezar en ${now} de tus ${current.signals.studentTurnCount} respuestas; en la sesión anterior fueron ${before} de ${previous.signals.studentTurnCount}.`,
        current.signals.longSilenceCount,
        previous.signals.longSilenceCount,
        current,
        previous,
    );

const fewerIncompleteAnswers: Detector = (current, previous) =>
    signalDropped(
        'fewer-incomplete-answers',
        (now, before) =>
            `${now} de tus ${current.signals.studentTurnCount} respuestas quedaron en pocas palabras; en la sesión anterior fueron ${before} de ${previous.signals.studentTurnCount}.`,
        current.signals.incompleteAnswerCount,
        previous.signals.incompleteAnswerCount,
        current,
        previous,
    );

const fewerRephraseRequests: Detector = (current, previous) =>
    signalDropped(
        'fewer-rephrase-requests',
        (now, before) =>
            `Pediste que se te reformulara la pregunta ${now} ${now === 1 ? 'vez' : 'veces'}; en la sesión anterior fueron ${before}.`,
        current.signals.rephraseRequestCount,
        previous.signals.rephraseRequestCount,
        current,
        previous,
    );

/**
 * Ran the simulation one step harder than last time and still answered every
 * question. The level is never named to the student during the call, but the
 * closing report is after it, and the step is a row in `voice_sessions`.
 */
const higherLevelSustained: Detector = (current, previous) => {
    if (current.difficultyLevel <= previous.difficultyLevel) return null;
    if (current.questionsAsked === 0 || current.questionsAnswered < current.questionsAsked) {
        return null;
    }

    return {
        id: 'higher-level-sustained',
        kind: 'improvement',
        basis: 'higher-level-sustained',
        text: `Sustentaste en el nivel ${current.difficultyLevel} de exigencia, uno más alto que el ${previous.difficultyLevel} de la sesión anterior, y respondiste las ${questions(current.questionsAsked)}.`,
        datum: `Nivel ${current.difficultyLevel}`,
    };
};

/** Detector order is the priority order: the first ones win the four slots. */
const IMPROVEMENT_DETECTORS: Detector[] = [
    latencyImproved,
    contentImproved,
    clarityImproved,
    answerRateImproved,
    fewerLongSilences,
    fewerIncompleteAnswers,
    fewerRephraseRequests,
    higherLevelSustained,
];

/**
 * Topics asked about in this session that no earlier session had ever asked
 * about. Compared against the WHOLE history, not only the previous session, so
 * the sentence is true in the form the proposal writes it: "Practicaste 2 temas
 * que la semana pasada estaban sin practicar."
 */
function newTopicsPracticed(input: ProgressEvidenceInput): ProgressEvidence | null {
    if (input.earlier.length === 0) return null;

    const seen = new Set<PreparationTopicId>();
    for (const session of input.earlier) {
        for (const topic of session.topicsPracticed) seen.add(topic);
    }

    const fresh = input.current.topicsPracticed.filter((topic) => !seen.has(topic));
    if (fresh.length === 0) return null;

    const names = fresh.map((topic) => PREPARATION_TOPICS[topic].name);

    return {
        id: 'new-topics-practiced',
        kind: 'improvement',
        basis: 'new-topics-practiced',
        text:
            fresh.length === 1
                ? `Practicaste por primera vez un tema que no habías practicado antes: ${names[0]}.`
                : `Practicaste por primera vez ${fresh.length} temas que no habías practicado antes: ${joinNames(names)}.`,
        datum: `${fresh.length} ${fresh.length === 1 ? 'tema nuevo' : 'temas nuevos'}`,
    };
}

// ---------------------------------------------------------------------------
// Absolute achievements
// ---------------------------------------------------------------------------

/**
 * "Respondiste correctamente 3 preguntas de metodología."
 *
 * At most two topics: the four slots are shared with everything else, and a list
 * of twelve topic lines would bury the comparisons.
 */
function correctAnswersByTopic(current: ProgressSessionSummary): ProgressEvidence[] {
    return current.topics
        .filter((topic) => topic.correct > 0)
        .slice()
        .sort((a, b) => b.correct - a.correct || a.name.localeCompare(b.name, 'es'))
        .slice(0, 2)
        .map((topic) => ({
            id: `correct-answers-by-topic:${topic.topicId}`,
            kind: 'achievement' as const,
            basis: 'correct-answers-by-topic' as const,
            text: `Respondiste correctamente ${questions(topic.correct)} de ${topic.name.toLowerCase()}.`,
            datum: `${topic.correct} de ${topic.asked}`,
        }));
}

function achievementsOf(current: ProgressSessionSummary): ProgressEvidence[] {
    const found: ProgressEvidence[] = [...correctAnswersByTopic(current)];

    if (current.citedAnswers > 0) {
        found.push({
            id: 'grounded-answers',
            kind: 'achievement',
            basis: 'grounded-answers',
            text: `${answers(current.citedAnswers)} tuyas quedaron ancladas a un fragmento de tu propio documento.`,
            datum: `${current.citedAnswers}`,
        });
    }

    if (current.structuredAnswers > 0) {
        found.push({
            id: 'structured-answers',
            kind: 'achievement',
            basis: 'structured-answers',
            text: `Conectaste ${answers(current.structuredAnswers)} con tus objetivos o tu metodología.`,
            datum: `${current.structuredAnswers}`,
        });
    }

    if (current.questionsAsked >= 2 && current.questionsAnswered === current.questionsAsked) {
        found.push({
            id: 'answered-every-question',
            kind: 'achievement',
            basis: 'answered-every-question',
            text: `Respondiste las ${questions(current.questionsAsked)} que te hizo el jurado.`,
            datum: `${current.questionsAsked}/${current.questionsAsked}`,
        });
    }

    if (
        current.signals.studentTurnCount >= MIN_COMPARABLE_ANSWERS &&
        current.signals.meanStudentLatencyMs !== null &&
        current.signals.longSilenceCount === 0
    ) {
        found.push({
            id: 'no-long-silences',
            kind: 'achievement',
            basis: 'no-long-silences',
            text: `Ninguna de tus ${current.signals.studentTurnCount} respuestas tardó más de ${formatSecondsLong(LONG_SILENCE_MS)} en empezar.`,
            datum: `0 de ${current.signals.studentTurnCount}`,
        });
    }

    if (
        current.signals.meanStudentLatencyMs !== null &&
        current.signals.meanStudentLatencyMs < FLUENT_MEAN_LATENCY_MS
    ) {
        found.push({
            id: 'fast-start',
            kind: 'achievement',
            basis: 'fast-start',
            text: `Empezaste a responder en ${formatSecondsLong(current.signals.meanStudentLatencyMs)} en promedio.`,
            datum: formatSecondsLong(current.signals.meanStudentLatencyMs),
        });
    }

    if (current.questionsAsked >= MIN_COMPARABLE_QUESTIONS && current.signals.rephraseRequestCount === 0) {
        found.push({
            id: 'no-rephrase-requests',
            kind: 'achievement',
            basis: 'no-rephrase-requests',
            text: `Respondiste las ${questions(current.questionsAsked)} sin pedir que se te reformulara ninguna.`,
            datum: '0 reformulaciones',
        });
    }

    if (current.topicsPracticed.length >= 2) {
        const names = current.topicsPracticed.map((topic) => PREPARATION_TOPICS[topic].name);
        found.push({
            id: 'topics-practiced',
            kind: 'achievement',
            basis: 'topics-practiced',
            text: `Practicaste ${current.topicsPracticed.length} temas de tu sustentación: ${joinNames(names)}.`,
            datum: `${current.topicsPracticed.length} temas`,
        });
    }

    // Last resort, so a student who spoke at all never reads an empty panel. It
    // is still a recorded number, not encouragement.
    if (current.questionsAnswered > 0) {
        found.push({
            id: 'answers-given',
            kind: 'achievement',
            basis: 'answers-given',
            text: `Sostuviste la sustentación y respondiste ${questions(current.questionsAnswered)}.`,
            datum: `${current.questionsAnswered}`,
        });
    }

    return found;
}

// ---------------------------------------------------------------------------
// Regressions
// ---------------------------------------------------------------------------

/**
 * The one measurement that got worse, with both numbers.
 *
 * Only the worst is reported: a list of everything that slipped is a different
 * screen (the post-session report already has it turn by turn), and the point
 * here is to be honest without turning the closing into an indictment.
 */
function findSetback(
    current: ProgressSessionSummary,
    previous: ProgressSessionSummary,
): ProgressSetback | null {
    const suggestedLevel =
        current.difficultyLevel > 1 ? ((current.difficultyLevel - 1) as DifficultyLevelId) : null;

    const now = current.signals.meanStudentLatencyMs;
    const before = previous.signals.meanStudentLatencyMs;
    if (
        isMeasured(now) &&
        isMeasured(before) &&
        current.signals.studentTurnCount >= MIN_COMPARABLE_ANSWERS &&
        previous.signals.studentTurnCount >= MIN_COMPARABLE_ANSWERS &&
        now - before >= LATENCY_IMPROVEMENT_MIN_MS
    ) {
        return {
            basis: 'latency-worse',
            text: `Esta vez tardaste ${formatSecondsLong(now)} en promedio en empezar a responder; en la sesión anterior fueron ${formatSecondsLong(before)}.`,
            suggestedLevel,
        };
    }

    if (
        isMeasured(current.contentMeanLevel) &&
        isMeasured(previous.contentMeanLevel) &&
        current.contentN >= MIN_COMPARABLE_ANSWERS &&
        previous.contentN >= MIN_COMPARABLE_ANSWERS &&
        previous.contentMeanLevel - current.contentMeanLevel >= LEVEL_IMPROVEMENT_MIN
    ) {
        return {
            basis: 'content-worse',
            text: `Tu dominio del contenido quedó en ${formatLevel(current.contentMeanLevel)} sobre 3; en la sesión anterior fue ${formatLevel(previous.contentMeanLevel)}.`,
            suggestedLevel,
        };
    }

    if (
        isMeasured(current.clarityMeanLevel) &&
        isMeasured(previous.clarityMeanLevel) &&
        current.clarityN >= MIN_COMPARABLE_ANSWERS &&
        previous.clarityN >= MIN_COMPARABLE_ANSWERS &&
        previous.clarityMeanLevel - current.clarityMeanLevel >= LEVEL_IMPROVEMENT_MIN
    ) {
        return {
            basis: 'clarity-worse',
            text: `Tu claridad y estructura quedó en ${formatLevel(current.clarityMeanLevel)} sobre 3; en la sesión anterior fue ${formatLevel(previous.clarityMeanLevel)}.`,
            suggestedLevel,
        };
    }

    if (comparableRates(current, previous)) {
        const nowRate = rate(current.questionsAnswered, current.questionsAsked);
        const beforeRate = rate(previous.questionsAnswered, previous.questionsAsked);
        if (
            isMeasured(nowRate) &&
            isMeasured(beforeRate) &&
            beforeRate - nowRate >= RATE_IMPROVEMENT_MIN
        ) {
            return {
                basis: 'answer-rate-worse',
                text: `Respondiste ${current.questionsAnswered} de ${questions(current.questionsAsked)}; en la sesión anterior fueron ${previous.questionsAnswered} de ${previous.questionsAsked}.`,
                suggestedLevel,
            };
        }
    }

    return null;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * The achievements of one session, improvements first.
 *
 * `earlier` may be empty: a first session has nothing to compare against and
 * gets absolute achievements only, which is the rule of the proposal and not a
 * degraded mode.
 */
export function buildProgressEvidence(input: ProgressEvidenceInput): ProgressEvidenceResult {
    const { current } = input;
    const previous = input.earlier.at(-1) ?? null;

    const improvements: ProgressEvidence[] = [];

    if (previous) {
        for (const detect of IMPROVEMENT_DETECTORS) {
            const found = detect(current, previous);
            if (found) improvements.push(found);
        }
    }

    // Compared against the whole history rather than the previous session, so it
    // is placed after the session-to-session comparisons but is still one.
    const fresh = newTopicsPracticed(input);
    if (fresh) improvements.push(fresh);

    const allEvidence = [...improvements, ...achievementsOf(current)];

    return {
        evidence: allEvidence.slice(0, MAX_EVIDENCE_PER_SESSION),
        allEvidence,
        setback: previous ? findSetback(current, previous) : null,
        comparedSessionId: previous?.sessionId ?? null,
        hasComparison: previous !== null,
    };
}
