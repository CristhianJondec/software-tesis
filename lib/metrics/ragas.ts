/**
 * RAGAs — ADAPTACIÓN EN TYPESCRIPT. LEER ANTES DE CITAR ESTOS NÚMEROS.
 * ============================================================================
 *
 * La investigación cita RAGAs como el framework de Es et al. (2023), que es una
 * librería de Python. Aquí NO se usa esa librería: las cuatro métricas se
 * reimplementaron en TypeScript por decisión de stack (ver CLAUDE.md). Eso es
 * legítimo, pero debe declararse como adaptación y no presentarse como si se
 * hubiera ejecutado `ragas`. La nota metodológica completa va en
 * `docs/arquitectura.md` (doc 05); este comentario es su contraparte en código.
 *
 * Fórmulas seguidas, y en qué se apartan de la implementación oficial:
 *
 * 1. FAITHFULNESS — fiel al algoritmo original.
 *    El juez descompone la respuesta en afirmaciones atómicas SIN ver el
 *    contexto; luego, en una segunda llamada, verifica cada afirmación contra
 *    el contexto recuperado. Puntaje = afirmaciones respaldadas / totales.
 *    La separación en dos llamadas es deliberada: si el juez viera el contexto
 *    al extraer, extraería justamente lo que el contexto respalda.
 *
 * 2. ANSWER RELEVANCY — fiel al algoritmo original.
 *    El juez genera N preguntas para las que la respuesta sería adecuada; se
 *    embeben con el mismo modelo del retriever (Gemini text-embedding-004) y se
 *    promedia su similitud coseno con la pregunta real. Una respuesta evasiva
 *    ("no lo sé") puntúa 0. DESVÍO: la implementación oficial usa por defecto
 *    N = 3 y el modelo de embeddings de OpenAI; aquí N = 3 con el embebedor ya
 *    configurado en el proyecto, para no introducir un segundo proveedor.
 *
 * 3. CONTEXT PRECISION — fiel a la fórmula, distinto en la referencia.
 *    Precisión promedio (average precision@K) sobre los fragmentos en el orden
 *    en que el retriever los devolvió. DESVÍO: la versión oficial juzga la
 *    utilidad de cada fragmento contra el `ground_truth`; aquí no existe una
 *    respuesta de referencia escrita a mano, así que se juzga contra la
 *    pregunta y la respuesta efectivamente dada.
 *
 * 4. CONTEXT RECALL — ADAPTACIÓN, es el desvío más grande de los cuatro.
 *    La versión oficial descompone el `ground_truth` en oraciones y mide cuántas
 *    son atribuibles al contexto recuperado. Este proyecto no tiene ground truth:
 *    las sustentaciones son conversaciones espontáneas, no un dataset anotado.
 *    En su lugar, el juez descompone la PREGUNTA en los requisitos de
 *    información que exige y mide cuántos están cubiertos por el contexto
 *    recuperado. Mide lo mismo conceptualmente —"¿se recuperó lo necesario?"—
 *    pero NO es el mismo cálculo, y así debe reportarse.
 *
 * Reproducibilidad: los prompts del juez son fijos y están versionados en
 * `RAGAS_PROMPT_VERSION`. Cambiar un prompt obliga a subir la versión, lo que
 * genera filas nuevas en `ragas_evaluations` en vez de reescribir mediciones
 * anteriores. El juez corre con temperatura 0 (ver lib/metrics/judge.ts).
 *
 * Los prompts están en español porque el corpus, las preguntas y las respuestas
 * están en español; juzgarlos en otro idioma agregaría una traducción implícita.
 */

import type { EmbedFn, JudgeFn } from './judge';
import type { RagasTriple } from './triples';

/**
 * Version of the judge prompts below. BUMP IT whenever any prompt changes:
 * scores computed with different prompts are different measurements and must
 * not be averaged together.
 */
export const RAGAS_PROMPT_VERSION = 'ragas-ts-v1';

/** Questions generated per answer for answer relevancy (N in the original paper). */
export const RELEVANCY_QUESTIONS = 3;

// ============================================================================
// Judge prompts (fixed and versioned)
// ============================================================================

export const PROMPT_EXTRACT_CLAIMS = `Eres un evaluador de sistemas de recuperación de información.

Descompón la RESPUESTA en afirmaciones atómicas: enunciados simples, cada uno verificable por separado, sin pronombres sin antecedente. No agregues información que no esté en la respuesta. Ignora saludos, muletillas y preguntas que la respuesta le haga al estudiante: no son afirmaciones.

PREGUNTA:
{{question}}

RESPUESTA:
{{answer}}

Devuelve exclusivamente este JSON:
{"afirmaciones": ["afirmación 1", "afirmación 2"]}

Si la respuesta no contiene ninguna afirmación verificable, devuelve {"afirmaciones": []}.`;

