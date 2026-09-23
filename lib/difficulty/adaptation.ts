// The adaptation rule: which level the next session should start at.
//
// DELIBERATELY NOT AN LLM. The thesis has to defend why a student got level 3
// and not level 4, and "the model decided" is not a defensible answer. This is a
// pure function over numbers already in the database: same inputs, same level,
// same justification, forever. It can be recomputed from the stored rows years
// after the session ended.
//
// Two rules constrain the design and come straight from graded exposure:
//   1. The self-report (0-10) leads. The behavioural signals only support it.
//   2. The level moves at most one step per session, in either direction.
//
// The student is never overruled: this returns a SUGGESTION plus the reason it
// will be shown, and the UI lets them pick any level.

import {
    DEFAULT_DIFFICULTY_LEVEL,
    DIFFICULTY_LEVELS,
    type DifficultyLevelId,
    isDifficultyLevelId,
} from './levels.ts';
import { EMPTY_SESSION_SIGNALS, type SessionSignals } from './signals.ts';

/** Self-report scale bounds shown to the student: "del 0 al 10". */
export const ANXIETY_SCALE_MIN = 0;
export const ANXIETY_SCALE_MAX = 10;

/** At or above this self-report, the simulation steps down whatever the performance was. */
export const ANXIETY_HIGH = 8;
/** Above this, the simulation never steps up. */
export const ANXIETY_ELEVATED = 5;
/** At or below this, the simulation may step up without needing a flawless session. */
export const ANXIETY_LOW = 3;

/**
 * A session with fewer student turns than this carries too little evidence to
 * justify raising the difficulty. It can still justify lowering it: a session
 * that ended after two answers is itself a signal, never a reason to push.
 */
export const MIN_TURNS_FOR_EVIDENCE = 3;

/** Mean start-of-answer delay at or above which the session counts as a struggle. */
export const STRUGGLE_MEAN_LATENCY_MS = 6_000;
/** Mean start-of-answer delay below which the session counts as fluent. */
export const FLUENT_MEAN_LATENCY_MS = 3_500;

export interface PreviousSessionSummary {
    /** Level that session actually ran at. */
    level: DifficultyLevelId;
    signals: SessionSignals;
    /** Self-report taken right after that session, if it was answered. */
    postSessionAnxiety: number | null;
}

export interface AdaptationInput {
    /** Self-report taken right before the session about to start. Null if unanswered. */
    preSessionAnxiety: number | null;
    /** The student's most recent finished session with turns, or null for the first one. */
    previous: PreviousSessionSummary | null;
}

export interface AdaptationSuggestion {
    level: DifficultyLevelId;
    /** One sentence, in Spanish, shown to the student. Always traceable to stored evidence. */
    reason: string;
    /** -1, 0 or +1 relative to the previous level. 0 on a first session. */
    step: -1 | 0 | 1;
    /**
     * Machine-readable trace of what drove the decision, so the thesis can report
     * the distribution of reasons instead of parsing Spanish sentences.
     */
    basis: AdaptationBasis;
}

export type AdaptationBasis =
    | 'first-session'
    | 'first-session-low-anxiety'
    | 'high-anxiety'
    | 'elevated-anxiety-with-struggle'
    | 'elevated-anxiety-held'
    | 'insufficient-evidence'
    | 'previous-session-ended-tense'
    | 'struggled-at-level'
    | 'steady-progress'
    | 'low-anxiety-progress'
    | 'held-no-signal';

function clampLevel(value: number): DifficultyLevelId {
    const bounded = Math.min(4, Math.max(1, Math.round(value)));
    return (isDifficultyLevelId(bounded) ? bounded : DEFAULT_DIFFICULTY_LEVEL) as DifficultyLevelId;
}

/** Narrows an untrusted 0-10 self-report. Anything outside the scale becomes null. */
export function normalizeAnxietyScore(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    const rounded = Math.round(value);
    if (rounded < ANXIETY_SCALE_MIN || rounded > ANXIETY_SCALE_MAX) return null;
    return rounded;
}

