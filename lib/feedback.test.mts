import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildAnswerCases, isJudgeable, type CaseRetrievalRow, type CaseTurnRow } from './feedback/cases.ts';
import {
    evaluateAnswerCase,
    fillTemplate,
    formatContexts,
    MAX_JUSTIFICATION_CHARS,
    normalizeJustification,
    resolveCitation,
    type FeedbackDeps,
} from './feedback/evaluate.ts';
import {
    formatSecondsLong,
    LONG_PAUSE_MS,
    observeTurn,
    summarizeObservations,
    type ObservationTurn,
} from './feedback/observations.ts';
import { buildSessionFeedbackReport, type SessionFeedbackInput } from './feedback/report.ts';
import {
    describeLevel,
    levelToScore,
    normalizeRubricLevel,
    ORDERED_RUBRIC_DIMENSIONS,
    RUBRIC,
    summarizeDimension,
} from './feedback/rubric.ts';
import { LONG_SILENCE_MS } from './difficulty/signals.ts';

// Words the system must never use about the student. Rule 1 of docs/propuestas/00
// and the second acceptance criterion of docs/propuestas/02.
const FORBIDDEN_WORDS = /ansiedad|ansios|nervios|insegur|tranquil|calm|confianza|miedo|temor|estres|estrés/i;

const answer =
    'La muestra fue de ciento veinte estudiantes seleccionados por muestreo probabilistico estratificado por ciclo';

// --- rubric ----------------------------------------------------------------

describe('rubric', () => {
    it('defines two dimensions with four described levels each', () => {
        assert.equal(ORDERED_RUBRIC_DIMENSIONS.length, 2);
        for (const dimension of ORDERED_RUBRIC_DIMENSIONS) {
            assert.equal(dimension.levels.length, 4);
            for (const description of dimension.levels) {
                assert.ok(description.length > 0);
            }
            // Every level description is distinct, or the judge cannot choose.
            assert.equal(new Set(dimension.levels).size, 4);
        }
    });

    it('never names an emotional state in anything the student reads', () => {
        for (const dimension of ORDERED_RUBRIC_DIMENSIONS) {
            const text = `${dimension.title} ${dimension.question} ${dimension.levels.join(' ')}`;
            assert.ok(!FORBIDDEN_WORDS.test(text), `rubric ${dimension.id} names a feeling: ${text}`);
        }
    });

    it('maps levels onto [0, 1] and leaves null as null', () => {
        assert.equal(levelToScore(0), 0);
        assert.equal(levelToScore(3), 1);
        assert.equal(levelToScore(1), 0.3333);
        assert.equal(levelToScore(2), 0.6667);
        assert.equal(levelToScore(null), null);
    });

    it('narrows untrusted levels', () => {
        for (const value of [0, 1, 2, 3]) assert.equal(normalizeRubricLevel(value), value);
        for (const value of [-1, 4, 1.5, '2', null, undefined, NaN, {}]) {
            assert.equal(normalizeRubricLevel(value), null, `should reject ${String(value)}`);
        }
    });

    it('describes a null level as not conclusive, never as the worst level', () => {
        assert.equal(describeLevel('content', null), 'No concluyente');
        assert.notEqual(describeLevel('content', null), RUBRIC.content.levels[0]);
        assert.equal(describeLevel('content', 0), RUBRIC.content.levels[0]);
    });
});

