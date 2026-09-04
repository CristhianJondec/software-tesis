/**
 * ICA — Índice de Completitud Arquitectónica = (Ci / Ct) × 100
 *
 * Declarative registry of the five components the research commits to. The index
 * is derived from this list, never written by hand: if a component is dropped
 * or stops being wired up, `integrated` flips to false here and the reported
 * percentage falls with it.
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
}

export const ARCHITECTURE_COMPONENTS: readonly ArchitectureComponent[] = [
    {
        id: 'stt',
        name: 'Reconocimiento de voz (STT)',
        implementation: 'Transcriptor de Vapi con language: "es"',
        evidence: ['docs/agente/vapi-config.md', 'hooks/useVapi.ts'],
        integrated: true,
        runsOn: 'vapi',
    },
    {
        id: 'llm',
        name: 'Modelo de lenguaje (LLM)',
        implementation: 'LLM del assistant de Vapi con el prompt de docente evaluador',
        evidence: ['docs/agente/prompt-evaluador.md', 'docs/agente/vapi-config.md'],
        integrated: true,
        runsOn: 'vapi',
    },
    {
        id: 'vector-db',
        name: 'Base de datos vectorial',
        implementation: 'Postgres + pgvector, embeddings de 768 dimensiones, índice HNSW coseno',
        evidence: ['database/schema/bookSegments.ts', 'lib/embeddings.ts'],
        integrated: true,
        runsOn: 'app',
    },
    {
        id: 'retriever',
        name: 'Recuperador (retriever)',
        implementation: 'Búsqueda por distancia coseno con top-K y umbral de relevancia',
        evidence: ['lib/actions/book.actions.ts', 'app/api/vapi/search-book/route.ts', 'lib/constants.ts'],
        integrated: true,
        runsOn: 'app',
    },
    {
        id: 'tts',
        name: 'Síntesis de voz (TTS)',
        implementation: 'ElevenLabs a través de Vapi (eleven_turbo_v2_5)',
        evidence: ['lib/constants.ts', 'docs/agente/vapi-config.md'],
        integrated: true,
        runsOn: 'vapi',
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

export function computeIca(
    components: readonly ArchitectureComponent[] = ARCHITECTURE_COMPONENTS,
): IcaResult {
    const total = components.length;
    const integrated = components.filter((c) => c.integrated).length;
    const percentage = total === 0 ? 0 : Math.round((integrated / total) * 10000) / 100;

    return {
        integrated,
        total,
        percentage,
        missing: components.filter((c) => !c.integrated).map((c) => c.id),
    };
}
