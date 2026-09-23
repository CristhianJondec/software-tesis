import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    ANXIETY_SCALE_MAX,
    ANXIETY_SCALE_MIN,
    MIN_TURNS_FOR_EVIDENCE,
    normalizeAnxietyScore,
    suggestDifficultyLevel,
    type AdaptationInput,
    type PreviousSessionSummary,
} from './difficulty/adaptation.ts';
import {
    DEFAULT_DIFFICULTY_LEVEL,
    DIFFICULTY_LEVEL_IDS,
    DIFFICULTY_LEVELS,
    getDifficultyLevel,
    isDifficultyLevelId,
    ORDERED_DIFFICULTY_LEVELS,
} from './difficulty/levels.ts';
import {
    INCOMPLETE_ANSWER_MAX_WORDS,
    isRephraseRequest,
    LONG_SILENCE_MS,
    summarizeSessionSignals,
    type SessionSignals,
    type SignalTurn,
} from './difficulty/signals.ts';

// --- helpers ---------------------------------------------------------------

const signals = (overrides: Partial<SessionSignals> = {}): SessionSignals => ({
    studentTurnCount: 6,
    meanStudentLatencyMs: 4_000,
    longSilenceCount: 0,
    incompleteAnswerCount: 0,
    rephraseRequestCount: 0,
    ...overrides,
});

const previous = (overrides: Partial<PreviousSessionSummary> = {}): PreviousSessionSummary => ({
    level: 2,
    signals: signals(),
    postSessionAnxiety: null,
    ...overrides,
});

const suggest = (input: Partial<AdaptationInput> = {}) =>
    suggestDifficultyLevel({ preSessionAnxiety: null, previous: null, ...input });

/** A student answer long enough not to count as incomplete. */
const longAnswer = 'La muestra fue de ciento veinte estudiantes seleccionados por muestreo probabilistico estratificado por ciclo academico';

// --- levels ----------------------------------------------------------------

describe('DIFFICULTY_LEVELS', () => {
    it('defines exactly the four levels the thesis reports', () => {
        assert.deepEqual([...DIFFICULTY_LEVEL_IDS], [1, 2, 3, 4]);
        assert.equal(ORDERED_DIFFICULTY_LEVELS.length, 4);
        ORDERED_DIFFICULTY_LEVELS.forEach((level, i) => assert.equal(level.id, i + 1));
    });

    it('escalates pressure monotonically across levels', () => {
        const limits = ORDERED_DIFFICULTY_LEVELS.map((l) => l.answerTimeLimitSeconds);
        // Levels 1-2 have no time pressure; 3 and 4 do, and 4 is the tighter one.
        assert.deepEqual(limits.slice(0, 2), [null, null]);
        assert.ok((limits[2] as number) > (limits[3] as number));

        const questions = ORDERED_DIFFICULTY_LEVELS.map((l) => l.targetQuestions);
        questions.forEach((count, i) => {
            if (i > 0) assert.ok(count > questions[i - 1], `level ${i + 1} must ask more questions`);
        });

        // Only the hardest level refuses to rephrase.
        assert.deepEqual(
            ORDERED_DIFFICULTY_LEVELS.map((l) => l.allowsRephrasing),
            [true, true, true, false],
        );
    });

    it('gives every level its own prompt directives and opening line', () => {
        const directives = new Set(ORDERED_DIFFICULTY_LEVELS.map((l) => l.promptDirectives));
        assert.equal(directives.size, 4);

        const openings = new Set(ORDERED_DIFFICULTY_LEVELS.map((l) => l.buildFirstMessage('Mi tesis')));
        assert.equal(openings.size, 4);
        for (const opening of openings) assert.ok(opening.includes('Mi tesis'));
    });

    it('never says the system detects anxiety', () => {
        // Regla transversal de docs/propuestas/00: el agente no comenta el estado
        // emocional del estudiante ni el sistema afirma detectarlo.
        for (const level of ORDERED_DIFFICULTY_LEVELS) {
            const text = `${level.name} ${level.tagline} ${level.tone} ${level.promptDirectives}`.toLowerCase();
            assert.ok(!text.includes('detect'), `level ${level.id} claims detection`);
            assert.ok(!/\bansiedad\b/.test(text), `level ${level.id} names anxiety`);
        }
    });

    it('falls back to the safest level for unknown input', () => {
        assert.equal(getDifficultyLevel(9).id, DEFAULT_DIFFICULTY_LEVEL);
        assert.equal(getDifficultyLevel(null).id, DEFAULT_DIFFICULTY_LEVEL);
        assert.equal(getDifficultyLevel('3').id, DEFAULT_DIFFICULTY_LEVEL);
        assert.equal(getDifficultyLevel(3).id, 3);

        assert.ok(isDifficultyLevelId(1));
        assert.ok(!isDifficultyLevelId(0));
        assert.ok(!isDifficultyLevelId(5));
    });
});