export const PROMPT_VERIFY_CLAIMS = `Eres un evaluador de sistemas de recuperación de información.

Para cada afirmación, decide si puede deducirse del CONTEXTO. Sé estricto: si el contexto no la respalda directamente, la afirmación NO está respaldada, aunque parezca cierta o razonable en general.

CONTEXTO:
{{context}}

AFIRMACIONES (numeradas desde 0):
{{claims}}

Devuelve exclusivamente este JSON, con un objeto por afirmación y en el mismo orden:
{"veredictos": [{"indice": 0, "respaldada": true, "razon": "breve"}]}`;

export const PROMPT_GENERATE_QUESTIONS = `Eres un evaluador de sistemas de recuperación de información.

Lee la RESPUESTA y escribe ${RELEVANCY_QUESTIONS} preguntas distintas para las cuales esa respuesta sería adecuada. Básate solo en la respuesta, no inventes contexto.

Marca "evasiva" como true si la respuesta no se compromete con ningún contenido: dice que no sabe, cambia de tema o solo devuelve la pregunta al estudiante.

RESPUESTA:
{{answer}}

Devuelve exclusivamente este JSON:
{"preguntas": ["pregunta 1", "pregunta 2", "pregunta 3"], "evasiva": false}`;

export const PROMPT_CONTEXT_PRECISION = `Eres un evaluador de sistemas de recuperación de información.

Para cada FRAGMENTO recuperado, decide si aportó información útil para responder la PREGUNTA con la RESPUESTA dada. Un fragmento del mismo documento pero sobre otro tema NO es útil.

PREGUNTA:
{{question}}

RESPUESTA:
{{answer}}

FRAGMENTOS (numerados desde 0, en el orden en que los devolvió el recuperador):
{{context}}

Devuelve exclusivamente este JSON, con un objeto por fragmento y en el mismo orden:
{"veredictos": [{"indice": 0, "util": true, "razon": "breve"}]}`;

export const PROMPT_EXTRACT_REQUIREMENTS = `Eres un evaluador de sistemas de recuperación de información.

Enumera los requisitos de información que hay que conocer del documento del estudiante para responder la PREGUNTA de forma completa. Cada requisito debe ser un enunciado corto y verificable. No respondas la pregunta.

PREGUNTA:
{{question}}

Devuelve exclusivamente este JSON:
{"requisitos": ["requisito 1", "requisito 2"]}

Si la pregunta no exige información del documento (por ejemplo, un saludo), devuelve {"requisitos": []}.`;

export const PROMPT_VERIFY_REQUIREMENTS = `Eres un evaluador de sistemas de recuperación de información.

Para cada REQUISITO, decide si el CONTEXTO recuperado contiene la información necesaria para cubrirlo. Sé estricto: que el contexto mencione el tema no basta si no aporta el dato.

CONTEXTO:
{{context}}

REQUISITOS (numerados desde 0):
{{requirements}}

Devuelve exclusivamente este JSON, con un objeto por requisito y en el mismo orden:
{"veredictos": [{"indice": 0, "cubierto": true, "razon": "breve"}]}`;

// ============================================================================
// Pure scoring helpers (no network, no database)
// ============================================================================

export function fillTemplate(template: string, values: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
        Object.hasOwn(values, key) ? values[key] : match,
    );
}

/** Numbers a list the way the prompts expect: "[0] texto". */
export function numberList(items: ReadonlyArray<string>): string {
    return items.map((item, index) => `[${index}] ${item}`).join('\n');
}

/**
 * Turns the judge's verdict array into a fixed-length boolean array.
 *
 * Verdicts are matched by their declared `indice`, not by array position: a
 * judge that skips or reorders entries would otherwise shift every verdict onto
 * the wrong claim. A claim with no verdict counts as NOT satisfied — silence
 * from the judge is not evidence in the system's favour.
 */
export function alignVerdicts(
    count: number,
    entries: ReadonlyArray<{ indice?: unknown; value: unknown }>,
): boolean[] {
    const aligned = new Array<boolean>(count).fill(false);

    entries.forEach((entry, position) => {
        const declared = typeof entry.indice === 'number' ? entry.indice : Number(entry.indice);
        const index = Number.isInteger(declared) && declared >= 0 && declared < count ? declared : position;
        if (index >= 0 && index < count) aligned[index] = entry.value === true;
    });

    return aligned;
}

/** supported / total, rounded to 4 decimals. Null when there is nothing to score. */
export function ratioScore(flags: ReadonlyArray<boolean>): number | null {
    if (flags.length === 0) return null;
    const satisfied = flags.filter(Boolean).length;
    return round4(satisfied / flags.length);
}