describe('summarizeDimension', () => {
    it('reports nothing when there is nothing measured', () => {
        assert.deepEqual(summarizeDimension([]), {
            meanScore: null,
            meanLevel: null,
            n: 0,
            inconclusive: 0,
        });
    });

    it('counts nulls as inconclusive instead of averaging them as zero', () => {
        const withNulls = summarizeDimension([3, null, 3]);
        assert.equal(withNulls.n, 2);
        assert.equal(withNulls.inconclusive, 1);
        assert.equal(withNulls.meanLevel, 3);
        assert.equal(withNulls.meanScore, 1);

        // Had the nulls been folded in as zeros, the mean would have been 2.
        const asZeros = summarizeDimension([3, 0, 3]);
        assert.equal(asZeros.meanLevel, 2);
        assert.notEqual(withNulls.meanLevel, asZeros.meanLevel);
    });

    it('averages the levels it does have', () => {
        const summary = summarizeDimension([1, 2]);
        assert.equal(summary.meanLevel, 1.5);
        assert.equal(summary.meanScore, 0.5);
        assert.equal(summary.n, 2);
        assert.equal(summary.inconclusive, 0);
    });

    it('reports a dimension where everything was inconclusive as unmeasured', () => {
        const summary = summarizeDimension([null, null]);
        assert.equal(summary.meanScore, null);
        assert.equal(summary.n, 0);
        assert.equal(summary.inconclusive, 2);
    });
});

// --- observations (dimension 3) --------------------------------------------

describe('formatSecondsLong', () => {
    it('writes Spanish prose with a decimal comma', () => {
        assert.equal(formatSecondsLong(9_000), '9 segundos');
        assert.equal(formatSecondsLong(1_000), '1 segundo');
        assert.equal(formatSecondsLong(1_400), '1,4 segundos');
        assert.equal(formatSecondsLong(12_400), '12 segundos');
    });
});

describe('observeTurn', () => {
    const turn = (overrides: Partial<ObservationTurn> = {}): ObservationTurn => ({
        studentLatencyMs: 2_000,
        maxPauseMs: 500,
        startedAt: 1_000,
        endedAt: 9_000,
        content: answer,
        ...overrides,
    });

    it('reports the measured facts of a fluent answer', () => {
        const observed = observeTurn(turn());
        assert.equal(observed.startLatencyMs, 2_000);
        assert.equal(observed.longestPauseMs, 500);
        assert.equal(observed.answerDurationMs, 8_000);
        assert.equal(observed.hadLongStartSilence, false);
        assert.equal(observed.hadLongPause, false);
        assert.equal(observed.isIncomplete, false);
        assert.ok(observed.notes.some((note) => note.includes('2 segundos')));
    });

    it('distinguishes an unmeasured delay from a delay of zero', () => {
        assert.equal(observeTurn(turn({ studentLatencyMs: null })).startLatencyMs, null);
        assert.equal(observeTurn(turn({ studentLatencyMs: undefined })).startLatencyMs, null);
        assert.equal(observeTurn(turn({ studentLatencyMs: 0 })).startLatencyMs, 0);
        assert.equal(observeTurn(turn({ maxPauseMs: null })).longestPauseMs, null);
    });

    it('flags a long start silence at the shared threshold', () => {
        assert.equal(observeTurn(turn({ studentLatencyMs: LONG_SILENCE_MS - 1 })).hadLongStartSilence, false);
        const observed = observeTurn(turn({ studentLatencyMs: LONG_SILENCE_MS }));
        assert.equal(observed.hadLongStartSilence, true);
        assert.ok(observed.notes.some((note) => note.startsWith('Tardaste ')));
    });

    it('flags a long intra-answer pause at its threshold and quotes it', () => {
        assert.equal(observeTurn(turn({ maxPauseMs: LONG_PAUSE_MS - 1 })).hadLongPause, false);
        const observed = observeTurn(turn({ maxPauseMs: 4_000 }));
        assert.equal(observed.hadLongPause, true);
        assert.ok(observed.notes.some((note) => note.includes('pausa de 4 segundos')));
    });

    it('treats a request to repeat as its own fact, not as an incomplete answer', () => {
        const observed = observeTurn(turn({ content: '¿Puede repetir la pregunta?' }));
        assert.equal(observed.askedForRephrasing, true);
        assert.equal(observed.isIncomplete, false);
        assert.ok(observed.notes.some((note) => note.includes('reformulara')));
    });

    it('counts the words of a short answer', () => {
        const observed = observeTurn(turn({ content: 'Ciento veinte estudiantes' }));
        assert.equal(observed.isIncomplete, true);
        assert.equal(observed.wordCount, 3);
        assert.ok(observed.notes.some((note) => note.includes('3 palabras')));
    });

    it('says so plainly when nothing was measured', () => {
        const observed = observeTurn({
            startedAt: 0,
            endedAt: 0,
            content: answer,
            studentLatencyMs: null,
            maxPauseMs: null,
        });
        assert.deepEqual(observed.notes, ['No hay tiempos registrados para esta respuesta.']);
    });

    it('never names an emotional state, whatever the numbers', () => {
        const cases: ObservationTurn[] = [
            turn(),
            turn({ studentLatencyMs: 30_000, maxPauseMs: 20_000 }),
            turn({ content: 'No entendí' }),
            turn({ content: 'Sí' }),
            turn({ studentLatencyMs: null, maxPauseMs: null }),
            turn({ studentLatencyMs: 0, maxPauseMs: 0 }),
        ];
        for (const input of cases) {
            for (const note of observeTurn(input).notes) {
                assert.ok(!FORBIDDEN_WORDS.test(note), `note names a feeling: ${note}`);
            }
        }
    });

    it('is deterministic', () => {
        assert.deepEqual(observeTurn(turn()), observeTurn(turn()));
    });
});