// --- signals ---------------------------------------------------------------

describe('summarizeSessionSignals', () => {
    it('returns empty signals when the session has no student turns', () => {
        assert.deepEqual(summarizeSessionSignals([]), {
            studentTurnCount: 0,
            meanStudentLatencyMs: null,
            longSilenceCount: 0,
            incompleteAnswerCount: 0,
            rephraseRequestCount: 0,
        });

        const agentOnly: SignalTurn[] = [{ role: 'assistant', content: '¿Cómo validó el instrumento?' }];
        assert.equal(summarizeSessionSignals(agentOnly).studentTurnCount, 0);
    });

    it('ignores agent turns in every count', () => {
        const turns: SignalTurn[] = [
            { role: 'assistant', content: 'Sí.', studentLatencyMs: 99_000 },
            { role: 'user', content: longAnswer, studentLatencyMs: 2_000 },
        ];
        const result = summarizeSessionSignals(turns);
        assert.equal(result.studentTurnCount, 1);
        assert.equal(result.meanStudentLatencyMs, 2_000);
        assert.equal(result.longSilenceCount, 0);
    });

    it('averages only the turns that carry a measurement', () => {
        const turns: SignalTurn[] = [
            { role: 'user', content: longAnswer, studentLatencyMs: 1_000 },
            { role: 'user', content: longAnswer, studentLatencyMs: 3_000 },
            { role: 'user', content: longAnswer, studentLatencyMs: null },
            { role: 'user', content: longAnswer },
        ];
        const result = summarizeSessionSignals(turns);
        assert.equal(result.studentTurnCount, 4);
        assert.equal(result.meanStudentLatencyMs, 2_000);
    });

    it('leaves the mean null when no turn was measured', () => {
        const turns: SignalTurn[] = [{ role: 'user', content: longAnswer, studentLatencyMs: null }];
        assert.equal(summarizeSessionSignals(turns).meanStudentLatencyMs, null);
    });

    it('counts a long silence at the threshold, not above it', () => {
        const turns: SignalTurn[] = [
            { role: 'user', content: longAnswer, studentLatencyMs: LONG_SILENCE_MS - 1 },
            { role: 'user', content: longAnswer, studentLatencyMs: LONG_SILENCE_MS },
            { role: 'user', content: longAnswer, studentLatencyMs: LONG_SILENCE_MS + 5_000 },
        ];
        assert.equal(summarizeSessionSignals(turns).longSilenceCount, 2);
    });

    it('counts short answers as incomplete and long ones as complete', () => {
        const short = Array.from({ length: INCOMPLETE_ANSWER_MAX_WORDS - 1 }, (_, i) => `p${i}`).join(' ');
        const atThreshold = Array.from({ length: INCOMPLETE_ANSWER_MAX_WORDS }, (_, i) => `p${i}`).join(' ');
        const turns: SignalTurn[] = [
            { role: 'user', content: short },
            { role: 'user', content: atThreshold },
            { role: 'user', content: longAnswer },
        ];
        assert.equal(summarizeSessionSignals(turns).incompleteAnswerCount, 1);
    });

    it('counts a rephrase request as a request, never also as an incomplete answer', () => {
        const turns: SignalTurn[] = [{ role: 'user', content: '¿Puede repetir la pregunta?' }];
        const result = summarizeSessionSignals(turns);
        assert.equal(result.rephraseRequestCount, 1);
        assert.equal(result.incompleteAnswerCount, 0);
    });

    it('recognises the common Spanish rephrasings, with or without accents', () => {
        for (const phrase of [
            '¿Puede repetir la pregunta?',
            'Repítamelo por favor',
            'No entendí la pregunta',
            'No entendi la pregunta',
            'Perdón, ¿cómo?',
            '¿Me lo puede decir más claro?',
            '¿Puede reformular?',
            'Vuelva a preguntar por favor',
            'No me queda claro lo que me pregunta',
            '¿Me lo plantea de otra manera?',
        ]) {
            assert.ok(isRephraseRequest(phrase), `should detect: ${phrase}`);
        }
    });

    it('does not mistake a real answer for a rephrase request', () => {
        for (const phrase of [
            longAnswer,
            'El instrumento se validó por juicio de tres expertos y un alfa de Cronbach de cero punto ochenta y siete',
            'Mi objetivo general es determinar la relación entre ambas variables',
        ]) {
            assert.ok(!isRephraseRequest(phrase), `should not detect: ${phrase}`);
        }
    });
});

