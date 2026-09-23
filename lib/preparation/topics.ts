// Canonical taxonomy of the preparation map (docs/propuestas/03).
//
// The twelve topics are NOT derived from the student's document: they are the
// sections a thesis defense in this university is examined on, so the map can
// say "your document has nothing for this" — which is only possible against a
// fixed list. A taxonomy read out of the PDF could never report an absence.
//
// This file is the single source of truth for what a topic is. Three different
// consumers read it and none of them may redefine a topic:
//
//   coverage  -> `query` locates the topic in the document (vector search)
//   tagging   -> `cues` tag an agent question with the topic it belongs to
//   focusing  -> `focusHint` tells the agent what to press on in a focused session
//
// Student-facing strings are in Spanish because they are rendered in the UI.

export const PREPARATION_TOPIC_IDS = [
    'problema',
    'objetivos',
    'justificacion',
    'antecedentes',
    'marco-teorico',
    'metodologia',
    'muestra',
    'instrumentos',
    'resultados',
    'discusion',
    'conclusiones',
    'limitaciones',
] as const;

export type PreparationTopicId = (typeof PREPARATION_TOPIC_IDS)[number];

export interface PreparationTopic {
    id: PreparationTopicId;
    /** Shown as the heading of the topic in the map. */
    name: string;
    /** One line under the name, in the student's language. */
    description: string;
    /**
     * Search phrase used to find the topic in the document. Written the way the
     * agent phrases its own `searchBook` queries (a Spanish noun phrase, not a
     * keyword), because coverage has to reflect what the retriever would
     * actually return during a session — not a friendlier search.
     */
    query: string;
    /**
     * Lexical cues that tag an agent question with this topic. Accents and 'ñ'
     * are written normally here; `classify.ts` normalises them before matching.
     */
    cues: readonly string[];
    /** What the jury presses on. Injected into the prompt of a focused session. */
    focusHint: string;
}