describe('summarizeObservations', () => {
    const observed = (overrides: Partial<ObservationTurn> = {}) =>
        observeTurn({
            studentLatencyMs: 2_000,
            maxPauseMs: 500,
            startedAt: 0,
            endedAt: 5_000,
            content: answer,
            ...overrides,
        });

    it('says the session had no answers when it had none', () => {
        const summary = summarizeObservations([]);
        assert.equal(summary.answers, 0);
        assert.equal(summary.meanStartLatencyMs, null);
        assert.ok(summary.notes[0].includes('no registró respuestas'));
    });

    it('averages only the answers that carry a measurement', () => {
        const summary = summarizeObservations([
            observed({ studentLatencyMs: 1_000 }),
            observed({ studentLatencyMs: 3_000 }),
            observed({ studentLatencyMs: null }),
        ]);
        assert.equal(summary.answers, 3);
        assert.equal(summary.startLatencyN, 2);
        assert.equal(summary.meanStartLatencyMs, 2_000);
    });

    it('counts each kind of event and quotes the longest pause', () => {
        const summary = summarizeObservations([
            observed({ studentLatencyMs: 12_000, maxPauseMs: 6_000 }),
            observed({ studentLatencyMs: 9_000, maxPauseMs: 200 }),
            observed({ content: '¿Me repite la pregunta?' }),
            observed({ content: 'Ciento veinte' }),
        ]);
        assert.equal(summary.longStartSilences, 2);
        assert.equal(summary.longPauses, 1);
        assert.equal(summary.rephraseRequests, 1);
        assert.equal(summary.incompleteAnswers, 1);
        assert.equal(summary.longestPauseMs, 6_000);
        assert.ok(summary.notes.some((note) => note.includes('6 segundos')));
    });

    it('states the absence of events instead of leaving the panel empty', () => {
        const summary = summarizeObservations([observed(), observed()]);
        assert.equal(summary.longStartSilences, 0);
        assert.ok(summary.notes.some((note) => note.includes('No hubo silencios largos')));
    });

    it('never names an emotional state in the session notes', () => {
        const summary = summarizeObservations([
            observed({ studentLatencyMs: 20_000, maxPauseMs: 15_000 }),
            observed({ content: 'No sé' }),
        ]);
        for (const note of summary.notes) {
            assert.ok(!FORBIDDEN_WORDS.test(note), `note names a feeling: ${note}`);
        }
    });
});

// --- cases -----------------------------------------------------------------

