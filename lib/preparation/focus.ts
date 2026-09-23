/**
 * Focused sessions: the "practicar solo estos temas" button of the map.
 *
 * A focused session is an ordinary graded-exposure session with one extra block
 * in the system prompt naming the topics to cover. It does NOT change the
 * anchoring rule: the agent still has to call `searchBook` before every question
 * and is still forbidden from inventing what the document does not say. The
 * focus narrows WHAT it asks about, never WHERE it gets the content from.
 *
 * Gaps are never focusable — `selectWeakTopics` leaves them out — precisely
 * because there would be nothing to retrieve and the agent would be pushed
 * against that rule.
 *
 * Pure module: no database, no network.
 */

import {
    PREPARATION_TOPIC_IDS,
    PREPARATION_TOPICS,
    isPreparationTopicId,
    type PreparationTopicId,
} from './topics.ts';

/**
 * Topics a single focused session may carry. Four is already more than the
 * question budget of level 1 (`targetQuestions: 4`); beyond that the "focus"
 * would be the whole taxonomy again.
 */
export const MAX_FOCUS_TOPICS = 4;

/**
 * Narrows anything a client, a query string or a database column may hand over:
 * unknown ids are dropped, duplicates collapse, the taxonomy order is restored
 * and the list is capped. Never throws.
 */
export function normalizeFocusTopics(value: unknown): PreparationTopicId[] {
    const raw: unknown[] = Array.isArray(value)
        ? value
        : typeof value === 'string'
          ? value.split(',')
          : [];

    const wanted = new Set<PreparationTopicId>();
    for (const item of raw) {
        const id = typeof item === 'string' ? item.trim() : item;
        if (isPreparationTopicId(id)) wanted.add(id);
    }

    return PREPARATION_TOPIC_IDS.filter((id) => wanted.has(id)).slice(0, MAX_FOCUS_TOPICS);
}

/** Serialises for `voice_sessions.focus_topics`. Empty list stores as NULL. */
export function serializeFocusTopics(topics: ReadonlyArray<PreparationTopicId>): string | null {
    return topics.length > 0 ? JSON.stringify(topics) : null;
}

/** Reads the column back. A corrupt value reads as "no focus", never as a crash. */
export function parseFocusTopics(value: string | null): PreparationTopicId[] {
    if (!value) return [];
    try {
        return normalizeFocusTopics(JSON.parse(value));
    } catch {
        return [];
    }
}

/**
 * The prompt block injected as `{{focusDirectives}}`.
 *
 * Returns an empty string for an unfocused session, so the prompt of a normal
 * session is byte-identical to what it was before focused sessions existed and
 * the two are comparable in the thesis.
 */
export function buildFocusDirectives(topics: ReadonlyArray<PreparationTopicId>): string {
    const focus = normalizeFocusTopics(topics);
    if (focus.length === 0) return '';

    const list = focus
        .map((id) => {
            const topic = PREPARATION_TOPICS[id];
            return `- ${topic.name}: pregunta por ${topic.focusHint}.`;
        })
        .join('\n');

    return `# TEMAS A LOS QUE SE LIMITA ESTA SESIÓN

El estudiante pidió practicar únicamente estos temas de su investigación:

${list}

Reglas de esta sesión enfocada:

- Todas tus preguntas de contenido son sobre esos temas, en ese orden, y vuelves sobre ellos
  desde otro ángulo antes que abrir un tema que no esté en la lista.
- Sigues llamando a \`searchBook\` antes de cada pregunta. El tema lo fija esta lista; el
  contenido lo sigue fijando el documento, y no puedes preguntar por lo que no aparezca en
  los fragmentos recuperados.
- Si \`searchBook\` no devuelve nada sobre uno de estos temas, lo señalas como vacío del
  documento y pasas al siguiente tema de la lista.
- Cuando hayas cubierto la lista, cierras la sesión. No la alargues con otros temas.
- NUNCA menciones que esta sesión está enfocada, ni leas esta lista en voz alta. Para el
  estudiante esto es una sustentación, no una configuración.`;
}

/** Short Spanish label for the UI: "Metodología y Población y muestra". */
export function describeFocusTopics(topics: ReadonlyArray<PreparationTopicId>): string {
    const names = normalizeFocusTopics(topics).map((id) => PREPARATION_TOPICS[id].name);
    if (names.length === 0) return '';
    if (names.length === 1) return names[0];
    return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}