export const PREPARATION_TOPICS: Record<PreparationTopicId, PreparationTopic> = {
    problema: {
        id: 'problema',
        name: 'Planteamiento del problema',
        description: 'Qué problema investigas y por qué es un problema real.',
        query: 'planteamiento del problema y realidad problemática de la investigación',
        cues: [
            'planteamiento del problema',
            'realidad problematica',
            'problema de investigacion',
            'formulacion del problema',
            'pregunta de investigacion',
            'problema',
        ],
        focusHint: 'cómo delimita el problema y qué evidencia tiene de que existe',
    },
    objetivos: {
        id: 'objetivos',
        name: 'Objetivos e hipótesis',
        description: 'Objetivo general, objetivos específicos y, si corresponde, hipótesis.',
        query: 'objetivo general, objetivos específicos e hipótesis de la investigación',
        cues: [
            'objetivo general',
            'objetivos generales',
            'objetivo especifico',
            'objetivos especificos',
            'objetivo',
            'hipotesis',
        ],
        focusHint: 'si los objetivos responden al problema y si son verificables',
    },
    justificacion: {
        id: 'justificacion',
        name: 'Justificación',
        description: 'Por qué tu investigación merece hacerse y a quién le sirve.',
        query: 'justificación, importancia y aporte de la investigación',
        cues: [
            'importancia del estudio',
            'utilidad practica',
            'justificacion',
            'relevancia',
            'aporte',
            'beneficiario',
        ],
        focusHint: 'a quién beneficia el estudio y qué aporta que no exista ya',
    },
    antecedentes: {
        id: 'antecedentes',
        name: 'Antecedentes',
        description: 'Estudios previos sobre los que se apoya tu trabajo.',
        query: 'antecedentes nacionales e internacionales y estudios previos',
        cues: [
            'antecedente',
            'estudio previo',
            'estudios previos',
            'investigacion previa',
            'investigaciones previas',
            'trabajo previo',
            'trabajos previos',
            'estado del arte',
        ],
        focusHint: 'qué antecedente sostiene su decisión y en qué se diferencia de él',
    },
    'marco-teorico': {
        id: 'marco-teorico',
        name: 'Marco teórico',
        description: 'Teorías y definiciones con las que sustentas tus variables.',
        query: 'marco teórico, bases teóricas y definición conceptual de las variables',
        cues: [
            'marco teorico',
            'base teorica',
            'bases teoricas',
            'marco conceptual',
            'fundamento teorico',
            'definicion conceptual',
            'teoria',
        ],
        focusHint: 'qué teoría eligió y por qué esa y no otra',
    },
    metodologia: {
        id: 'metodologia',
        name: 'Metodología',
        description: 'Tipo, enfoque y diseño de la investigación, y cómo analizas los datos.',
        query: 'tipo, enfoque y diseño metodológico de la investigación y tratamiento de los datos',
        cues: [
            'diseno de investigacion',
            'tipo de investigacion',
            'diseno metodologico',
            'enfoque cuantitativo',
            'enfoque cualitativo',
            'analisis de datos',
            'tratamiento de los datos',
            'operacionalizacion',
            'metodologia',
            'metodo',
            'diseno',
            'variable',
        ],
        focusHint: 'la coherencia entre el problema, los objetivos y el diseño elegido',
    },
    muestra: {
        id: 'muestra',
        name: 'Población y muestra',
        description: 'A quiénes estudias, cuántos son y cómo los seleccionaste.',
        query: 'población, muestra, muestreo y criterios de selección de los participantes',
        cues: [
            'tamano de la muestra',
            'tamano de muestra',
            'criterio de inclusion',
            'criterios de inclusion',
            'criterio de exclusion',
            'criterios de exclusion',
            'unidad de analisis',
            'poblacion',
            'muestreo',
            'muestra',
            'participante',
        ],
        focusHint: 'cómo calculó el tamaño de la muestra y cómo seleccionó a los participantes',
    },
    instrumentos: {
        id: 'instrumentos',
        name: 'Técnicas e instrumentos',
        description: 'Con qué recoges los datos y cómo sabes que mide lo que dices.',
        query: 'técnicas e instrumentos de recolección de datos, validez y confiabilidad',
        cues: [
            'tecnicas e instrumentos',
            'recoleccion de datos',
            'ficha de observacion',
            'juicio de expertos',
            'alfa de cronbach',
            'instrumento',
            'cuestionario',
            'encuesta',
            'entrevista',
            'validez',
            'confiabilidad',
        ],
        focusHint: 'cómo validó el instrumento y qué evidencia de confiabilidad tiene',
    },
    resultados: {
        id: 'resultados',
        name: 'Resultados',
        description: 'Qué encontraste, o qué esperas encontrar si aún no hay resultados.',
        query: 'resultados obtenidos, tablas, figuras y pruebas estadísticas',
        cues: [
            'dato obtenido',
            'datos obtenidos',
            'prueba estadistica',
            'pruebas estadisticas',
            'resultado',
            'hallazgo',
            'tabla',
            'figura',
            'grafico',
        ],
        focusHint: 'qué dice exactamente cada resultado y cómo lo obtuvo',
    },
    discusion: {
        id: 'discusion',
        name: 'Discusión',
        description: 'Cómo interpretas tus resultados frente a los antecedentes.',
        query: 'discusión e interpretación de los resultados frente a los antecedentes',
        cues: [
            'interpretacion de los resultados',
            'contrastacion',
            'coincide con',
            'difiere de',
            'discusion',
            'contrasta',
        ],
        focusHint: 'con qué antecedente contrasta sus resultados y qué explica la diferencia',
    },
    conclusiones: {
        id: 'conclusiones',
        name: 'Conclusiones y recomendaciones',
        description: 'Qué concluyes y qué recomiendas a partir de lo que encontraste.',
        query: 'conclusiones y recomendaciones de la investigación',
        cues: ['conclusion', 'recomendacion'],
        focusHint: 'si cada conclusión se sigue de un resultado y responde a un objetivo',
    },
    limitaciones: {
        id: 'limitaciones',
        name: 'Limitaciones',
        description: 'Qué no alcanza a responder tu estudio y qué sesgos reconoce.',
        query: 'limitaciones, alcances y sesgos declarados del estudio',
        cues: ['alcance del estudio', 'limitacion', 'restriccion', 'sesgo'],
        focusHint: 'qué limitaciones reconoce y cómo afectan a sus conclusiones',
    },
};

export const ORDERED_PREPARATION_TOPICS: PreparationTopic[] = PREPARATION_TOPIC_IDS.map(
    (id) => PREPARATION_TOPICS[id],
);

/** Narrows an untrusted value (query string, database column, judge output). */
export function isPreparationTopicId(value: unknown): value is PreparationTopicId {
    return PREPARATION_TOPIC_IDS.includes(value as PreparationTopicId);
}

/** Never throws: an unknown id yields null instead of a fabricated topic. */
export function getPreparationTopic(value: unknown): PreparationTopic | null {
    return isPreparationTopicId(value) ? PREPARATION_TOPICS[value] : null;
}

/** Name of a topic for UI copy, falling back to the raw id if it is unknown. */
export function describeTopic(value: unknown): string {
    return getPreparationTopic(value)?.name ?? String(value ?? '');
}