describe('buildAnswerCases', () => {
    // A realistic session: opening (no search), answer, question backed by a
    // search anchored to the previous student turn, answer.
    const turns: CaseTurnRow[] = [
        { id: 't0', sessionId: 's1', turnIndex: 0, role: 'assistant', content: 'Exponga su trabajo.' },
        { id: 't1', sessionId: 's1', turnIndex: 1, role: 'user', content: 'Mi tema es la ansiedad al sustentar.' },
        { id: 't2', sessionId: 's1', turnIndex: 2, role: 'assistant', content: '¿Cómo definió su muestra?' },
        { id: 't3', sessionId: 's1', turnIndex: 3, role: 'user', content: answer },
    ];

    // The search for t2 happened while t1 was the newest turn, so it anchors to t1.
    const retrievals: CaseRetrievalRow[] = [
        {
            turnId: 't1',
            query: 'poblacion y muestra',
            rank: 1,
            distance: 0.31,
            segmentId: 'seg-a',
            segmentContent: 'La muestra fue de 120 estudiantes...',
            pageNumber: 34,
        },
        {
            turnId: 't1',
            query: 'poblacion y muestra',
            rank: 2,
            distance: 0.44,
            segmentId: 'seg-b',
            segmentContent: 'El muestreo fue estratificado...',
            pageNumber: 35,
        },
    ];

    it('creates one case per student answer and none for agent turns', () => {
        const { cases } = buildAnswerCases(turns, retrievals);
        assert.equal(cases.length, 2);
        assert.deepEqual(
            cases.map((c) => c.answerTurnId),
            ['t1', 't3'],
        );
    });

    it('pairs each answer with the question that preceded it', () => {
        const { cases } = buildAnswerCases(turns, retrievals);
        assert.equal(cases[0].questionTurnId, 't0');
        assert.equal(cases[1].questionTurnId, 't2');
        assert.equal(cases[1].question, '¿Cómo definió su muestra?');
    });

    it('attaches the fragments the agent retrieved to build that question', () => {
        const { cases } = buildAnswerCases(turns, retrievals);

        // The opening asked nothing of the document, so its answer has no context.
        assert.deepEqual(cases[0].contexts, []);

        // The search anchored to t1 belongs to question t2, hence to answer t3.
        assert.deepEqual(
            cases[1].contexts.map((context) => context.segmentId),
            ['seg-a', 'seg-b'],
        );
        assert.deepEqual(cases[1].queries, ['poblacion y muestra']);
    });

    it('does not attach a search made after the question closed', () => {
        // Anchored to t2 = searched after t2 was persisted, so it belongs to the
        // NEXT question, not to this one.
        const later: CaseRetrievalRow[] = [{ ...retrievals[0], turnId: 't2', segmentId: 'seg-late' }];
        const { cases } = buildAnswerCases(turns, later);
        assert.deepEqual(cases[1].contexts, []);
    });

    it('drops unanchored retrievals instead of guessing where they belong', () => {
        const orphan: CaseRetrievalRow[] = [{ ...retrievals[0], turnId: null }];
        const { cases } = buildAnswerCases(turns, orphan);
        assert.ok(cases.every((c) => c.contexts.length === 0));
    });

    it('dedupes fragments and keeps retriever order', () => {
        const duplicated: CaseRetrievalRow[] = [
            { ...retrievals[1] },
            { ...retrievals[0] },
            { ...retrievals[0], rank: 3 },
        ];
        const { cases } = buildAnswerCases(turns, duplicated);
        assert.deepEqual(
            cases[1].contexts.map((context) => context.segmentId),
            ['seg-a', 'seg-b'],
        );
    });

    it('marks an answer that followed no question as unprompted', () => {
        const unsolicited: CaseTurnRow[] = [
            { id: 'u0', sessionId: 's2', turnIndex: 0, role: 'user', content: 'Hola, ya estoy.' },
        ];
        const { cases, unprompted } = buildAnswerCases(unsolicited, []);
        assert.equal(unprompted, 1);
        assert.equal(cases[0].isUnprompted, true);
        assert.equal(cases[0].question, null);
        assert.equal(isJudgeable(cases[0]), false);
    });

    it('counts answers that had a question but no fragment', () => {
        const { withoutContext } = buildAnswerCases(turns, retrievals);
        assert.equal(withoutContext, 1); // the answer to the opening
    });

    it('keeps sessions apart and orders by turn index', () => {
        const mixed: CaseTurnRow[] = [
            { id: 'b1', sessionId: 's2', turnIndex: 1, role: 'user', content: answer },
            ...turns,
            { id: 'b0', sessionId: 's2', turnIndex: 0, role: 'assistant', content: '¿Y su método?' },
        ];
        const { cases } = buildAnswerCases(mixed, retrievals);
        assert.deepEqual(
            cases.map((c) => `${c.sessionId}:${c.turnIndex}`),
            ['s1:1', 's1:3', 's2:1'],
        );
        assert.equal(cases[2].questionTurnId, 'b0');
    });

    it('treats a case as judgeable only with a question, a fragment and an answer', () => {
        const { cases } = buildAnswerCases(turns, retrievals);
        assert.equal(isJudgeable(cases[0]), false); // no fragment
        assert.equal(isJudgeable(cases[1]), true);
        assert.equal(isJudgeable({ ...cases[1], answer: '   ' }), false);
    });
});

