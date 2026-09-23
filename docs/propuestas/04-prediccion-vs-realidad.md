# 04 — Registro de predicciones vs. resultados

> Lee antes: [`00-generalidades.md`](00-generalidades.md) · Depende de [`01`](01-exposicion-gradual-adaptativa.md)

## Qué se propone

Antes de cada simulación, tres preguntas escritas (no por voz, para no gastar tiempo de sesión):

1. *"¿Qué crees que te van a preguntar?"*
2. *"¿Qué parte te da más temor?"*
3. *"¿Qué crees que pasaría si no recuerdas una respuesta?"*

Después de la sesión, el sistema **contrasta la predicción con lo que realmente pasó**:

| Predijo | Ocurrió |
|---|---|
| "Me van a preguntar por la muestra" | Sí, pregunta 3. La respondiste completa. |
| "Me da miedo la parte de metodología" | Se preguntó 2 veces. Ambas correctas. |
| "Si no recuerdo, me voy a quedar en blanco" | Hubo 1 pregunta sin respuesta completa. La sesión continuó y respondiste las 4 siguientes. |

Y cierra con: *"¿qué vas a probar distinto en la siguiente sesión?"* — respuesta libre que se
guarda y se le recuerda al inicio de la sesión siguiente.

## Por qué aporta a reducir ansiedad

Este es, de todas las propuestas, la que ataca el mecanismo psicológico más directamente:
convierte un temor difuso ("me va a ir mal") en una **predicción concreta y verificable**, y
luego la confronta con evidencia registrada. Es el componente que más justifica que la tesis
hable de ansiedad y no solo de desempeño.

Ninguna herramienta tipo NotebookLM tiene nada parecido, porque requiere sesiones repetidas
con memoria entre ellas.

## Qué construir

1. **Tabla nueva** (`sessionPredictions` o campos en `voiceSessions`): las 3 predicciones
   antes, el contraste después, y la estrategia declarada para la próxima sesión.
2. **Formulario previo** breve (3 campos de texto, opcional saltarlo).
3. **Contraste automático:**
   - Predicción 1 vs. temas realmente preguntados → usar el `topic` de la propuesta
     [`03`](03-mapa-de-preparacion.md).
   - Predicción 2 vs. desempeño en ese tema.
   - Predicción 3 vs. lo que realmente ocurrió (¿hubo respuesta incompleta? ¿la sesión
     siguió? ¿cómo fueron las respuestas posteriores?).
   El contraste lo redacta el LLM, **pero con los datos ya calculados**, no inventándolos.
4. **Al iniciar la siguiente sesión**, mostrar la estrategia que el estudiante declaró la
   vez anterior.

## Criterios de aceptación

- [x] Las 3 predicciones se guardan antes de la sesión y son opcionales.
- [x] El contraste usa datos reales de la sesión, no estimaciones del LLM. (Se implementó **sin
      LLM**: ver "Estado de implementación" más abajo.)
- [x] La estrategia declarada reaparece al inicio de la sesión siguiente.
- [x] El texto del contraste nunca ridiculiza ni dramatiza el temor declarado.

## Qué NO hacer

- No usar esto como intervención terapéutica ni llamarlo "reestructuración cognitiva" en la
  tesis. Es un registro de predicción y contraste con evidencia, nada más.
- No obligar a responder para poder practicar.

---

## Estado de implementación

**Implementada.** Fecha: 2026-09-19.

### Qué se construyó

| Pieza | Archivo |
|---|---|
| Las 3 preguntas previas + la pregunta de cierre, normalización y etiquetado | `lib/prediction/questions.ts` |
| Contraste predicción ↔ evidencia (puro, determinista) | `lib/prediction/contrast.ts` |
| Clasificador multi-tema (una predicción nombra varios temas) | `lib/preparation/classify.ts` (`classifyMentionedTopics`) |
| Emparejado pregunta ↔ respuesta, ahora compartido | `lib/preparation/map.ts` (`buildQuestionAnswerPairs`) |
| Tabla `session_predictions` | `database/schema/sessionPredictions.ts`, `drizzle/0008_whole_cassandra_nova.sql` |
| Guardado de las 3 predicciones al iniciar la sesión | `lib/actions/session.actions.ts` (`startVoiceSession`) |
| Estrategia declarada al cerrar + lectura del contraste | `lib/actions/prediction.actions.ts` |
| Formulario previo (3 campos opcionales) y recordatorio de la estrategia anterior | `components/SessionSetup.tsx` |
| Pregunta de cierre "¿qué vas a probar distinto?" | `components/PostSessionSurvey.tsx` |
| Sección "Predicción y resultado" del historial | `components/PredictionContrast.tsx`, `app/(root)/history/[sessionId]/page.tsx` |

### Desviación respecto de la propuesta: el contraste no lo redacta el LLM

La propuesta decía "el contraste lo redacta el LLM, pero con los datos ya calculados". **Se
implementó sin LLM: las frases se generan en TypeScript a partir de las filas registradas.**