// --- adaptation ------------------------------------------------------------

describe('normalizeAnxietyScore', () => {
    it('accepts the whole 0-10 scale', () => {
        for (let i = ANXIETY_SCALE_MIN; i <= ANXIETY_SCALE_MAX; i++) {
            assert.equal(normalizeAnxietyScore(i), i);
        }
    });

    it('rejects anything off the scale', () => {
        for (const value of [-1, 11, 10.6, NaN, Infinity, null, undefined, '5', {}]) {
            assert.equal(normalizeAnxietyScore(value), null, `should reject ${String(value)}`);
        }
        // 10.4 rounds back onto the scale; 10.6 does not.
        assert.equal(normalizeAnxietyScore(10.4), 10);
    });
});

describe('suggestDifficultyLevel — first session', () => {
    it('starts at Ensayo seguro when nothing is known', () => {
        const result = suggest();
        assert.equal(result.level, 1);
        assert.equal(result.basis, 'first-session');
        assert.equal(result.step, 0);
    });

    it('starts at Ensayo seguro for any self-report above the low band', () => {
        for (const anxiety of [4, 5, 6, 7, 8, 9, 10]) {
            const result = suggest({ preSessionAnxiety: anxiety });
            assert.equal(result.level, 1, `anxiety ${anxiety} must start at level 1`);
            assert.ok(result.reason.includes(`${anxiety} de 10`));
        }
    });

    it('starts one step higher only when the student reports low nerves', () => {
        for (const anxiety of [0, 1, 2, 3]) {
            const result = suggest({ preSessionAnxiety: anxiety });
            assert.equal(result.level, 2, `anxiety ${anxiety} must start at level 2`);
            assert.equal(result.basis, 'first-session-low-anxiety');
        }
    });

    it('never starts a first session above Práctica guiada', () => {
        for (let anxiety = 0; anxiety <= 10; anxiety++) {
            assert.ok(suggest({ preSessionAnxiety: anxiety }).level <= 2);
        }
    });
});

describe('suggestDifficultyLevel — self-report leads', () => {
    it('steps down on a high self-report even after a flawless session', () => {
        const result = suggest({
            preSessionAnxiety: 8,
            previous: previous({ level: 3, signals: signals({ meanStudentLatencyMs: 1_200 }) }),
        });
        assert.equal(result.level, 2);
        assert.equal(result.step, -1);
        assert.equal(result.basis, 'high-anxiety');
    });

    it('holds at an elevated self-report when the last session went fine', () => {
        const result = suggest({
            preSessionAnxiety: 6,
            previous: previous({ level: 3, signals: signals({ meanStudentLatencyMs: 1_200 }) }),
        });
        assert.equal(result.level, 3);
        assert.equal(result.step, 0);
        assert.equal(result.basis, 'elevated-anxiety-held');
    });

    it('steps down at an elevated self-report when the last session showed struggle', () => {
        const result = suggest({
            preSessionAnxiety: 6,
            previous: previous({ level: 3, signals: signals({ longSilenceCount: 2 }) }),
        });
        assert.equal(result.level, 2);
        assert.equal(result.basis, 'elevated-anxiety-with-struggle');
        assert.ok(result.reason.includes('6 de 10'));
    });

    it('does not step up from an elevated self-report, however good the session', () => {
        for (const anxiety of [6, 7]) {
            const result = suggest({
                preSessionAnxiety: anxiety,
                previous: previous({ level: 2, signals: signals({ meanStudentLatencyMs: 900 }) }),
            });
            assert.ok(result.step <= 0, `anxiety ${anxiety} must not step up`);
        }
    });
});

