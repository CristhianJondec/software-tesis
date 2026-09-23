/**
 * Judged part of the post-session report: dimensions 1 and 2.
 *
 * THE CITATION IS MANDATORY. The content verdict is only accepted when the judge
 * names one of the retrieved fragments as the basis for it, and the named
 * fragment must be one actually handed to it — a cited index outside the list is
 * treated as no citation at all. Without a valid citation the level is stored as
 * null ("no concluyente"), never as 0: the student is not marked wrong because
 * the judge failed to ground itself. That is the rule from docs/propuestas/02,
 * and it is what makes the report auditable: every content sentence the student
 * reads has a fragment of their own document behind it.
 *
 * Clarity (dimension 2) is judged from the question and the answer only. It does
 * not cite, because it is not a claim about the document.
 *
 * The judge runs at temperature 0 with a fixed prompt (lib/metrics/judge.ts), so
 * the same case yields the same verdict. `FEEDBACK_PROMPT_VERSION` pins the
 * prompts: changing one produces new rows in `turn_feedback` instead of silently
 * rewriting past measurements.
 *
 * The prompts are in Spanish because the corpus is in Spanish; judging it in
 * another language would add an implicit translation to every verdict.
 */

import type { JudgeFn } from '../metrics/judge.ts';
import type { AnswerCase } from './cases.ts';
import { RUBRIC, normalizeRubricLevel, type RubricLevel } from './rubric.ts';

/**
 * Version of the prompts below. BUMP IT whenever any prompt changes: levels
 * produced by different prompts are different measurements and must not be
 * averaged together.
 */
export const FEEDBACK_PROMPT_VERSION = 'feedback-ts-v1';

/** Hard cap on a justification, so the report stays readable and the row bounded. */
export const MAX_JUSTIFICATION_CHARS = 400;

function rubricScale(dimension: 'content' | 'clarity'): string {
    return RUBRIC[dimension].levels.map((description, level) => `${level} = ${description}`).join('\n');
}

export const PROMPT_CONTENT = `Eres un docente evaluador que revisa la respuesta de un estudiante en la sustentación de su avance de investigación.

Tu tarea: calificar el DOMINIO DEL CONTENIDO de la respuesta, usando EXCLUSIVAMENTE los FRAGMENTOS del documento del propio estudiante que se te entregan. No uses conocimiento general ni supongas lo que el documento dice en otra parte.

ESCALA (elige un solo nivel):
{{scale}}

REGLA OBLIGATORIA DE CITA: debes indicar en "fragmento" el índice del fragmento que sustenta tu calificación. Si ningún fragmento permite juzgar la respuesta, devuelve "fragmento": null y "nivel": null. NO adivines: una calificación sin fragmento que la respalde no sirve.

La justificación debe ser una sola oración, dirigida al estudiante en segunda persona, y mencionar qué dice el fragmento. No comentes su estado de ánimo, su nerviosismo ni su seguridad: solo el contenido de lo que dijo.

PREGUNTA DEL JURADO:
{{question}}

RESPUESTA DEL ESTUDIANTE:
{{answer}}

FRAGMENTOS DEL DOCUMENTO DEL ESTUDIANTE (numerados desde 0):
{{contexts}}

Devuelve exclusivamente este JSON:
{"nivel": 2, "fragmento": 0, "justificacion": "una sola oración"}`;

export const PROMPT_CLARITY = `Eres un docente evaluador que revisa la respuesta de un estudiante en la sustentación de su avance de investigación.

Tu tarea: calificar la CLARIDAD Y ESTRUCTURA de la respuesta. No juzgues si el contenido es correcto —eso se evalúa aparte—, sino si la respuesta está ordenada, si responde lo que se preguntó y si conecta con los objetivos o la metodología de la investigación.

ESCALA (elige un solo nivel):
{{scale}}

La justificación debe ser una sola oración, dirigida al estudiante en segunda persona, y señalar un hecho concreto de su respuesta. No comentes su estado de ánimo, su nerviosismo ni su seguridad. No comentes su tono de voz ni su ritmo: solo tienes el texto.

Si la respuesta está vacía o es ininteligible, devuelve "nivel": 0.

PREGUNTA DEL JURADO:
{{question}}

RESPUESTA DEL ESTUDIANTE:
{{answer}}

Devuelve exclusivamente este JSON:
{"nivel": 2, "justificacion": "una sola oración"}`;

// ============================================================================
// Pure helpers
// ============================================================================

export function fillTemplate(template: string, values: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
        Object.hasOwn(values, key) ? values[key] : match,
    );
}

/** Numbers the fragments the way the prompt expects, with the page when known. */
export function formatContexts(contexts: AnswerCase['contexts']): string {
    return contexts
        .map((context, index) => {
            const page = context.pageNumber != null ? ` (página ${context.pageNumber})` : '';
            return `[${index}]${page} ${context.content}`;
        })
        .join('\n\n');
}

export function normalizeJustification(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const collapsed = value.replace(/\s+/g, ' ').trim();
    if (collapsed === '') return null;
    return collapsed.length > MAX_JUSTIFICATION_CHARS
        ? `${collapsed.slice(0, MAX_JUSTIFICATION_CHARS - 1).trimEnd()}…`
        : collapsed;
}