El motivo es que el primer criterio de aceptación ("el contraste usa datos reales de la sesión, no
estimaciones del LLM") se cumple de forma más fuerte así, y el cuarto ("el texto nunca ridiculiza
ni dramatiza el temor declarado") pasa de ser una instrucción de prompt —que hay que verificar
sesión a sesión— a ser una propiedad del código. Además el contraste queda **reproducible**: la
misma sesión produce siempre el mismo texto, y cada número se puede verificar contra la
transcripción. Es el mismo criterio de la dimensión 3 del doc [`02`](02-retroalimentacion-tres-dimensiones.md).

Si en algún momento se quiere prosa más natural, el lugar para agregarla es una capa **sobre**
`buildPredictionContrast`, que recibiría las frases ya calculadas y solo podría reescribirlas, no
producir hechos nuevos.

### Cómo se contrasta cada predicción

1. **"¿Qué crees que te van a preguntar?"** → el texto se etiqueta con el clasificador léxico de la
   taxonomía del doc [`03`](03-mapa-de-preparacion.md) (`classifyMentionedTopics`, que devuelve
   **todos** los temas nombrados, no solo el más fuerte). Para cada tema predicho se reporta si se
   preguntó, en qué número de pregunta, si lo respondió y el nivel de contenido del informe. Los
   temas que **sí** se preguntaron y el estudiante no nombró se listan aparte.
2. **"¿Qué parte te da más temor?"** → se etiqueta con un solo tema (`classifyQuestionTopicId`) y
   se reporta el desempeño en ese tema, con el mismo formato.
3. **"¿Qué crees que pasaría si no recuerdas una respuesta?"** → no es un tema, así que se
   contrasta contra dos hechos de la transcripción: si hubo preguntas sin responder o respuestas
   de menos de `INCOMPLETE_ANSWER_MAX_WORDS` palabras (mismo criterio que
   `lib/difficulty/signals.ts`), y **qué hizo la sesión después de la primera de ellas**. Esa
   última frase es la que carga la evidencia: que la sesión continuó es justo lo que el estudiante
   no podía saber de antemano, y se dice como conteo de preguntas, nunca como consuelo.

Una predicción que no coincide con ninguna pista léxica **no se archiva bajo un tema adivinado**:
se muestra tal cual y el contraste dice que no hay coincidencia automática.

### Reglas de tono que impone el código

- El texto del estudiante se **cita literal** y nunca se caracteriza. Ninguna frase generada dice
  que la predicción fue equivocada, exagerada o infundada.
- Los veredictos (`matched`, `partial`, `not-observed`, `unmatched`, `skipped`) son afirmaciones
  sobre **eventos de la transcripción**, no sobre el estudiante: "Ocurrió" / "No ocurrió", nunca
  "acertaste" / "te equivocaste".
- Las palabras "ansiedad", "nervioso", "miedo" y derivadas no aparecen en ninguna frase generada
  por `contrast.ts`; solo pueden aparecer dentro del texto citado del propio estudiante
  (doc [`00`](00-generalidades.md), regla 1).

### Datos que quedan en base de datos

`session_predictions`, una fila por sesión como máximo:

- `expected_questions`, `feared_part`, `blank_outcome` — las tres predicciones literales.
- `expected_topics` (JSON), `feared_topic` — las etiquetas de la taxonomía **en el momento en que
  se escribieron**. Se guardan en lugar de recalcularse porque las pistas léxicas están versionadas
  en código: si cambian, el contraste que el estudiante realmente leyó sigue siendo reconstruible.
- `next_strategy`, `strategy_at` — la estrategia declarada al cerrar, de escritura única.

**El contraste no se guarda**: se recalcula en cada lectura desde `session_turns` y `turn_feedback`.
Una frase guardada junto a la predicción quedaría desfasada en cuanto se evaluara una respuesta
pendiente.

### Cumplimiento de los criterios de aceptación

- [x] Las 3 predicciones se guardan antes de la sesión (en `startVoiceSession`, antes de conectar
      con Vapi) y son opcionales: si no se responde ninguna, no se escribe fila y la sesión arranca
      igual. El guardado es *best effort* — un fallo se registra en consola pero nunca impide
      practicar.
- [x] El contraste usa datos reales de la sesión: no interviene ningún modelo.
- [x] La estrategia declarada reaparece al inicio de la sesión siguiente con esa investigación
      (`getSessionPreparation` → `SessionSetup`).
- [x] El texto del contraste no ridiculiza ni dramatiza: ver "Reglas de tono" arriba.

### Lo que NO se hizo

- **No hay tests.** El proyecto tiene `lib/difficulty.test.mts` y `lib/feedback.test.mts` para la
  lógica pura equivalente; `lib/prediction/contrast.ts` y `questions.ts` se verificaron solo con
  `npx tsc --noEmit` y una corrida manual. Un `lib/prediction.test.mts` que afirme el vocabulario
  prohibido sobre cada frase generada —como hace el de feedback— es la deuda más clara.
- **La migración no se aplicó.** Queda generada (`drizzle/0008_whole_cassandra_nova.sql`); falta
  correr `npm run db:migrate`.
- **La numeración de preguntas incluye la apertura del agente.** El `firstMessage` de cada nivel
  pide exponer la investigación, así que cuenta como intervención a responder; aun así, lo que el
  estudiante lee como "pregunta 2" es la segunda intervención del jurado, no la segunda pregunta
  de contenido.
- **El contraste depende del juez del doc `02`** para los niveles de contenido. Mientras una
  respuesta no esté evaluada, la frase lo dice ("todavía no está evaluada") en lugar de omitirla.
- **No se exporta al CSV de métricas.** Las filas están y son consultables, pero
  `lib/metrics/exports.ts` todavía no incluye predicciones ni estrategias.
- **No hay vista de evolución entre sesiones** de predicción → estrategia → siguiente predicción.
  Los datos lo permiten sin migración; la UI muestra el contraste de una sesión a la vez.