describe('suggestDifficultyLevel — performance signals', () => {
    it('steps down after long silences', () => {
        const result = suggest({
            preSessionAnxiety: 4,
            previous: previous({ level: 3, signals: signals({ longSilenceCount: 3 }) }),
        });
        assert.equal(result.level, 2);
        assert.equal(result.basis, 'struggled-at-level');
        assert.ok(result.reason.includes('3 respuestas'));
        assert.ok(result.reason.includes('8 segundos'));
    });

    it('steps down on a slow mean start and quotes it in seconds', () => {
        const result = suggest({
            preSessionAnxiety: 2,
            previous: previous({ level: 3, signals: signals({ meanStudentLatencyMs: 7_500 }) }),
        });
        assert.equal(result.level, 2);
        assert.ok(result.reason.includes('7,5 s'));
    });

    it('steps down after repeated incomplete answers or rephrase requests', () => {
        const incomplete = suggest({
            previous: previous({ level: 3, signals: signals({ incompleteAnswerCount: 2 }) }),
        });
        assert.equal(incomplete.level, 2);
        assert.ok(incomplete.reason.includes('a medias'));

        const rephrases = suggest({
            previous: previous({ level: 3, signals: signals({ rephraseRequestCount: 3 }) }),
        });
        assert.equal(rephrases.level, 2);
        assert.ok(rephrases.reason.includes('3 veces'));
    });

    it('steps up after a fluent session', () => {
        const result = suggest({
            preSessionAnxiety: 4,
            previous: previous({ level: 2, signals: signals({ meanStudentLatencyMs: 2_000 }) }),
        });
        assert.equal(result.level, 3);
        assert.equal(result.step, 1);
        assert.equal(result.basis, 'steady-progress');
        assert.ok(result.reason.includes('2 s'));
    });

    it('steps up on low nerves even without a flawless session', () => {
        const result = suggest({
            preSessionAnxiety: 1,
            previous: previous({ level: 2, signals: signals({ meanStudentLatencyMs: 5_000, incompleteAnswerCount: 1 }) }),
        });
        assert.equal(result.level, 3);
        assert.equal(result.basis, 'low-anxiety-progress');
    });

    it('holds when the session was neither hard nor easy', () => {
        const result = suggest({
            preSessionAnxiety: 4,
            previous: previous({ level: 2, signals: signals({ meanStudentLatencyMs: 5_000 }) }),
        });
        assert.equal(result.level, 2);
        assert.equal(result.step, 0);
        assert.equal(result.basis, 'held-no-signal');
    });

    it('refuses to step up on too few turns, whatever the latency', () => {
        const result = suggest({
            preSessionAnxiety: 1,
            previous: previous({
                level: 2,
                signals: signals({ studentTurnCount: MIN_TURNS_FOR_EVIDENCE - 1, meanStudentLatencyMs: 800 }),
            }),
        });
        assert.equal(result.level, 2);
        assert.equal(result.basis, 'insufficient-evidence');
        assert.ok(result.reason.includes('2 respuestas'));
    });

    it('reports an empty previous session in its own words', () => {
        const result = suggest({
            previous: previous({ level: 2, signals: signals({ studentTurnCount: 0, meanStudentLatencyMs: null }) }),
        });
        assert.equal(result.basis, 'insufficient-evidence');
        assert.ok(result.reason.includes('no registró respuestas'));
    });

    it('still steps down on too few turns when the session showed struggle', () => {
        const result = suggest({
            previous: previous({
                level: 3,
                signals: signals({ studentTurnCount: 2, longSilenceCount: 2, meanStudentLatencyMs: 9_000 }),
            }),
        });
        assert.equal(result.level, 2);
        assert.equal(result.basis, 'struggled-at-level');
    });

    it('holds instead of stepping up when the last session ended tense', () => {
        const result = suggest({
            preSessionAnxiety: 2,
            previous: previous({
                level: 2,
                signals: signals({ meanStudentLatencyMs: 1_500 }),
                postSessionAnxiety: 9,
            }),
        });
        assert.equal(result.level, 2);
        assert.equal(result.step, 0);
        assert.equal(result.basis, 'previous-session-ended-tense');
        assert.ok(result.reason.includes('9 de 10'));
    });

    it('still steps up when the last session ended calm', () => {
        const result = suggest({
            preSessionAnxiety: 2,
            previous: previous({
                level: 2,
                signals: signals({ meanStudentLatencyMs: 1_500 }),
                postSessionAnxiety: 3,
            }),
        });
        assert.equal(result.level, 3);
        assert.equal(result.step, 1);
    });

    it('lets a struggle outrank a calm closing self-report', () => {
        const result = suggest({
            previous: previous({
                level: 3,
                signals: signals({ longSilenceCount: 4 }),
                postSessionAnxiety: 0,
            }),
        });
        assert.equal(result.level, 2);
        assert.equal(result.basis, 'struggled-at-level');
    });

    it('holds when the previous session carries no latency measurement at all', () => {
        const result = suggest({
            preSessionAnxiety: 4,
            previous: previous({ level: 2, signals: signals({ meanStudentLatencyMs: null }) }),
        });
        assert.equal(result.level, 2);
        assert.equal(result.basis, 'held-no-signal');
    });
});

