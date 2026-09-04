import { GoogleGenAI } from '@google/genai';

/**
 * LLM judge used by the RAGAs metrics (lib/metrics/ragas.ts).
 *
 * Reproducibility is the whole point of this file, so three things are pinned:
 *
 *  - temperature 0, so the same triple yields the same verdict;
 *  - thinkingBudget 0, so the model does not sample a variable-length reasoning
 *    trace before answering (that sampling is a second source of drift);
 *  - JSON response mime type, so the verdict is parsed, never regex-scraped.
 *
 * The judge is injected into the metric functions rather than imported by them,
 * so the scoring logic stays testable without a network call.
 */

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Pinned in the thesis alongside the scores: a different judge model is a
// different measurement instrument.
export const JUDGE_MODEL = process.env.GEMINI_JUDGE_MODEL ?? 'gemini-2.5-flash';

export type JudgeFn = (prompt: string) => Promise<unknown>;

/** Strips a ```json fence if the model wraps its answer despite the mime type. */
function stripFence(text: string): string {
    const trimmed = text.trim();
    if (!trimmed.startsWith('```')) return trimmed;
    return trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
}

export const geminiJudge: JudgeFn = async (prompt: string) => {
    const response = await genai.models.generateContent({
        model: JUDGE_MODEL,
        contents: prompt,
        config: {
            temperature: 0,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 0 },
        },
    });

    const text = response.text;
    if (!text) throw new Error('El juez no devolvió contenido');

    try {
        return JSON.parse(stripFence(text));
    } catch {
        throw new Error(`El juez no devolvió JSON válido: ${text.slice(0, 200)}`);
    }
};

export type EmbedFn = (text: string) => Promise<number[]>;
