import assert from 'node:assert/strict';
import test from 'node:test';

import { computeSurveyScore, validateSurveyAnswers } from './surveys/scoring.ts';

function answers(count: number, valueForItem: (item: number) => number) {
    return Object.fromEntries(Array.from({ length: count }, (_, index) => [`item_${index + 1}`, valueForItem(index + 1)]));
}

test('STAI applies the specified reverse scoring and stays in 0–60', () => {
    const reversed = new Set([1, 2, 5, 8, 10, 11, 15, 16, 19, 20]);
    assert.equal(computeSurveyScore('STAI', answers(20, (item) => reversed.has(item) ? 3 : 0)), 0);
    assert.equal(computeSurveyScore('STAI', answers(20, (item) => reversed.has(item) ? 0 : 3)), 60);
});

test('PRCS-12 applies the specified reverse scoring and stays in 12–72', () => {
    const reversed = new Set([1, 6, 8, 10, 11, 12]);
    assert.equal(computeSurveyScore('PRCS12', answers(12, (item) => reversed.has(item) ? 6 : 1)), 12);
    assert.equal(computeSurveyScore('PRCS12', answers(12, (item) => reversed.has(item) ? 1 : 6)), 72);
});

test('SUS applies odd/even contributions and stays in 0–100', () => {
    assert.equal(computeSurveyScore('SUS', answers(10, (item) => item % 2 === 1 ? 1 : 5)), 0);
    assert.equal(computeSurveyScore('SUS', answers(10, (item) => item % 2 === 1 ? 5 : 1)), 100);
});

test('validation rejects missing and out-of-scale answers', () => {
    assert.throws(() => validateSurveyAnswers('SUS', answers(9, () => 3)), /10 preguntas/);
    assert.throws(() => validateSurveyAnswers('SUS', answers(10, (item) => item === 4 ? 6 : 3)), /escala/);
});
