import assert from 'node:assert/strict';
import test from 'node:test';

import { computeSurveyScore, validateSurveyAnswers } from './surveys/scoring.ts';
import { buildSurveyProgress, type SurveyProgressResponse } from './surveys/progress.ts';

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

function submitted(surveyType: string, phase: string): SurveyProgressResponse {
    return { surveyType, phase, computedScore: 20, submittedAt: new Date('2026-09-10T12:00:00Z') };
}

test('both T1 instruments start available and can be completed in either order', () => {
    const initial = buildSurveyProgress(null, [], false);
    assert.deepEqual(initial.slice(0, 3).map((stage) => stage.status), ['available', 'available', 'pending']);

    const afterPrcs = buildSurveyProgress(null, [submitted('PRCS12', 'T1')], false);
    assert.equal(afterPrcs[0].status, 'available');
    assert.equal(afterPrcs[1].status, 'completed');
});

test('SUS requires both baseline instruments and at least one real conversation', () => {
    const baseline = [submitted('STAI', 'T1'), submitted('PRCS12', 'T1')];
    const withoutConversation = buildSurveyProgress('experimental', baseline, false);
    assert.equal(withoutConversation[2].status, 'pending');
    assert.match(withoutConversation[2].blockedReason ?? '', /conversación/);

    const withConversation = buildSurveyProgress('experimental', baseline, true);
    assert.equal(withConversation[2].status, 'available');
});

test('control participants skip SUS and unlock T2 after both baseline instruments', () => {
    const baseline = [submitted('STAI', 'T1'), submitted('PRCS12', 'T1')];
    const progress = buildSurveyProgress('control', baseline, false);
    assert.equal(progress[2].status, 'not_applicable');
    assert.equal(progress[3].status, 'available');
});