describe('suggestDifficultyLevel — invariants', () => {
    const allSignals: SessionSignals[] = [
        signals(),
        signals({ meanStudentLatencyMs: 800 }),
        signals({ meanStudentLatencyMs: null }),
        signals({ meanStudentLatencyMs: 12_000, longSilenceCount: 4 }),
        signals({ incompleteAnswerCount: 3 }),
        signals({ rephraseRequestCount: 4 }),
        signals({ studentTurnCount: 0, meanStudentLatencyMs: null }),
        signals({ studentTurnCount: 1, meanStudentLatencyMs: 500 }),
    ];
    const anxieties: Array<number | null> = [null, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    const everyCase = (visit: (result: ReturnType<typeof suggestDifficultyLevel>, base: number) => void) => {
        for (const level of DIFFICULTY_LEVEL_IDS) {
            for (const signal of allSignals) {
                for (const preSessionAnxiety of anxieties) {
                    visit(
                        suggestDifficultyLevel({
                            preSessionAnxiety,
                            previous: { level, signals: signal, postSessionAnxiety: null },
                        }),
                        level,
                    );
                }
            }
        }
    };

    it('always returns a valid level', () => {
        everyCase((result) => assert.ok(isDifficultyLevelId(result.level)));
    });

    it('never moves more than one level per session', () => {
        everyCase((result, base) => assert.ok(Math.abs(result.level - base) <= 1));
    });

    it('keeps step consistent with the level it returned', () => {
        everyCase((result, base) => assert.equal(result.step, result.level - base));
    });

    it('always explains itself in one non-empty Spanish sentence', () => {
        everyCase((result) => {
            assert.ok(result.reason.length > 0);
            assert.ok(result.reason.trim().endsWith('.'), `reason must end in a period: ${result.reason}`);
            assert.ok(!/\bansiedad\b/i.test(result.reason), `reason must not name anxiety: ${result.reason}`);
        });
    });

    it('says it is holding when the level cannot move any further', () => {
        const atFloor = suggestDifficultyLevel({
            preSessionAnxiety: 10,
            previous: { level: 1, signals: signals(), postSessionAnxiety: null },
        });
        assert.equal(atFloor.level, 1);
        assert.equal(atFloor.step, 0);
        assert.ok(atFloor.reason.includes('te mantenemos aquí'));
        assert.ok(atFloor.reason.includes(DIFFICULTY_LEVELS[1].name));

        const atCeiling = suggestDifficultyLevel({
            preSessionAnxiety: 0,
            previous: { level: 4, signals: signals({ meanStudentLatencyMs: 900 }), postSessionAnxiety: null },
        });
        assert.equal(atCeiling.level, 4);
        assert.equal(atCeiling.step, 0);
        assert.ok(atCeiling.reason.includes('te mantenemos aquí'));
        assert.ok(atCeiling.reason.includes(DIFFICULTY_LEVELS[4].name));
    });

    it('is deterministic', () => {
        const input: AdaptationInput = {
            preSessionAnxiety: 6,
            previous: previous({ level: 3, signals: signals({ longSilenceCount: 2 }) }),
        };
        assert.deepEqual(suggestDifficultyLevel(input), suggestDifficultyLevel(input));
    });
});
