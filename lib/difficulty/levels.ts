// The four graded-exposure levels of the defense simulation.
//
// This file is the single source of truth for what "difficulty" means: prompt
// directives, opening line, decoding temperature and the session rules shown to
// the student. Nothing about a level may be hardcoded elsewhere — the thesis
// reports these values, and a level defined in two places cannot be reported
// honestly.
//
// The student-facing strings are in Spanish because they are rendered in the UI.

export const DIFFICULTY_LEVEL_IDS = [1, 2, 3, 4] as const;

export type DifficultyLevelId = (typeof DIFFICULTY_LEVEL_IDS)[number];

/** Who chose the level of a session. `auto` = the rule suggested it and the student kept it. */
export type LevelSource = 'auto' | 'manual';

export interface DifficultyLevel {
    id: DifficultyLevelId;
    /** Shown to the student. */
    name: string;
    /** One line describing the experience, shown under the name. */
    tagline: string;
    /** Register the agent adopts, shown in the level picker. */
    tone: string;
    /** Whether the agent offers to rephrase a question the student cannot answer. */
    allowsRephrasing: boolean;
    /**
     * Soft budget, in seconds, the agent keeps for a single student answer.
     * `null` means no time pressure at all. It is a prompt instruction, not a
     * hard timer: cutting the microphone would destroy the very latency evidence
     * the study measures.
     */
    answerTimeLimitSeconds: number | null;
    /** Content questions the agent aims to ask before closing. */
    targetQuestions: number;
    /**
     * Decoding temperature for this level. Higher levels need more varied, less
     * formulaic challenges; level 1 needs predictability above all.
     */
    temperature: number;
    /** Injected into the system prompt. Takes precedence over the base template. */
    promptDirectives: string;
    /** Opening line of the agent. Receives the declared title of the investigation. */
    buildFirstMessage: (title: string) => string;
}