function formatSeconds(ms: number): string {
    const seconds = ms / 1000;
    // "4,5 s" — Spanish decimal comma, one decimal, no trailing ",0".
    const text = seconds >= 10 ? Math.round(seconds).toString() : seconds.toFixed(1).replace('.', ',');
    return `${text.replace(/,0$/, '')} s`;
}

/** The session gave clear evidence the student was over their head at that level. */
function struggled(signals: SessionSignals): boolean {
    return (
        signals.longSilenceCount >= 2 ||
        signals.incompleteAnswerCount >= 2 ||
        signals.rephraseRequestCount >= 2 ||
        (signals.meanStudentLatencyMs !== null && signals.meanStudentLatencyMs >= STRUGGLE_MEAN_LATENCY_MS)
    );
}

/** The session gave clear evidence the level was comfortable. */
function fluent(signals: SessionSignals): boolean {
    return (
        signals.longSilenceCount === 0 &&
        signals.incompleteAnswerCount <= 1 &&
        signals.rephraseRequestCount === 0 &&
        signals.meanStudentLatencyMs !== null &&
        signals.meanStudentLatencyMs < FLUENT_MEAN_LATENCY_MS
    );
}

/** The single piece of evidence worth quoting back to the student, if any. */
function struggleEvidence(signals: SessionSignals): string | null {
    if (signals.longSilenceCount >= 2) {
        return `en ${signals.longSilenceCount} respuestas tardaste más de 8 segundos en empezar`;
    }
    if (signals.meanStudentLatencyMs !== null && signals.meanStudentLatencyMs >= STRUGGLE_MEAN_LATENCY_MS) {
        return `tardaste en promedio ${formatSeconds(signals.meanStudentLatencyMs)} en empezar a responder`;
    }
    if (signals.incompleteAnswerCount >= 2) {
        return `${signals.incompleteAnswerCount} de tus respuestas quedaron a medias`;
    }
    if (signals.rephraseRequestCount >= 2) {
        return `pediste ${signals.rephraseRequestCount} veces que te reformularan la pregunta`;
    }
    return null;
}

/**
 * Suggests the level of the session about to start.
 *
 * Pure. No database, no clock, no LLM: everything it needs is in `input`.
 */
