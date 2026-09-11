import { SURVEY_INSTRUMENTS, type SurveyType } from './catalog.ts';

const STAI_REVERSED = new Set([1, 2, 5, 8, 10, 11, 15, 16, 19, 20]);
const PRCS12_REVERSED = new Set([1, 6, 8, 10, 11, 12]);

export function validateSurveyAnswers(type: SurveyType, answers: Record<string, unknown>): Record<string, number> {
    const instrument = SURVEY_INSTRUMENTS[type];
    const allowed = new Set(instrument.options.map((option) => option.value));
    const expectedKeys = instrument.questions.map((_, index) => `item_${index + 1}`);

    if (Object.keys(answers).length !== expectedKeys.length) {
        throw new Error(`Debes responder las ${expectedKeys.length} preguntas antes de enviar.`);
    }

    const validated: Record<string, number> = {};
    for (const key of expectedKeys) {
        const value = answers[key];
        if (typeof value !== 'number' || !Number.isInteger(value) || !allowed.has(value)) {
            throw new Error('Todas las respuestas deben pertenecer a la escala indicada.');
        }
        validated[key] = value;
    }

    return validated;
}

export function computeSurveyScore(type: SurveyType, answers: Record<string, number>): number {
    const values = SURVEY_INSTRUMENTS[type].questions.map((_, index) => answers[`item_${index + 1}`]);

    if (type === 'STAI') {
        return values.reduce((total, value, index) => total + (STAI_REVERSED.has(index + 1) ? 3 - value : value), 0);
    }

    if (type === 'PRCS12') {
        return values.reduce((total, value, index) => total + (PRCS12_REVERSED.has(index + 1) ? 7 - value : value), 0);
    }

    const contribution = values.reduce(
        (total, value, index) => total + ((index + 1) % 2 === 1 ? value - 1 : 5 - value),
        0,
    );
    return contribution * 2.5;
}