// --- evaluate --------------------------------------------------------------

describe('evaluate helpers', () => {
    it('fills only the placeholders it was given', () => {
        assert.equal(fillTemplate('a {{x}} b {{y}}', { x: '1' }), 'a 1 b {{y}}');
    });

    it('numbers fragments and includes the page when known', () => {
        const text = formatContexts([
            { segmentId: 'a', content: 'uno', rank: 1, distance: 0.1, pageNumber: 34 },
            { segmentId: 'b', content: 'dos', rank: 2, distance: 0.2, pageNumber: null },
        ]);
        assert.ok(text.includes('[0] (página 34) uno'));
        assert.ok(text.includes('[1] dos'));
    });

    it('collapses and caps a justification', () => {
        assert.equal(normalizeJustification('  uno\n  dos  '), 'uno dos');
        assert.equal(normalizeJustification('   '), null);
        assert.equal(normalizeJustification(42), null);

        const long = normalizeJustification('x'.repeat(MAX_JUSTIFICATION_CHARS + 50));
        assert.equal(long?.length, MAX_JUSTIFICATION_CHARS);
        assert.ok(long?.endsWith('…'));
    });

    it('accepts only a citation index the judge was actually shown', () => {
        const contexts = [
            { segmentId: 'seg-a', content: 'uno', rank: 1, distance: 0.1, pageNumber: null },
            { segmentId: 'seg-b', content: 'dos', rank: 2, distance: 0.2, pageNumber: null },
        ];
        assert.equal(resolveCitation(0, contexts), 'seg-a');
        assert.equal(resolveCitation(1, contexts), 'seg-b');
        assert.equal(resolveCitation('1', contexts), 'seg-b');
        // `null` and `false` are the trap: Number() turns both into 0, which
        // would silently cite the first fragment.
        for (const invalid of [-1, 2, 1.5, null, undefined, false, true, '', '  ', 'x', [], {}]) {
            assert.equal(resolveCitation(invalid, contexts), null, `should reject ${String(invalid)}`);
        }
        assert.equal(resolveCitation(0, []), null);
    });
});

