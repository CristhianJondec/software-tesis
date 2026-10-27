import { GoogleGenAI } from '@google/genai';

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY!, httpOptions: { apiVersion: 'v1beta' } });

// Google retired text-embedding-004 (the API now answers 404 NOT_FOUND for it).
// gemini-embedding-001 replaces it and still accepts outputDimensionality: 768,
// so book_segments.embedding and its HNSW index stay unchanged.
// Note: at dimensions other than 3072 these vectors are NOT unit-normalized.
// That is fine here because retrieval uses cosine distance, which is scale
// invariant — but do not switch the index to inner product without normalizing.
const MODEL = 'gemini-embedding-001';
// ~25 segments of 500 words is ~20k tokens per request: small enough that a
// rejected batch is cheap to retry, and under the free tier's 30k tokens/min.
const BATCH_SIZE = 25;
const DIMENSIONS = 768;

// Retry policy for 429 (quota) and 503 (overloaded). Ingestion can afford to
// wait out the delay Google asks for; a query runs inside a live voice turn, so
// it only gets a short retry before the agent answers without fragments.
interface RetryPolicy {
    attempts: number;
    maxDelayMs: number;
}
const DOCUMENT_RETRY: RetryPolicy = { attempts: 4, maxDelayMs: 65_000 };
const QUERY_RETRY: RetryPolicy = { attempts: 2, maxDelayMs: 1_500 };
const RETRYABLE_STATUS = new Set([429, 503]);

/** HTTP status of a Gemini SDK error, when it carries one. */
export function embeddingErrorStatus(error: unknown): number | null {
    const status = (error as { status?: unknown } | null)?.status;
    return typeof status === 'number' ? status : null;
}

/** Seconds Google asks to wait ("Please retry in 44.2s" / "retryDelay":"44s"). */
function retryDelayMs(error: unknown): number | null {
    const message = error instanceof Error ? error.message : String(error);
    const match = message.match(/retry in ([\d.]+)s/i) ?? message.match(/"retryDelay"\s*:\s*"([\d.]+)s"/);
    return match ? Math.ceil(Number(match[1]) * 1000) : null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRetry<T>(run: () => Promise<T>, policy: RetryPolicy): Promise<T> {
    for (let attempt = 1; ; attempt++) {
        try {
            return await run();
        } catch (error) {
            const status = embeddingErrorStatus(error);
            if (attempt >= policy.attempts || status === null || !RETRYABLE_STATUS.has(status)) throw error;

            const fallback = 1_000 * 2 ** (attempt - 1);
            const delay = Math.min(retryDelayMs(error) ?? fallback, policy.maxDelayMs);
            console.warn(`Gemini embeddings answered ${status}; retrying in ${delay} ms (attempt ${attempt + 1}/${policy.attempts})`);
            await sleep(delay);
        }
    }
}

async function embedBatch(texts: string[], taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'): Promise<number[][]> {
    const policy = taskType === 'RETRIEVAL_DOCUMENT' ? DOCUMENT_RETRY : QUERY_RETRY;
    const result = await withRetry(() => genai.models.embedContent({
        model: MODEL,
        contents: texts,
        config: {
            taskType,
            outputDimensionality: DIMENSIONS,
        },
    }), policy);

    if (!result.embeddings) {
        throw new Error('Gemini returned no embeddings');
    }

    return result.embeddings.map((e) => {
        if (!e.values) throw new Error('Gemini embedding missing values');
        return e.values;
    });
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const slice = texts.slice(i, i + BATCH_SIZE);
        const batch = await embedBatch(slice, 'RETRIEVAL_DOCUMENT');
        out.push(...batch);
    }
    return out;
}

export async function generateQueryEmbedding(query: string): Promise<number[]> {
    const [embedding] = await embedBatch([query], 'RETRIEVAL_QUERY');
    return embedding;
}
