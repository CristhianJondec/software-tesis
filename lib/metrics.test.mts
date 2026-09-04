import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ARCHITECTURE_COMPONENTS, computeIca } from './metrics/architecture.ts';
import { isoOrEmpty, toCsv } from './metrics/csv.ts';
import {
    THOUSANDS_SEPARATOR,
    formatDeltaMs,
    formatMs,
    formatNumber,
    formatPercent,
    formatScore,
} from './metrics/format.ts';
import {
    numberSessionsByParticipant,
    studentLatencyTrend,
    summarizeByParticipantSession,
    summarizeLatency,
} from './metrics/latency.ts';
import { computePrecision } from './metrics/precision.ts';
import {
    aggregateRagas,
    alignVerdicts,
    averagePrecisionAtK,
    computeRagasForTriple,
    cosineSimilarity,
    fillTemplate,
    meanSimilarity,
    numberList,
    ratioScore,
} from './metrics/ragas.ts';
import { buildRagasTriples } from './metrics/triples.ts';

// ============================================================================
// ICA
// ============================================================================

describe('computeIca', () => {
    it('reports 100% when the five declared components are integrated', () => {
        const result = computeIca();
        assert.equal(result.total, 5);
        assert.equal(result.integrated, 5);
        assert.equal(result.percentage, 100);
        assert.deepEqual(result.missing, []);
    });

    it('drops with the registry instead of being written by hand', () => {
        const degraded = ARCHITECTURE_COMPONENTS.map((component) =>
            component.id === 'retriever' ? { ...component, integrated: false } : component,
        );
        const result = computeIca(degraded);
        assert.equal(result.percentage, 80);
        assert.deepEqual(result.missing, ['retriever']);
    });

    it('gives every component a verifiable evidence path', () => {
        for (const component of ARCHITECTURE_COMPONENTS) {
            assert.ok(component.evidence.length > 0, `${component.id} sin evidencia`);
        }
    });
});

// ============================================================================
// LP and student latency
// ============================================================================

describe('summarizeLatency', () => {
    it('reports n = 0 and nulls rather than a zero average', () => {
        const summary = summarizeLatency([]);
        assert.equal(summary.n, 0);
        assert.equal(summary.meanMs, null);
        assert.equal(summary.medianMs, null);
    });

    it('ignores nulls and impossible negative measurements', () => {
        const summary = summarizeLatency([100, null, undefined, -50, 300]);
        assert.equal(summary.n, 2);
        assert.equal(summary.meanMs, 200);
    });

    it('computes the median for an odd and an even count', () => {
        assert.equal(summarizeLatency([300, 100, 200]).medianMs, 200);
        assert.equal(summarizeLatency([100, 200, 300, 500]).medianMs, 250);
    });

    it('uses a nearest-rank p95, never an interpolated value', () => {
        const values = Array.from({ length: 20 }, (_, i) => (i + 1) * 100);
        const summary = summarizeLatency(values);
        assert.equal(summary.minMs, 100);
        assert.equal(summary.maxMs, 2000);
        assert.equal(summary.p95Ms, 1900);
        assert.ok(values.includes(summary.p95Ms!));
    });
});

describe('numberSessionsByParticipant', () => {
    it('numbers each participant chronologically starting at 1', () => {
        const numbers = numberSessionsByParticipant([
            { sessionId: 's2', userId: 'u1', startedAt: 2000 },
            { sessionId: 's1', userId: 'u1', startedAt: 1000 },
            { sessionId: 's3', userId: 'u2', startedAt: 500 },
        ]);
        assert.equal(numbers.get('s1'), 1);
        assert.equal(numbers.get('s2'), 2);
        assert.equal(numbers.get('s3'), 1);
    });

    it('is deterministic when two sessions share a timestamp', () => {
        const input = [
            { sessionId: 'b', userId: 'u1', startedAt: 1000 },
            { sessionId: 'a', userId: 'u1', startedAt: 1000 },
        ];
        assert.deepEqual(
            [...numberSessionsByParticipant(input).entries()].sort(),
            [...numberSessionsByParticipant([...input].reverse()).entries()].sort(),
        );
    });
});