describe('evaluateAnswerCase', () => {
    const judgeableCase = {
        answerTurnId: 't3',
        sessionId: 's1',
        turnIndex: 3,
        questionTurnId: 't2',
        question: '¿Cómo definió su muestra?',
        answer,
        contexts: [
            { segmentId: 'seg-a', content: 'La muestra fue de 120...', rank: 1, distance: 0.3, pageNumber: 34 },
            { segmentId: 'seg-b', content: 'El muestreo fue...', rank: 2, distance: 0.4, pageNumber: 35 },
        ],
        queries: ['poblacion y muestra'],
        isUnprompted: false,
    };

    /** Replies to the content prompt with the first response, then to clarity. */
    const scriptedJudge = (responses: unknown[]): FeedbackDeps => {
        let call = 0;
        return { judge: async () => responses[call++] };
    };

    it('stores a level with the fragment the judge cited', async () => {
        const result = await evaluateAnswerCase(
            judgeableCase,
            scriptedJudge([
                { nivel: 3, fragmento: 1, justificacion: 'Coincide con la página 35.' },
                { nivel: 2, justificacion: 'Respondiste lo preguntado pero sin ordenarlo.' },
            ]),
        );

        assert.equal(result.contentLevel, 3);
        assert.equal(result.contentSegmentId, 'seg-b');
        assert.equal(result.contentJustification, 'Coincide con la página 35.');
        assert.equal(result.clarityLevel, 2);
        assert.deepEqual(result.detail.errors, []);
    });

    it('rejects a content level whose citation does not resolve', async () => {
        const result = await evaluateAnswerCase(
            judgeableCase,
            scriptedJudge([
                { nivel: 3, fragmento: 7, justificacion: 'Inventé un fragmento.' },
                { nivel: 2, justificacion: 'Ordenada.' },
            ]),
        );

        // Not a zero: the student is not marked wrong for the judge's failure.
        assert.equal(result.contentLevel, null);
        assert.equal(result.contentSegmentId, null);
        assert.equal(result.contentJustification, null);
        assert.equal(result.detail.citationRejected, true);
        assert.ok(result.detail.errors?.some((e) => e.includes('sin citar')));
        // Clarity is independent and survives.
        assert.equal(result.clarityLevel, 2);
    });

    it('rejects a content level with no citation at all', async () => {
        const result = await evaluateAnswerCase(
            judgeableCase,
            scriptedJudge([{ nivel: 3, justificacion: 'Sin cita.' }, { nivel: 1, justificacion: 'Divagaste.' }]),
        );
        assert.equal(result.contentLevel, null);
        assert.equal(result.detail.citationRejected, true);
    });

    it('accepts the judge declaring content not conclusive', async () => {
        const result = await evaluateAnswerCase(
            judgeableCase,
            scriptedJudge([
                { nivel: null, fragmento: null, justificacion: 'Ningún fragmento permite juzgarlo.' },
                { nivel: 3, justificacion: 'Ordenada.' },
            ]),
        );
        assert.equal(result.contentLevel, null);
        assert.equal(result.detail.citationRejected, undefined);
        assert.ok(result.detail.errors?.some((e) => e.includes('no concluyente')));
    });

    it('never judges content without a fragment, and does not call the judge for it', async () => {
        let contentCalls = 0;
        const result = await evaluateAnswerCase(
            { ...judgeableCase, contexts: [] },
            {
                judge: async (prompt) => {
                    if (prompt.includes('DOMINIO DEL CONTENIDO')) contentCalls++;
                    return { nivel: 2, justificacion: 'Ordenada.' };
                },
            },
        );

        assert.equal(contentCalls, 0);
        assert.equal(result.contentLevel, null);
        assert.ok(result.detail.errors?.some((e) => e.includes('no hubo fragmentos')));
        // Clarity needs no fragment, so it is still judged.
        assert.equal(result.clarityLevel, 2);
    });

    it('judges nothing when the answer followed no question', async () => {
        let calls = 0;
        const result = await evaluateAnswerCase(
            { ...judgeableCase, question: null, questionTurnId: null, isUnprompted: true, contexts: [] },
            {
                judge: async () => {
                    calls++;
                    return { nivel: 3 };
                },
            },
        );

        assert.equal(calls, 0);
        assert.equal(result.contentLevel, null);
        assert.equal(result.clarityLevel, null);
        assert.equal(result.detail.errors?.length, 2);
    });

    it('survives a judge failure on one dimension without losing the other', async () => {
        let call = 0;
        const result = await evaluateAnswerCase(judgeableCase, {
            judge: async () => {
                call++;
                if (call === 1) throw new Error('timeout del juez');
                return { nivel: 3, justificacion: 'Ordenada.' };
            },
        });

        assert.equal(result.contentLevel, null);
        assert.equal(result.clarityLevel, 3);
        assert.ok(result.detail.errors?.some((e) => e.includes('timeout del juez')));
    });

    it('records the fragments it showed the judge, for auditing', async () => {
        const result = await evaluateAnswerCase(
            judgeableCase,
            scriptedJudge([{ nivel: 1, fragmento: 0, justificacion: 'Parcial.' }, { nivel: 1, justificacion: 'x' }]),
        );
        assert.deepEqual(result.detail.contextSegmentIds, ['seg-a', 'seg-b']);
        assert.deepEqual(result.detail.queries, ['poblacion y muestra']);
        assert.equal(result.detail.citedIndex, 0);
    });

    it('forbids the judge from commenting on the student state, in both prompts', async () => {
        const prompts: string[] = [];
        await evaluateAnswerCase(judgeableCase, {
            judge: async (prompt) => {
                prompts.push(prompt);
                return { nivel: 2, fragmento: 0, justificacion: 'x' };
            },
        });

        assert.equal(prompts.length, 2);
        for (const prompt of prompts) {
            assert.ok(
                /No comentes su estado de ánimo/.test(prompt),
                'every judge prompt must forbid commenting on the student state',
            );
        }
        // The content prompt must carry the citation rule and the fragments.
        assert.ok(prompts[0].includes('REGLA OBLIGATORIA DE CITA'));
        assert.ok(prompts[0].includes('[0] (página 34)'));
    });
});