/**
 * Average precision@K over the retrieved chunks, in retriever order.
 *
 *   AP = Σ_k [ precision@k × rel_k ] / (number of relevant chunks)
 *
 * Rank-sensitive on purpose: a useful fragment ranked first is worth more than
 * the same fragment ranked fifth, which is exactly what a retriever is judged on.
 */
export function averagePrecisionAtK(relevances: ReadonlyArray<boolean>): number | null {
    if (relevances.length === 0) return null;

    let relevantSoFar = 0;
    let sum = 0;
    relevances.forEach((isRelevant, position) => {
        if (!isRelevant) return;
        relevantSoFar++;
        sum += relevantSoFar / (position + 1);
    });

    return relevantSoFar === 0 ? 0 : round4(sum / relevantSoFar);
}

/** Mean cosine similarity clamped into [0, 1]: a negative similarity is simply "not relevant". */
export function meanSimilarity(similarities: ReadonlyArray<number>): number | null {
    if (similarities.length === 0) return null;
    const mean = similarities.reduce((acc, value) => acc + value, 0) / similarities.length;
    return round4(Math.min(1, Math.max(0, mean)));
}

function round4(value: number): number {
    return Math.round(value * 10000) / 10000;
}

/**
 * Cosine similarity in [-1, 1]; 0 when either vector is degenerate.
 *
 * Lives here rather than next to the embedding client so this module stays free
 * of runtime imports: everything above is pure and unit-testable without a key.
 */
export function cosineSimilarity(a: ReadonlyArray<number>, b: ReadonlyArray<number>): number {
    if (a.length === 0 || a.length !== b.length) return 0;

    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;

    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ============================================================================
// Aggregation
// ============================================================================

export interface RagasScores {
    faithfulness: number | null;
    answerRelevancy: number | null;
    contextPrecision: number | null;
    contextRecall: number | null;
}

export type RagasMetricId = keyof RagasScores;

export const RAGAS_METRIC_IDS: readonly RagasMetricId[] = [
    'faithfulness',
    'answerRelevancy',
    'contextPrecision',
    'contextRecall',
];

/** Spanish labels for the UI and the research tables. */
export const RAGAS_METRIC_LABELS: Record<RagasMetricId, string> = {
    faithfulness: 'Faithfulness (fidelidad al contexto)',
    answerRelevancy: 'Answer relevancy (pertinencia de la respuesta)',
    contextPrecision: 'Context precision (precisión del contexto)',
    contextRecall: 'Context recall (cobertura del contexto)',
};

export interface RagasMetricSummary {
    /** Mean over the triples where the metric was computable. Null when n = 0. */
    mean: number | null;
    /** How many triples contributed. Never report a mean without it. */
    n: number;
}

export type RagasSummary = Record<RagasMetricId, RagasMetricSummary>;

export function aggregateRagas(scores: ReadonlyArray<RagasScores>): RagasSummary {
    const summary = {} as RagasSummary;

    for (const metric of RAGAS_METRIC_IDS) {
        const values = scores
            .map((score) => score[metric])
            .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

        summary[metric] =
            values.length === 0
                ? { mean: null, n: 0 }
                : { mean: round4(values.reduce((a, b) => a + b, 0) / values.length), n: values.length };
    }

    return summary;
}

// ============================================================================
// Judge-driven computation
// ============================================================================

/** Trace of what the judge decided, stored as JSON for auditing. */
export interface RagasDetail {
    promptVersion: string;
    claims?: string[];
    claimVerdicts?: boolean[];
    generatedQuestions?: string[];
    noncommittal?: boolean;
    similarities?: number[];
    contextRelevances?: boolean[];
    requirements?: string[];
    requirementVerdicts?: boolean[];
    errors?: string[];
}

export interface RagasDeps {
    judge: JudgeFn;
    embed: EmbedFn;
}

function asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item.length > 0);
}

function asVerdictEntries(value: unknown, key: string): Array<{ indice?: unknown; value: unknown }> {
    if (!Array.isArray(value)) return [];
    return value.map((item) => {
        const record = (item ?? {}) as Record<string, unknown>;
        return { indice: record.indice, value: record[key] };
    });
}

function joinContexts(triple: RagasTriple): string {
    return triple.contexts
        .map((context, index) => {
            const page = context.pageNumber != null ? ` (página ${context.pageNumber})` : '';
            return `[${index}]${page} ${context.content}`;
        })
        .join('\n\n');
}

export interface RagasTripleResult {
    scores: RagasScores;
    detail: RagasDetail;
}