describe('summarizeByParticipantSession', () => {
    const samples = [
        { sessionId: 's1', userId: 'u1', participantCode: 'P01', studyGroup: 'experimental', latencyMs: 1000 },
        { sessionId: 's1', userId: 'u1', participantCode: 'P01', studyGroup: 'experimental', latencyMs: 2000 },
        { sessionId: 's2', userId: 'u1', participantCode: 'P01', studyGroup: 'experimental', latencyMs: 600 },
    ];
    const numbers = new Map([
        ['s1', 1],
        ['s2', 2],
    ]);

    it('summarizes each session separately and orders by session number', () => {
        const rows = summarizeByParticipantSession(samples, numbers);
        assert.equal(rows.length, 2);
        assert.equal(rows[0].sessionNumber, 1);
        assert.equal(rows[0].summary.meanMs, 1500);
        assert.equal(rows[1].summary.meanMs, 600);
    });

    it('exposes the drop between the first and the last session', () => {
        const rows = summarizeByParticipantSession(samples, numbers);
        const [trend] = studentLatencyTrend(rows, samples);
        assert.equal(trend.participantCode, 'P01');
        assert.equal(trend.sessions, 2);
        assert.equal(trend.firstSessionMeanMs, 1500);
        assert.equal(trend.lastSessionMeanMs, 600);
        assert.equal(trend.deltaMs, -900);
        assert.equal(trend.overall.n, 3);
    });

    it('reports no delta for a participant with a single session', () => {
        const single = samples.filter((s) => s.sessionId === 's1');
        const rows = summarizeByParticipantSession(single, numbers);
        assert.equal(studentLatencyTrend(rows, single)[0].deltaMs, null);
    });
});

// ============================================================================
// PR
// ============================================================================

describe('computePrecision', () => {
    it('leaves PR undefined while nobody has reviewed anything', () => {
        const result = computePrecision({ totalAgentTurns: 12, reviewed: 0, correct: 0 });
        assert.equal(result.percentage, null);
        assert.equal(result.pending, 12);
    });

    it('divides by the reviewed turns, not by every turn', () => {
        const result = computePrecision({ totalAgentTurns: 20, reviewed: 8, correct: 6 });
        assert.equal(result.percentage, 75);
        assert.equal(result.incorrect, 2);
        assert.equal(result.pending, 12);
        assert.equal(result.coveragePercentage, 40);
    });

    it('never lets the counts exceed their denominator', () => {
        const result = computePrecision({ totalAgentTurns: 5, reviewed: 9, correct: 9 });
        assert.equal(result.reviewed, 5);
        assert.equal(result.correct, 5);
        assert.equal(result.pending, 0);
    });
});

// ============================================================================
// Triples
// ============================================================================

const turn = (id: string, turnIndex: number, role: string, content: string, sessionId = 'ses1') => ({
    id,
    sessionId,
    turnIndex,
    role,
    content,
});

const retrieval = (
    turnId: string | null,
    rank: number,
    segmentId: string,
    query = '¿objetivos?',
) => ({
    turnId,
    sessionId: 'ses1',
    query,
    rank,
    distance: 0.1 * rank,
    segmentId,
    segmentContent: `contenido de ${segmentId}`,
    pageNumber: rank,
});