// --- report ----------------------------------------------------------------

describe('buildSessionFeedbackReport', () => {
    const turns: CaseTurnRow[] = [
        { id: 't0', sessionId: 's1', turnIndex: 0, role: 'assistant', content: 'Exponga su trabajo.' },
        { id: 't1', sessionId: 's1', turnIndex: 1, role: 'user', content: 'Mi tema es el rendimiento academico.' },
        { id: 't2', sessionId: 's1', turnIndex: 2, role: 'assistant', content: '¿Cómo definió su muestra?' },
        { id: 't3', sessionId: 's1', turnIndex: 3, role: 'user', content: answer },
    ];
    const retrievals: CaseRetrievalRow[] = [
        {
            turnId: 't1',
            query: 'muestra',
            rank: 1,
            distance: 0.3,
            segmentId: 'seg-a',
            segmentContent: 'La muestra fue de 120 estudiantes.',
            pageNumber: 34,
        },
    ];

    const input = (overrides: Partial<SessionFeedbackInput> = {}): SessionFeedbackInput => ({
        cases: buildAnswerCases(turns, retrievals).cases,
        turns: [
            { id: 't1', startedAt: 0, endedAt: 4_000, content: turns[1].content, studentLatencyMs: 1_500, maxPauseMs: 400 },
            { id: 't3', startedAt: 10_000, endedAt: 20_000, content: answer, studentLatencyMs: 9_000, maxPauseMs: 5_000 },
        ],
        feedback: [
            {
                turnId: 't3',
                contentLevel: 3,
                contentJustification: 'Coincide con la página 34.',
                contentSegmentId: 'seg-a',
                clarityLevel: 2,
                clarityJustification: 'Respondiste sin conectarlo con tus objetivos.',
            },
        ],
        segments: [{ id: 'seg-a', content: 'La muestra fue de 120 estudiantes.', pageNumber: 34 }],
        ...overrides,
    });

    it('keeps the three dimensions separate and produces no overall grade', () => {
        const report = buildSessionFeedbackReport(input());

        assert.ok('content' in report && 'clarity' in report && 'observations' in report);
        // Nothing resembling a single fused score exists on the report.
        for (const key of ['overall', 'total', 'grade', 'nota', 'score']) {
            assert.ok(!(key in report), `report must not expose "${key}"`);
        }
        assert.notEqual(report.content.meanScore, report.clarity.meanScore);
    });

    it('resolves the cited fragment so the student can read it', () => {
        const report = buildSessionFeedbackReport(input());
        const judged = report.turns.find((turn) => turn.answerTurnId === 't3')!;

        assert.equal(judged.content.level, 3);
        assert.equal(judged.content.score, 1);
        assert.equal(judged.content.citedSegment?.pageNumber, 34);
        assert.ok(judged.content.citedSegment?.content.includes('120 estudiantes'));
    });

    it('drops the citation and the justification when the level is null', () => {
        const report = buildSessionFeedbackReport(
            input({
                feedback: [
                    {
                        turnId: 't3',
                        contentLevel: null,
                        contentJustification: 'no debería mostrarse',
                        contentSegmentId: 'seg-a',
                        clarityLevel: 2,
                        clarityJustification: 'ok',
                    },
                ],
            }),
        );
        const judged = report.turns.find((turn) => turn.answerTurnId === 't3')!;

        assert.equal(judged.content.level, null);
        assert.equal(judged.content.score, null);
        assert.equal(judged.content.justification, null);
        assert.equal(judged.content.citedSegment, null);
    });

    it('shows no citation when the cited fragment is gone from the document', () => {
        const report = buildSessionFeedbackReport(input({ segments: [] }));
        const judged = report.turns.find((turn) => turn.answerTurnId === 't3')!;
        assert.equal(judged.content.level, 3);
        assert.equal(judged.content.citedSegment, null);
    });

    it('excludes turns nobody has judged yet from the averages', () => {
        const report = buildSessionFeedbackReport(input());

        // t1 has no stored verdict; only t3 counts.
        assert.equal(report.content.n, 1);
        assert.equal(report.content.inconclusive, 0);
        assert.equal(report.coverage.answers, 2);
        assert.equal(report.coverage.evaluated, 1);
    });

    it('separates pending from structurally unjudgeable answers', () => {
        const report = buildSessionFeedbackReport(input({ feedback: [] }));

        // t1 answered the opening, which retrieved nothing: it can never be judged.
        assert.equal(report.coverage.withoutContext, 1);
        // t3 can be judged and has no verdict yet.
        assert.equal(report.coverage.pending, 1);
        assert.equal(report.coverage.unprompted, 0);
    });

    it('computes dimension 3 for every answer, judged or not', () => {
        const report = buildSessionFeedbackReport(input({ feedback: [] }));

        assert.equal(report.observations.answers, 2);
        assert.equal(report.observations.longStartSilences, 1);
        assert.equal(report.observations.longPauses, 1);
        assert.equal(report.observations.meanStartLatencyMs, 5_250);
        for (const note of report.observations.notes) {
            assert.ok(!FORBIDDEN_WORDS.test(note), `note names a feeling: ${note}`);
        }
    });

    it('reports an answer with no timing row without crashing', () => {
        const report = buildSessionFeedbackReport(input({ turns: [] }));
        assert.equal(report.turns.length, 2);
        assert.equal(report.turns[0].observations.startLatencyMs, null);
    });

    it('is deterministic', () => {
        assert.deepEqual(buildSessionFeedbackReport(input()), buildSessionFeedbackReport(input()));
    });

    it('never names an emotional state anywhere in the report', () => {
        const report = buildSessionFeedbackReport(input());
        const text = JSON.stringify(report.observations) + JSON.stringify(report.turns.map((t) => t.observations));
        assert.ok(!FORBIDDEN_WORDS.test(text), `report names a feeling: ${text}`);
    });
});
