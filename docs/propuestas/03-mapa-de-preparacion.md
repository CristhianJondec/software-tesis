# 03 — Mapa de preparación para la sustentación

> Lee antes: [`00-generalidades.md`](00-generalidades.md)

## Qué se propone

Una vista que responde una sola pregunta: **"¿qué tan listo estoy para sustentar, y dónde
exactamente estoy flojo?"**

Cada tema de la investigación se clasifica en cuatro estados:

| Estado | Significado |
|---|---|
| **Domina** | Respondió correctamente y con respaldo del documento |
| **Parcial** | Respondió, pero incompleto o sin anclar al documento |
| **No practicado** | El tema existe en el documento pero nunca fue preguntado |
| **Hueco en el documento** | El agente preguntó y **el documento no tiene con qué responder** |

El cuarto estado es el más valioso: le avisa al estudiante que el jurado va a preguntar algo
que su propia tesis no cubre. Eso ninguna herramienta de resumen se lo dice.

## Por qué diferencia de NotebookLM

NotebookLM te resume lo que **está** en el documento. Esto te muestra lo que **falta** y lo que
**no sabes defender oralmente**. La unidad de análisis no es el texto, es tu desempeño.

## Qué construir

1. **Taxonomía de temas.** Derivar los temas de la estructura canónica de una tesis:
   problema, objetivos (general y específicos), justificación, antecedentes, marco teórico,
   metodología, muestra, instrumentos, resultados, discusión, conclusiones, limitaciones.
   Al ingerir el PDF, mapear qué secciones/páginas cubren cada tema.
2. **Cada pregunta del agente queda etiquetada con su tema.** Guardar `topic` en el turno.
3. **Cálculo de estado por tema** a partir de `turnEvaluations` (propuesta
   [`02`](02-retroalimentacion-tres-dimensiones.md)). Función pura + tests.
4. **"Hueco en el documento"** se detecta cuando el retriever no devuelve ningún fragmento por
   encima del umbral de relevancia para ese tema. Ya existe umbral en el retriever.
5. **Vista `/preparacion`**: los temas en los 4 estados, con las páginas del PDF asociadas y
   la lista de preguntas que conviene volver a practicar.
6. **Botón "practicar solo estos temas"** que inicia una sesión filtrada por los temas débiles.

## Datos que debe dejar

`topic` por turno, estado por tema y por estudiante, evolución del mapa entre sesiones.
Evidencia directa para el capítulo de resultados.

## Criterios de aceptación

- [x] El mapa distingue los 4 estados, incluyendo "hueco en el documento".
- [x] Cada tema muestra las páginas del PDF relacionadas.
- [x] Se puede iniciar una sesión enfocada solo en los temas débiles.
- [x] El mapa cambia visiblemente entre la sesión 1 y la sesión 3. (La vista de evolución existe;
      que cambie depende de correr las sesiones, todavía no hay datos reales.)

## Qué NO hacer

- No presentarlo como un resumen del documento. Es un diagnóstico de preparación oral.
- No inventar temas que el documento no tiene: si falta, se marca como hueco.


---

## Estado de implementación

**Implementada.** Fecha: 2026-09-19.

### Qué se construyó

| Pieza | Archivo |
|---|---|
| Taxonomía de 12 temas (nombre, consulta de cobertura, pistas léxicas, foco) | `lib/preparation/topics.ts` |
| Clasificador léxico que etiqueta cada pregunta del agente | `lib/preparation/classify.ts` |
| Cobertura del documento por tema (pura) | `lib/preparation/coverage.ts` |
| Medición de cobertura contra el retriever y caché en base de datos | `lib/preparation/compute.ts` |
| Regla de los 4 estados y selección de temas débiles | `lib/preparation/status.ts` |
| Armado del mapa: estados, páginas, preguntas a repasar, evolución | `lib/preparation/map.ts` |
| Sesión enfocada: normalización, persistencia y directivas del prompt | `lib/preparation/focus.ts` |
| Tabla `book_topic_coverage` | `database/schema/bookTopicCoverage.ts`, `drizzle/0007_mute_maestro.sql` |
| Columna `topic` en `session_turns` y `focus_topics` en `voice_sessions` | `database/schema/sessionTurns.ts`, `database/schema/voiceSessions.ts` |
| Server actions (leer mapa / volver a analizar el documento) | `lib/actions/preparation.actions.ts` |
| Vista `/preparacion` | `app/(root)/preparacion/page.tsx`, `components/PreparationMap.tsx` |
| Bloque `{{focusDirectives}}` del prompt | `lib/agent-prompt.ts`, `docs/agente/prompt-evaluador.md` |
| Enlaces desde la sesión y desde el menú de perfil | `components/VapiControls.tsx`, `components/Navbar.tsx` |

### Cómo se decide cada estado

La regla vive en `resolveTopicState` y se aplica **en este orden**, porque dos estados pueden ser
ciertos a la vez y la prioridad es lo que hace honesto al mapa:

1. **Hueco en el documento** — el retriever no devuelve ningún fragmento del documento por debajo
   del umbral de relevancia para la consulta canónica del tema. Se evalúa **primero**: un tema que
   el estudiante respondió bien de memoria sigue siendo un hueco si su tesis no lo sostiene, y eso
   es exactamente lo que el jurado va a encontrar.
2. **No practicado** — el documento lo cubre, pero ninguna sesión preguntó por él.
3. **Domina** — nivel medio de contenido ≥ 2 sobre 3 (`MASTERY_MIN_MEAN_LEVEL`) **y** al menos un
   veredicto anclado a un fragmento del documento. Las dos condiciones son las dos mitades de la
   definición de la propuesta ("correctamente **y** con respaldo del documento").
4. **Parcial** — todo lo demás. Es el estado por defecto a propósito: cuando la evidencia no
   alcanza para "domina", el mapa dice "parcial"; nunca promueve un tema con evidencia delgada ni
   reporta uno como reprobado.

Preguntado pero nunca respondido cae en **parcial**, no en "no practicado": es práctica que salió
mal, no ausencia de práctica.

### Por qué el clasificador de temas es léxico y no un LLM

Cada pregunta de cada sesión tiene que llevar tema, y el mapa es evidencia del capítulo de
resultados. Un juez por turno costaría dinero en cada sesión, **no reproduciría** (la misma
transcripción podría dar otro mapa el mes que viene) y no se podría volver a verificar a mano.
`classifyQuestionTopic` es una función pura sobre una lista de pistas declarada en `topics.ts`: la
misma pregunta cae siempre en el mismo tema y cualquiera puede leer el archivo y comprobar por qué.

El precio es la cobertura: una pregunta sin ninguna pista se queda **sin tema** en lugar de recibir
uno adivinado. Es el error correcto — una pregunta sin etiquetar simplemente no se cuenta, mientras
que una mal etiquetada reportaría al estudiante como practicado en algo que nunca discutió. La
vista muestra cuántas preguntas quedaron sin clasificar, para que ese costo sea visible y no
silencioso.

### La sesión enfocada no toca el anclaje

`buildFocusDirectives` agrega un bloque al system prompt que limita **de qué** se pregunta. No
altera **de dónde** sale el contenido: el agente sigue obligado a llamar a `searchBook` antes de
cada pregunta y sigue sin poder preguntar por lo que no aparezca en los fragmentos recuperados.

Por eso **los huecos no son practicables** y la UI lo dice: sin nada que recuperar, el agente
tendría que callarse o inventar, y inventar está prohibido por el prompt. Un hueco se arregla
desarrollando esa sección de la tesis y volviéndola a subir, no practicándola.

### Datos que quedan en base de datos

- `session_turns.topic` — tema de cada pregunta del agente.
- `voice_sessions.focus_topics` — temas a los que se limitó la sesión (NULL = sesión completa).
  Guardado para que una sesión enfocada nunca se compare con una completa como si fueran el mismo
  simulacro.
- `book_topic_coverage` — una fila por (documento, tema) con `covered`, `best_distance`, las
  páginas, los segmentos y el umbral que produjo la medición. El umbral se guarda **con la fila**
  para que una medición tomada antes de calibrarlo siga siendo legible en lugar de reinterpretarse
  en silencio.

El estado por tema y la evolución entre sesiones se **derivan** de esas filas en cada lectura, no
se guardan: son aritmética sobre la evidencia y guardarlos los dejaría a la deriva respecto de ella.
Mismo criterio que la dimensión 3 del doc [`02`](02-retroalimentacion-tres-dimensiones.md).

### Cuándo se mide la cobertura

Al terminar la ingesta del PDF (`saveBookSegments`), de forma no fatal: si falla, el documento
queda igualmente usable y la vista ofrece un botón para reintentarlo. El botón existe además
porque la medición puede quedar obsoleta de dos maneras que la app no detecta sola: el estudiante
sube una versión corregida de su tesis, o se recalibra `RETRIEVER_MAX_DISTANCE` después del piloto.

### Lo que NO se hizo

- **No se calibró la taxonomía contra tesis reales.** Las 12 consultas canónicas y las pistas
  léxicas se escribieron desde la estructura de una tesis UNT, con la base vacía. Hay que ingerir
  tesis reales, revisar qué temas quedan marcados como hueco siendo falsos positivos, y ajustar la
  consulta del tema (no el umbral, que es del retriever y se calibra aparte).
- **El mapa depende del juez del doc `02`**, que corre a pedido. Mientras una sesión no esté
  evaluada, sus respuestas cuentan como practicadas pero sin nivel, así que el tema se queda en
  "parcial". La vista lo dice y enlaza al historial.
- **No hay medición de acuerdo con un docente humano** sobre si el estado asignado a un tema es el
  que un jurado diría. La tabla lo permite sin migración, pero esa UI no existe.
- **No se exporta el mapa al CSV de métricas.** Las filas están y son consultables, pero
  `lib/metrics/exports.ts` todavía no las incluye.