/**
 * Resolves the judge's cited index to a real segment id.
 *
 * Returns null for a missing, non-integer or out-of-range index. An index the
 * judge invented is NOT a citation, and accepting it would attach a verdict to a
 * fragment the judge never saw.
 */
export function resolveCitation(value: unknown, contexts: AnswerCase['contexts']): string | null {
    // Coerce only from a number or a numeric string. Never from null, undefined,
    // '' or false: `Number(null)` is 0, so a judge answering `"fragmento": null`
    // — the documented way to say "I cannot cite one" — would otherwise be read
    // as citing the first fragment, which is the exact failure this rule exists
    // to prevent.
    if (typeof value !== 'number' && typeof value !== 'string') return null;
    if (typeof value === 'string' && value.trim() === '') return null;

    const index = Number(value);
    if (!Number.isInteger(index) || index < 0 || index >= contexts.length) return null;
    return contexts[index].segmentId;
}

// ============================================================================
// Judge-driven evaluation
// ============================================================================

/** Trace of what the judge decided, stored as JSON for auditing. */
export interface FeedbackDetail {
    promptVersion: string;
    /** Search strings behind the fragments the judge was shown. */
    queries?: string[];
    /** Segment ids shown to the judge, in the order they were numbered. */
    contextSegmentIds?: string[];
    /** Raw index the judge returned, before validation. */
    citedIndex?: unknown;
    /** Set when a level was dropped because the citation did not resolve. */
    citationRejected?: boolean;
    /** Why a dimension could not be measured. Never a reason to store a 0. */
    errors?: string[];
}

export interface TurnFeedbackResult {
    contentLevel: RubricLevel | null;
    contentJustification: string | null;
    contentSegmentId: string | null;
    clarityLevel: RubricLevel | null;
    clarityJustification: string | null;
    detail: FeedbackDetail;
}

export interface FeedbackDeps {
    judge: JudgeFn;
}

/**
 * Evaluates one student answer on dimensions 1 and 2.
 *
 * The two dimensions are independent: a failure in one leaves the other intact,
 * and a dimension that could not be measured comes back null with its reason in
 * `detail.errors`.
 */
export async function evaluateAnswerCase(
    answerCase: AnswerCase,
    deps: FeedbackDeps,
): Promise<TurnFeedbackResult> {
    const detail: FeedbackDetail = {
        promptVersion: FEEDBACK_PROMPT_VERSION,
        queries: answerCase.queries,
        contextSegmentIds: answerCase.contexts.map((context) => context.segmentId),
        errors: [],
    };

    const result: TurnFeedbackResult = {
        contentLevel: null,
        contentJustification: null,
        contentSegmentId: null,
        clarityLevel: null,
        clarityJustification: null,
        detail,
    };

    const question = answerCase.question?.trim() ?? '';
    const answer = answerCase.answer.trim();

    const record = (dimension: string, error: unknown) => {
        detail.errors!.push(`${dimension}: ${(error as Error)?.message ?? String(error)}`);
    };

    if (question === '') {
        detail.errors!.push('contenido: la respuesta no siguió a ninguna pregunta del jurado');
        detail.errors!.push('claridad: la respuesta no siguió a ninguna pregunta del jurado');
        return result;
    }

    // --- Dimension 1: content, grounded in the student's own document --------
    if (answerCase.contexts.length === 0) {
        detail.errors!.push('contenido: no hubo fragmentos recuperados que sustenten un juicio');
    } else {
        try {
            const verdict = (await deps.judge(
                fillTemplate(PROMPT_CONTENT, {
                    scale: rubricScale('content'),
                    question,
                    answer,
                    contexts: formatContexts(answerCase.contexts),
                }),
            )) as Record<string, unknown>;

            detail.citedIndex = verdict?.fragmento;

            const level = normalizeRubricLevel(verdict?.nivel);
            const segmentId = resolveCitation(verdict?.fragmento, answerCase.contexts);
            const justification = normalizeJustification(verdict?.justificacion);

            if (level !== null && segmentId === null) {
                // A level with no fragment behind it is exactly what the proposal
                // forbids. Drop the level, keep the trace of why.
                detail.citationRejected = true;
                detail.errors!.push('contenido: el juez calificó sin citar un fragmento válido');
            } else {
                result.contentLevel = level;
                result.contentSegmentId = level === null ? null : segmentId;
                result.contentJustification = level === null ? null : justification;
                if (level === null) {
                    detail.errors!.push('contenido: el juez lo declaró no concluyente');
                }
            }
        } catch (error) {
            record('contenido', error);
        }
    }

    // --- Dimension 2: clarity and structure ---------------------------------
    try {
        const verdict = (await deps.judge(
            fillTemplate(PROMPT_CLARITY, { scale: rubricScale('clarity'), question, answer }),
        )) as Record<string, unknown>;

        const level = normalizeRubricLevel(verdict?.nivel);
        result.clarityLevel = level;
        result.clarityJustification = level === null ? null : normalizeJustification(verdict?.justificacion);
        if (level === null) detail.errors!.push('claridad: el juez no devolvió un nivel válido');
    } catch (error) {
        record('claridad', error);
    }

    return result;
}