describe('buildRagasTriples', () => {
    const turns = [
        turn('t0', 0, 'assistant', 'Buenas tardes, expóngame su avance.'),
        turn('t1', 1, 'user', '¿Cuáles son mis objetivos específicos?'),
        turn('t2', 2, 'assistant', 'Su documento plantea tres objetivos.'),
    ];

    it('pairs the student question with the agent reply that follows it', () => {
        const { triples } = buildRagasTriples(turns, [retrieval('t1', 1, 'seg1'), retrieval('t1', 2, 'seg2')]);

        assert.equal(triples.length, 1);
        assert.equal(triples[0].anchorTurnId, 't1');
        assert.equal(triples[0].answerTurnId, 't2');
        assert.equal(triples[0].question, '¿Cuáles son mis objetivos específicos?');
        assert.equal(triples[0].answer, 'Su documento plantea tres objetivos.');
        assert.deepEqual(triples[0].contexts.map((c) => c.segmentId), ['seg1', 'seg2']);
    });

    it('keeps one triple per search when a turn triggers two queries', () => {
        const { triples } = buildRagasTriples(turns, [
            retrieval('t1', 1, 'seg1', '¿objetivos?'),
            retrieval('t1', 1, 'seg3', '¿metodología?'),
        ]);
        assert.equal(triples.length, 2);
    });

    it('counts retrievals that never anchored to a turn instead of guessing', () => {
        const result = buildRagasTriples(turns, [retrieval(null, 1, 'seg1'), retrieval('borrado', 1, 'seg2')]);
        assert.equal(result.unanchoredRetrievals, 2);
        assert.equal(result.triples.length, 0);
    });

    it('skips a search the agent never answered, and says how many', () => {
        const cutShort = [turn('t0', 0, 'assistant', 'Hola'), turn('t1', 1, 'user', '¿Y la muestra?')];
        const result = buildRagasTriples(cutShort, [retrieval('t1', 1, 'seg1')]);
        assert.equal(result.triples.length, 0);
        assert.equal(result.anchorsWithoutAnswer, 1);
    });

    it('falls back to the previous student turn when the retrieval anchored to an agent turn', () => {
        const { triples } = buildRagasTriples(turns, [retrieval('t0', 1, 'seg1')]);
        assert.equal(triples.length, 1);
        // t0 has no preceding student turn, so the retriever query stands in.
        assert.equal(triples[0].question, '¿objetivos?');
        assert.equal(triples[0].answerTurnId, 't2');
    });

    it('does not count the same segment twice within one search', () => {
        const { triples } = buildRagasTriples(turns, [retrieval('t1', 1, 'seg1'), retrieval('t1', 2, 'seg1')]);
        assert.equal(triples[0].contexts.length, 1);
    });
});

// ============================================================================
// RAGAs scoring
// ============================================================================

describe('RAGAs pure helpers', () => {
    it('fills only the placeholders it was given', () => {
        assert.equal(fillTemplate('a {{x}} b {{y}}', { x: '1' }), 'a 1 b {{y}}');
    });

    it('numbers a list the way the prompts expect', () => {
        assert.equal(numberList(['uno', 'dos']), '[0] uno\n[1] dos');
    });

    it('places verdicts by their declared index, not by array position', () => {
        const aligned = alignVerdicts(3, [
            { indice: 2, value: true },
            { indice: 0, value: true },
        ]);
        assert.deepEqual(aligned, [true, false, true]);
    });

    it('treats a claim the judge said nothing about as unsupported', () => {
        assert.deepEqual(alignVerdicts(2, []), [false, false]);
    });

    it('computes a ratio, or null when there is nothing to score', () => {
        assert.equal(ratioScore([true, true, false, false]), 0.5);
        assert.equal(ratioScore([]), null);
    });

    it('weights average precision by rank', () => {
        // Relevant at ranks 1 and 3: (1/1 + 2/3) / 2
        assert.equal(averagePrecisionAtK([true, false, true]), 0.8333);
        // The same two relevant chunks ranked first score higher.
        assert.equal(averagePrecisionAtK([true, true, false]), 1);
        assert.equal(averagePrecisionAtK([false, false]), 0);
        assert.equal(averagePrecisionAtK([]), null);
    });

    it('clamps a negative mean similarity to zero', () => {
        assert.equal(meanSimilarity([-0.4, -0.2]), 0);
        assert.equal(meanSimilarity([1, 0.5]), 0.75);
        assert.equal(meanSimilarity([]), null);
    });

    it('computes cosine similarity and refuses mismatched vectors', () => {
        assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
        assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
        assert.equal(cosineSimilarity([1, 0], [1, 0, 0]), 0);
        assert.equal(cosineSimilarity([0, 0], [1, 0]), 0);
    });

    it('averages only the triples where a metric was computable', () => {
        const summary = aggregateRagas([
            { faithfulness: 1, answerRelevancy: 0.5, contextPrecision: null, contextRecall: 0 },
            { faithfulness: 0, answerRelevancy: null, contextPrecision: null, contextRecall: 1 },
        ]);
        assert.deepEqual(summary.faithfulness, { mean: 0.5, n: 2 });
        assert.deepEqual(summary.answerRelevancy, { mean: 0.5, n: 1 });
        assert.deepEqual(summary.contextPrecision, { mean: null, n: 0 });
        assert.deepEqual(summary.contextRecall, { mean: 0.5, n: 2 });
    });
});

