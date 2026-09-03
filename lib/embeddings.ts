import { GoogleGenAI } from '@google/genai';

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY!, httpOptions: { apiVersion: 'v1beta' } });

const MODEL = 'text-embedding-004';
const BATCH_SIZE = 100;
const DIMENSIONS = 768;

async function embedBatch(texts: string[], taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'): Promise<number[][]> {
    const result = await genai.models.embedContent({
        model: MODEL,
        contents: texts,
        config: {
            taskType,
            outputDimensionality: DIMENSIONS,
        },
    });

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