/**
 * Scores one triple. Each metric is computed independently and a failure in one
 * leaves the others intact: a metric that could not be measured is reported as
 * null (and its reason recorded in `detail.errors`), never as a zero. A zero is
 * a measurement; null is the absence of one, and the thesis must not confuse them.
 */
export async function computeRagasForTriple(
    triple: RagasTriple,
    deps: RagasDeps,
): Promise<RagasTripleResult> {
    const detail: RagasDetail = { promptVersion: RAGAS_PROMPT_VERSION, errors: [] };
    const scores: RagasScores = {
        faithfulness: null,
        answerRelevancy: null,
        contextPrecision: null,
        contextRecall: null,
    };

    const context = joinContexts(triple);
    const hasContext = triple.contexts.length > 0;

    const record = (metric: string, error: unknown) => {
        detail.errors!.push(`${metric}: ${(error as Error).message ?? String(error)}`);
    };

    // --- 1. Faithfulness -----------------------------------------------------
    if (hasContext) {
        try {
            const extracted = (await deps.judge(
                fillTemplate(PROMPT_EXTRACT_CLAIMS, {
                    question: triple.question,
                    answer: triple.answer,
                }),
            )) as Record<string, unknown>;

            const claims = asStringArray(extracted?.afirmaciones);
            detail.claims = claims;

            if (claims.length > 0) {
                const verified = (await deps.judge(
                    fillTemplate(PROMPT_VERIFY_CLAIMS, { context, claims: numberList(claims) }),
                )) as Record<string, unknown>;

                const verdicts = alignVerdicts(
                    claims.length,
                    asVerdictEntries(verified?.veredictos, 'respaldada'),
                );
                detail.claimVerdicts = verdicts;
                scores.faithfulness = ratioScore(verdicts);
            }
        } catch (error) {
            record('faithfulness', error);
        }
    }

    // --- 2. Answer relevancy -------------------------------------------------
    try {
        const generated = (await deps.judge(
            fillTemplate(PROMPT_GENERATE_QUESTIONS, { answer: triple.answer }),
        )) as Record<string, unknown>;

        const questions = asStringArray(generated?.preguntas).slice(0, RELEVANCY_QUESTIONS);
        const noncommittal = generated?.evasiva === true;
        detail.generatedQuestions = questions;
        detail.noncommittal = noncommittal;

        if (noncommittal) {
            // Original RAGAs behaviour: an evasive answer is maximally irrelevant,
            // no matter how well it paraphrases the question.
            scores.answerRelevancy = 0;
        } else if (questions.length > 0) {
            const [questionVector, ...generatedVectors] = await Promise.all([
                deps.embed(triple.question),
                ...questions.map((q) => deps.embed(q)),
            ]);
            const similarities = generatedVectors.map((vector) =>
                cosineSimilarity(questionVector, vector),
            );
            detail.similarities = similarities.map((value) => round4(value));
            scores.answerRelevancy = meanSimilarity(similarities);
        }
    } catch (error) {
        record('answerRelevancy', error);
    }

    // --- 3. Context precision ------------------------------------------------
    if (hasContext) {
        try {
            const judged = (await deps.judge(
                fillTemplate(PROMPT_CONTEXT_PRECISION, {
                    question: triple.question,
                    answer: triple.answer,
                    context,
                }),
            )) as Record<string, unknown>;

            const relevances = alignVerdicts(
                triple.contexts.length,
                asVerdictEntries(judged?.veredictos, 'util'),
            );
            detail.contextRelevances = relevances;
            scores.contextPrecision = averagePrecisionAtK(relevances);
        } catch (error) {
            record('contextPrecision', error);
        }
    }

    // --- 4. Context recall (adapted, see the header note) --------------------
    if (hasContext) {
        try {
            const extracted = (await deps.judge(
                fillTemplate(PROMPT_EXTRACT_REQUIREMENTS, { question: triple.question }),
            )) as Record<string, unknown>;

            const requirements = asStringArray(extracted?.requisitos);
            detail.requirements = requirements;

            if (requirements.length > 0) {
                const verified = (await deps.judge(
                    fillTemplate(PROMPT_VERIFY_REQUIREMENTS, {
                        context,
                        requirements: numberList(requirements),
                    }),
                )) as Record<string, unknown>;

                const verdicts = alignVerdicts(
                    requirements.length,
                    asVerdictEntries(verified?.veredictos, 'cubierto'),
                );
                detail.requirementVerdicts = verdicts;
                scores.contextRecall = ratioScore(verdicts);
            }
        } catch (error) {
            record('contextRecall', error);
        }
    }

    if (detail.errors!.length === 0) delete detail.errors;

    return { scores, detail };
}