describe('computeRagasForTriple', () => {
    const triple = {
        anchorTurnId: 't1',
        sessionId: 'ses1',
        answerTurnId: 't2',
        question: '¿Cuál es su muestra?',
        query: 'muestra',
        answer: 'Su muestra son 30 estudiantes de la UNT.',
        contexts: [
            { segmentId: 'seg1', content: 'La muestra fue de 30 estudiantes.', rank: 1, distance: 0.2, pageNumber: 12 },
            { segmentId: 'seg2', content: 'Antecedentes internacionales.', rank: 2, distance: 0.5, pageNumber: 4 },
        ],
    };

    // Answers each prompt by recognising the instruction it opens with, so the
    // test exercises the real control flow without touching the network.
    const stubJudge = (overrides: Record<string, unknown> = {}) => async (prompt: string) => {
        if (prompt.includes('afirmaciones atómicas')) {
            return overrides.claims ?? { afirmaciones: ['La muestra son 30 estudiantes.', 'Son de la UNT.'] };
        }
        if (prompt.includes('puede deducirse del CONTEXTO')) {
            return (
                overrides.claimVerdicts ?? {
                    veredictos: [
                        { indice: 0, respaldada: true },
                        { indice: 1, respaldada: false },
                    ],
                }
            );
        }
        if (prompt.includes('preguntas distintas')) {
            return overrides.questions ?? { preguntas: ['¿Cuál es la muestra?'], evasiva: false };
        }
        if (prompt.includes('aportó información útil')) {
            return (
                overrides.contextVerdicts ?? {
                    veredictos: [
                        { indice: 0, util: true },
                        { indice: 1, util: false },
                    ],
                }
            );
        }
        if (prompt.includes('requisitos de información')) {
            return overrides.requirements ?? { requisitos: ['Tamaño de la muestra', 'Criterio de selección'] };
        }
        if (prompt.includes('contiene la información necesaria')) {
            return (
                overrides.requirementVerdicts ?? {
                    veredictos: [
                        { indice: 0, cubierto: true },
                        { indice: 1, cubierto: false },
                    ],
                }
            );
        }
        throw new Error(`Prompt no reconocido: ${prompt.slice(0, 40)}`);
    };

    const stubEmbed = async (text: string) => (text.includes('muestra') ? [1, 0] : [0, 1]);

    it('scores the four metrics inside [0, 1]', async () => {
        const { scores } = await computeRagasForTriple(triple, {
            judge: stubJudge(),
            embed: stubEmbed,
        });

        assert.equal(scores.faithfulness, 0.5); // 1 de 2 afirmaciones respaldadas
        assert.equal(scores.answerRelevancy, 1); // la pregunta generada coincide
        assert.equal(scores.contextPrecision, 1); // el único fragmento útil va primero
        assert.equal(scores.contextRecall, 0.5); // 1 de 2 requisitos cubiertos

        for (const value of Object.values(scores)) {
            assert.ok(value === null || (value >= 0 && value <= 1));
        }
    });

    it('is stable when recomputed with the same inputs', async () => {
        const deps = { judge: stubJudge(), embed: stubEmbed };
        const first = await computeRagasForTriple(triple, deps);
        const second = await computeRagasForTriple(triple, deps);
        assert.deepEqual(first.scores, second.scores);
    });

    it('scores an evasive answer as irrelevant without embedding it', async () => {
        const { scores, detail } = await computeRagasForTriple(triple, {
            judge: stubJudge({ questions: { preguntas: [], evasiva: true } }),
            embed: async () => {
                throw new Error('no debería embeber una respuesta evasiva');
            },
        });
        assert.equal(scores.answerRelevancy, 0);
        assert.equal(detail.noncommittal, true);
    });

    it('penalises a retrieval whose useful fragment came last', async () => {
        const { scores } = await computeRagasForTriple(triple, {
            judge: stubJudge({
                contextVerdicts: { veredictos: [{ indice: 0, util: false }, { indice: 1, util: true }] },
            }),
            embed: stubEmbed,
        });
        assert.equal(scores.contextPrecision, 0.5);
    });

    it('reports null, not zero, for a metric whose judge call failed', async () => {
        const failing = async (prompt: string) => {
            if (prompt.includes('afirmaciones atómicas')) throw new Error('juez caído');
            return stubJudge()(prompt);
        };

        const { scores, detail } = await computeRagasForTriple(triple, {
            judge: failing,
            embed: stubEmbed,
        });

        assert.equal(scores.faithfulness, null);
        assert.equal(scores.contextRecall, 0.5, 'las demás métricas siguen midiéndose');
        assert.ok(detail.errors?.[0].startsWith('faithfulness:'));
    });

    it('leaves context metrics unmeasured when nothing was retrieved', async () => {
        const { scores } = await computeRagasForTriple(
            { ...triple, contexts: [] },
            { judge: stubJudge(), embed: stubEmbed },
        );
        assert.equal(scores.faithfulness, null);
        assert.equal(scores.contextPrecision, null);
        assert.equal(scores.contextRecall, null);
        assert.equal(scores.answerRelevancy, 1);
    });
});

