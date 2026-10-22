/**
 * ICA — Índice de Completitud Arquitectónica = (Ci / Ct) × 100
 *
 * Reported at two levels, and the thesis should cite the second one:
 *
 *  - DECLARED ICA (`computeIca`): from the registry below. It states what the
 *    system is designed to contain. Being a declaration, it cannot fall unless
 *    someone edits the registry, so on its own it proves little.
 *  - OBSERVED ICA (`computeObservedIca`): per voice session, which of the five
 *    components left a trace in the database during that conversation (see
 *    `observeSessionComponents`). It is measured, not written: a session where
 *    the retriever never ran scores 60 %, whatever the registry says.
 *
 * `evidence` points at the file or document a reader can open to verify the
 * claim. It feeds the ICA table of docs/arquitectura.md (doc 05), so the
 * paths must stay accurate — a stale path is a broken piece of evidence.
 *
 * Pure module on purpose: no imports, no database, no environment. It is the
 * declaration of what the system is made of, testable on its own.
 */

export type ArchitectureComponentId = 'stt' | 'llm' | 'vector-db' | 'retriever' | 'tts';

export interface ArchitectureComponent {
    id: ArchitectureComponentId;
    /** Component name as the research declares it (Spanish: it is quoted verbatim). */
    name: string;
    /** The concrete technology that plays the role. */
    implementation: string;
    /** Files or documents where a reader verifies the integration. */
    evidence: string[];
    /** Whether it is wired into the live conversation loop, not merely present. */
    integrated: boolean;
    /** Where it runs: this repository or the Vapi platform. */
    runsOn: 'app' | 'vapi';
    /** What counts as proof that it worked in a given session (Spanish: shown in the UI). */
    observedWhen: string;
}

export const ARCHITECTURE_COMPONENTS: readonly ArchitectureComponent[] = [
    {
        id: 'stt',
        name: 'Reconocimiento de voz (STT)',
        implementation: 'Deepgram nova-2 mediante Vapi, fijado a español (language: "es")',
        evidence: ['lib/constants.ts', 'hooks/useVapi.ts', 'docs/agente/vapi-config.md'],
        integrated: true,
        runsOn: 'vapi',
        observedWhen: 'La sesión tiene al menos un turno transcrito del estudiante.',
    },
    {
        id: 'llm',
        name: 'Modelo de lenguaje (LLM)',
        implementation: 'GPT-4o mediante Vapi, con el prompt de docente evaluador enviado desde código',
        evidence: ['lib/agent-prompt.ts', 'lib/constants.ts', 'hooks/useVapi.ts'],
        integrated: true,
        runsOn: 'vapi',
        observedWhen:
            'El agente replica después de un turno del estudiante (el saludo inicial es texto fijo y no cuenta).',
    },
    {
        id: 'vector-db',
        name: 'Base de datos vectorial',
        implementation: 'Postgres + pgvector, embeddings Gemini de 768 dimensiones, índice HNSW coseno',
        evidence: ['database/schema/bookSegments.ts', 'lib/embeddings.ts', 'lib/actions/book.actions.ts'],
        integrated: true,
        runsOn: 'app',
        observedWhen: 'Se registró al menos una búsqueda por distancia coseno sobre los embeddings del documento.',
    },
    {
        id: 'retriever',
        name: 'Recuperador (retriever)',
        implementation: 'Búsqueda por distancia coseno con top-K y umbral de relevancia, invocada por el tool searchBook',
        evidence: ['app/api/vapi/search-book/route.ts', 'lib/actions/book.actions.ts', 'lib/retrievals.ts'],
        integrated: true,
        runsOn: 'app',
        observedWhen: 'Fragmentos recuperados llegaron a una réplica del agente (hay al menos un trío para RAGAs).',
    },
    {
        id: 'tts',
        name: 'Síntesis de voz (TTS)',
        implementation: 'Azure Speech mediante Vapi, voces es-PE-CamilaNeural o es-PE-AlexNeural (español de Perú)',
        evidence: ['lib/constants.ts', 'hooks/useVapi.ts', 'docs/agente/vapi-config.md'],
        integrated: true,
        runsOn: 'vapi',
        observedWhen: 'La sesión tiene al menos un turno hablado del agente.',
    },
];