export function suggestDifficultyLevel(input: AdaptationInput): AdaptationSuggestion {
    const anxiety = normalizeAnxietyScore(input.preSessionAnxiety);
    const previous = input.previous;

    // --- First session: graded exposure starts at the bottom. -----------------
    if (!previous) {
        if (anxiety !== null && anxiety <= ANXIETY_LOW) {
            return {
                level: 2,
                step: 0,
                basis: 'first-session-low-anxiety',
                reason: `Es tu primera sesión con esta investigación y reportaste ${anxiety} de 10 en nerviosismo, así que empezamos en Práctica guiada.`,
            };
        }
        return {
            level: 1,
            step: 0,
            basis: 'first-session',
            reason:
                anxiety === null
                    ? 'Es tu primera sesión con esta investigación, así que empezamos en Ensayo seguro.'
                    : `Es tu primera sesión con esta investigación y reportaste ${anxiety} de 10 en nerviosismo, así que empezamos en Ensayo seguro.`,
        };
    }

    const base = previous.level;
    const signals = previous.signals ?? EMPTY_SESSION_SIGNALS;
    const hadStruggle = struggled(signals);
    const wasFluent = fluent(signals);
    const enoughEvidence = signals.studentTurnCount >= MIN_TURNS_FOR_EVIDENCE;

    const decide = (step: -1 | 0 | 1, basis: AdaptationBasis, reason: string): AdaptationSuggestion => {
        const level = clampLevel(base + step);
        // The reason must describe what actually happens. Clamping at 1 or 4 can
        // turn a step into a hold, and the sentence has to say so.
        const effectiveStep = (level - base) as -1 | 0 | 1;
        if (effectiveStep === 0 && step !== 0) {
            const name = DIFFICULTY_LEVELS[level].name;
            return {
                level,
                step: 0,
                basis,
                reason:
                    step === 1
                        ? `${reason} Ya estás en ${name}, el nivel más exigente, así que te mantenemos aquí.`
                        : `${reason} Ya estás en ${name}, el nivel más contenido, así que te mantenemos aquí.`,
            };
        }
        return { level, step: effectiveStep, basis, reason };
    };

    // --- The self-report leads. -----------------------------------------------
    if (anxiety !== null && anxiety >= ANXIETY_HIGH) {
        return decide(
            -1,
            'high-anxiety',
            `Reportaste ${anxiety} de 10 en nerviosismo, así que bajamos la exigencia de esta sesión.`,
        );
    }

    if (anxiety !== null && anxiety > ANXIETY_ELEVATED) {
        if (hadStruggle) {
            const evidence = struggleEvidence(signals);
            return decide(
                -1,
                'elevated-anxiety-with-struggle',
                `Reportaste ${anxiety} de 10 en nerviosismo y en tu sesión anterior ${evidence}, así que bajamos un nivel.`,
            );
        }
        return decide(
            0,
            'elevated-anxiety-held',
            `Reportaste ${anxiety} de 10 en nerviosismo, así que repetimos el mismo nivel antes de subir.`,
        );
    }

    // --- Performance decides the rest, but never raises without evidence. -----
    if (hadStruggle) {
        const evidence = struggleEvidence(signals);
        return decide(
            -1,
            'struggled-at-level',
            `En tu sesión anterior ${evidence}, así que bajamos un nivel para consolidar.`,
        );
    }

    if (!enoughEvidence) {
        return decide(
            0,
            'insufficient-evidence',
            signals.studentTurnCount === 0
                ? 'Tu sesión anterior no registró respuestas, así que repetimos el mismo nivel.'
                : `Tu sesión anterior solo registró ${signals.studentTurnCount} ${signals.studentTurnCount === 1 ? 'respuesta' : 'respuestas'}, muy poco para subir la exigencia, así que repetimos el mismo nivel.`,
        );
    }

    // The student walked out of the last session tense. Whatever the numbers say
    // about fluency, raising the difficulty on top of that is the opposite of
    // graded exposure: repeat the level first.
    const previousPost = normalizeAnxietyScore(previous.postSessionAnxiety);
    if (previousPost !== null && previousPost >= ANXIETY_HIGH) {
        return decide(
            0,
            'previous-session-ended-tense',
            `Al terminar tu sesión anterior reportaste ${previousPost} de 10 en nerviosismo, así que repetimos el mismo nivel antes de subir.`,
        );
    }

    if (wasFluent) {
        const latency = formatSeconds(signals.meanStudentLatencyMs as number);
        if (anxiety !== null && anxiety <= ANXIETY_LOW) {
            return decide(
                1,
                'low-anxiety-progress',
                `Reportaste ${anxiety} de 10 en nerviosismo y en tu sesión anterior empezaste a responder en ${latency} en promedio, sin silencios largos, así que subimos un nivel.`,
            );
        }
        return decide(
            1,
            'steady-progress',
            `En tu sesión anterior empezaste a responder en ${latency} en promedio, sin silencios largos, así que subimos un nivel.`,
        );
    }

    if (anxiety !== null && anxiety <= ANXIETY_LOW) {
        return decide(
            1,
            'low-anxiety-progress',
            `Reportaste ${anxiety} de 10 en nerviosismo y tu sesión anterior no mostró dificultades, así que subimos un nivel.`,
        );
    }

    return decide(
        0,
        'held-no-signal',
        'Tu sesión anterior no mostró ni dificultades ni holgura clara, así que repetimos el mismo nivel.',
    );
}