// ============================================================================
// CSV
// ============================================================================

describe('toCsv', () => {
    it('quotes cells containing a delimiter, a quote or a line break', () => {
        const csv = toCsv(['a', 'b', 'c'], [['x,y', 'di "hola"', 'linea1\nlinea2']]);
        assert.equal(csv, 'a,b,c\r\n"x,y","di ""hola""","linea1\nlinea2"\r\n');
    });

    it('writes an empty cell for a missing value, never a zero', () => {
        const csv = toCsv(['lat'], [[null], [undefined], [0]]);
        assert.equal(csv, 'lat\r\n\r\n\r\n0\r\n');
    });

    it('writes booleans as 1/0 for SPSS', () => {
        assert.equal(toCsv(['ok'], [[true], [false]]), 'ok\r\n1\r\n0\r\n');
    });

    it('drops non-finite numbers rather than exporting NaN', () => {
        assert.equal(toCsv(['x'], [[Number.NaN]]), 'x\r\n\r\n');
    });

    it('formats dates as ISO-8601 and empties invalid ones', () => {
        assert.equal(isoOrEmpty(new Date('2026-09-03T14:05:00Z')), '2026-09-03T14:05:00.000Z');
        assert.equal(isoOrEmpty(null), '');
        assert.equal(isoOrEmpty('no es fecha'), '');
    });
});

// ============================================================================
// Formatting
// ============================================================================

describe('format helpers', () => {
    it('uses a Spanish decimal comma and groups thousands', () => {
        assert.equal(formatNumber(1234.5, 2), `1${THOUSANDS_SEPARATOR}234,50`);
        assert.equal(formatNumber(-1234, 0), `-1${THOUSANDS_SEPARATOR}234`);
    });

    it('renders a missing value as an em dash, never as zero', () => {
        assert.equal(formatMs(null), '—');
        assert.equal(formatPercent(undefined), '—');
        assert.equal(formatScore(null), '—');
        assert.equal(formatMs(0), '0 ms');
    });

    it('signs the latency delta so a drop is readable at a glance', () => {
        assert.equal(formatDeltaMs(-900), '−900 ms');
        assert.equal(formatDeltaMs(120), '+120 ms');
    });
});