export interface IcaResult {
    /** Ci — components integrated. */
    integrated: number;
    /** Ct — components planned. */
    total: number;
    /** (Ci / Ct) × 100, rounded to two decimals. */
    percentage: number;
    missing: ArchitectureComponentId[];
}

function percentageOf(part: number, total: number): number {
    return total === 0 ? 0 : Math.round((part / total) * 10000) / 100;
}

/** Declared ICA, from the registry. */
export function computeIca(
    components: readonly ArchitectureComponent[] = ARCHITECTURE_COMPONENTS,
): IcaResult {
    const total = components.length;
    const integrated = components.filter((c) => c.integrated).length;

    return {
        integrated,
        total,
        percentage: percentageOf(integrated, total),
        missing: components.filter((c) => !c.integrated).map((c) => c.id),
    };
}

export interface SessionComponentEvidence {
    /** The session's stored turns, in any order. */
    turns: ReadonlyArray<{ turnIndex: number; role: string }>;
    /** Rows in `turn_retrievals` recorded for the session. */
    retrievals: number;
    /** Retrievals that were followed by an agent reply (RAGAs triples). */
    groundedReplies: number;
}

/**
 * Which components left a trace in one session. The criteria are the
 * `observedWhen` texts of the registry; keep the two in sync.
 */
export function observeSessionComponents(evidence: SessionComponentEvidence): ArchitectureComponentId[] {
    const ordered = [...evidence.turns].sort((a, b) => a.turnIndex - b.turnIndex);
    const firstStudentIndex = ordered.find((t) => t.role === 'user')?.turnIndex;

    const observed: ArchitectureComponentId[] = [];
    if (firstStudentIndex !== undefined) observed.push('stt');
    if (
        firstStudentIndex !== undefined &&
        ordered.some((t) => t.role === 'assistant' && t.turnIndex > firstStudentIndex)
    ) {
        observed.push('llm');
    }
    if (evidence.retrievals > 0) observed.push('vector-db');
    if (evidence.groundedReplies > 0) observed.push('retriever');
    if (ordered.some((t) => t.role === 'assistant')) observed.push('tts');
    return observed;
}

export interface ObservedIcaResult {
    /** Sessions measured: those with at least one stored turn. */
    sessions: number;
    /** Mean of the per-session (Ci / Ct) × 100. Null when no session was measured. */
    meanPercentage: number | null;
    /** Sessions where all five components were observed: the full synchronous loop. */
    completeSessions: number;
    /** completeSessions / sessions × 100. Null when no session was measured. */
    completePercentage: number | null;
    /** For each component, in how many measured sessions it was observed. */
    sessionsByComponent: Record<ArchitectureComponentId, number>;
}

/** (Ci / Ct) × 100 for one session, given the components observed in it. */
export function sessionIcaPercentage(
    observed: ReadonlyArray<ArchitectureComponentId>,
    total: number = ARCHITECTURE_COMPONENTS.length,
): number {
    return percentageOf(new Set(observed).size, total);
}

/** Observed ICA over a set of sessions, one entry per session that has turns. */
export function computeObservedIca(
    perSession: ReadonlyArray<ReadonlyArray<ArchitectureComponentId>>,
    components: readonly ArchitectureComponent[] = ARCHITECTURE_COMPONENTS,
): ObservedIcaResult {
    const total = components.length;
    const sessionsByComponent = Object.fromEntries(components.map((c) => [c.id, 0])) as Record<
        ArchitectureComponentId,
        number
    >;

    let percentageSum = 0;
    let completeSessions = 0;
    for (const observed of perSession) {
        const unique = new Set(observed);
        for (const id of unique) {
            if (id in sessionsByComponent) sessionsByComponent[id]++;
        }
        percentageSum += sessionIcaPercentage([...unique], total);
        if (components.every((c) => unique.has(c.id))) completeSessions++;
    }

    const sessions = perSession.length;
    return {
        sessions,
        meanPercentage: sessions === 0 ? null : Math.round((percentageSum / sessions) * 100) / 100,
        completeSessions,
        completePercentage: sessions === 0 ? null : percentageOf(completeSessions, sessions),
        sessionsByComponent,
    };
}