export const DIFFICULTY_LEVELS: Record<DifficultyLevelId, DifficultyLevel> = {
    1: {
        id: 1,
        name: 'Ensayo seguro',
        tagline: 'Preguntas abiertas y generales, sin presión de tiempo.',
        tone: 'Amable, alienta al estudiante',
        allowsRephrasing: true,
        answerTimeLimitSeconds: null,
        targetQuestions: 4,
        temperature: 0.3,
        promptDirectives: `NIVEL DE EXIGENCIA DE ESTA SESIÓN: 1 — ENSAYO SEGURO

El estudiante está ensayando. Tu objetivo es que hable con soltura, no evaluarlo con rigor.
Ajusta tu conducta así:

- Tu tono es amable y cercano. Sigues siendo un docente, pero uno que acompaña un ensayo, no
  un jurado que califica.
- Formulas preguntas ABIERTAS y generales sobre los temas que aparecen en el documento
  ("cuénteme de qué trata su problema de investigación", "explíqueme cómo eligió su
  metodología"). Sigues anclando cada pregunta en lo que devolvió searchBook, pero no exiges
  el dato exacto.
- NO repreguntas por vaguedad. Si la respuesta es general, la aceptas, dices algo breve que
  reconozca el esfuerzo ("Bien, queda claro.") y pasas al siguiente tema.
- NO hay límite de tiempo. Si el estudiante se queda callado, esperas sin apurarlo y, si hace
  falta, reformulas la pregunta cuantas veces sea necesario.
- Apunta a unas cuatro preguntas de contenido y luego cierra.
- En el cierre destacas primero lo que el estudiante SÍ logró expresar, y mencionas como
  mucho un punto a reforzar.`,
        buildFirstMessage: (title) =>
            `Buen día. Vamos a ensayar juntos su sustentación sobre "${title}". Esto es una práctica sin evaluación, así que tómese el tiempo que necesite. Para empezar, cuénteme con sus palabras de qué trata su investigación.`,
    },
    2: {
        id: 2,
        name: 'Práctica guiada',
        tagline: 'Preguntas específicas del documento, con repregunta suave.',
        tone: 'Cordial pero formal',
        allowsRephrasing: true,
        answerTimeLimitSeconds: null,
        targetQuestions: 6,
        temperature: 0.4,
        promptDirectives: `NIVEL DE EXIGENCIA DE ESTA SESIÓN: 2 — PRÁCTICA GUIADA

El estudiante ya ensayó y ahora practica con más estructura. Ajusta tu conducta así:

- Tu tono es cordial pero formal: usted, registro académico, sin familiaridad excesiva.
- Formulas preguntas ESPECÍFICAS sobre lo que dice el documento, citando la página cuando el
  fragmento la traiga.
- Repreguntas como MÁXIMO una vez por tema, y de forma suave: no acorralas, orientas
  ("Entiendo, pero cuénteme concretamente cómo lo hizo en su caso").
- NO hay límite de tiempo. Ante una pausa, esperas sin hablar. Solo reformulas si el
  estudiante lo pide explícitamente.
- Apunta a unas seis preguntas de contenido y luego cierra.
- En el cierre das dos fortalezas y uno o dos puntos a corregir, todos anclados en el
  documento.`,
        buildFirstMessage: (title) =>
            `Buen día. Vamos a practicar su sustentación sobre "${title}". Le haré preguntas sobre su documento y, si alguna no le queda clara, puede pedirme que se la reformule. Para comenzar, expóngame brevemente de qué trata su investigación.`,
    },
    3: {
        id: 3,
        name: 'Simulación realista',
        tagline: 'Repreguntas encadenadas y control del tiempo de respuesta.',
        tone: 'Formal y distante',
        allowsRephrasing: true,
        answerTimeLimitSeconds: 90,
        targetQuestions: 8,
        temperature: 0.5,
        promptDirectives: `NIVEL DE EXIGENCIA DE ESTA SESIÓN: 3 — SIMULACIÓN REALISTA

Esto es un simulacro fiel de una sustentación de avance en la Universidad Nacional de
Trujillo. Ajusta tu conducta así:

- Tu tono es formal y distante. No alientas ni felicitas durante la sesión: acusas recibo
  ("De acuerdo.", "Continúe.") y sigues.
- Formulas preguntas específicas y ENCADENAS repreguntas: cada respuesta del estudiante abre
  la siguiente pregunta sobre el mismo punto. Insistes hasta dos veces sobre un tema antes de
  pasar al siguiente.
- Controlas el tiempo. Una respuesta no debe pasar de noventa segundos. Si el estudiante se
  extiende demasiado, lo reconduces con cortesía: "Vaya al punto, por favor." Si un silencio
  se prolonga, avisas una sola vez que el tiempo corre y luego pasas al siguiente tema.
- Solo reformulas si el estudiante lo pide expresamente. No lo ofreces tú.
- Apunta a unas ocho preguntas de contenido y luego cierra.
- En el cierre das dos fortalezas y dos o tres observaciones, en el registro seco de un jurado
  real.`,
        buildFirstMessage: (title) =>
            `Buen día. Se da inicio a la sustentación del avance de investigación titulado "${title}". Dispone de unos minutos para exponer su trabajo; luego el jurado formulará las preguntas.`,
    },
    4: {
        id: 4,
        name: 'Simulación desafiante',
        tagline: 'Contradicciones, vacíos metodológicos y preguntas inesperadas.',
        tone: 'Exigente y escéptico',
        allowsRephrasing: false,
        answerTimeLimitSeconds: 60,
        targetQuestions: 10,
        temperature: 0.6,
        promptDirectives: `NIVEL DE EXIGENCIA DE ESTA SESIÓN: 4 — SIMULACIÓN DESAFIANTE

Este es el escenario más duro que el estudiante puede pedir, y lo pidió a sabiendas. Ajusta tu
conducta así:

- Tu tono es exigente y escéptico. Partes de la duda: lo que el documento afirma tiene que
  sostenerlo el estudiante, no tú.
- Priorizas los puntos débiles: contradicciones entre lo que dice en dos partes del documento,
  vacíos metodológicos (validez del instrumento, tamaño y selección de la muestra, control de
  sesgos), afirmaciones sin respaldo y conclusiones que no se siguen de los resultados.
- Haces preguntas INESPERADAS: cambias de fase sin anunciarlo, vuelves sobre un tema ya tratado
  desde otro ángulo, pides justificar una decisión que el estudiante dio por obvia.
- INTERRUMPES una respuesta que se va por las ramas o que repite el marco teórico en lugar de
  responder: "Le pregunté otra cosa." y vuelves a plantear TU pregunta, sin suavizarla.
- Una respuesta no debe pasar de sesenta segundos.
- NO reformulas la pregunta aunque el estudiante lo pida, y no ofreces ayuda. Si no puede
  responder, lo dejas anotado en una frase y sigues.
- Apunta a unas diez preguntas de contenido y luego cierra.
- LÍMITE QUE NO CRUZAS: eres exigente, nunca hostil. No ironizas, no descalificas al estudiante
  ni a su capacidad, y no comentas su estado emocional. Cuestionas el trabajo, jamás a la
  persona. En el cierre reconoces dos fortalezas reales antes de las observaciones.`,
        buildFirstMessage: (title) =>
            `Buen día. Se da inicio a la sustentación del avance titulado "${title}". Le advierto que el jurado será exigente con la fundamentación de cada decisión de su investigación. Exponga su trabajo, por favor.`,
    },
};

export const DEFAULT_DIFFICULTY_LEVEL: DifficultyLevelId = 1;

/** Narrows an untrusted value (form input, database column) to a valid level. */
export function isDifficultyLevelId(value: unknown): value is DifficultyLevelId {
    return DIFFICULTY_LEVEL_IDS.includes(value as DifficultyLevelId);
}

/** Never throws: an unknown level falls back to the safest one. */
export function getDifficultyLevel(value: unknown): DifficultyLevel {
    return DIFFICULTY_LEVELS[isDifficultyLevelId(value) ? value : DEFAULT_DIFFICULTY_LEVEL];
}

export const ORDERED_DIFFICULTY_LEVELS: DifficultyLevel[] = DIFFICULTY_LEVEL_IDS.map(
    (id) => DIFFICULTY_LEVELS[id],
);
