# 05 — Retroalimentación positiva basada en evidencia

> Lee antes: [`00-generalidades.md`](00-generalidades.md) · Depende de [`01`](01-exposicion-gradual-adaptativa.md) y [`02`](02-retroalimentacion-tres-dimensiones.md)

## Qué se propone

El agente no puede ser solo un jurado que señala fallas: eso **sube** la ansiedad. Al cerrar
cada sesión debe mostrar avances concretos, cada uno respaldado por un dato registrado.

Ejemplos del formato correcto:

- "Respondiste correctamente 3 preguntas de metodología."
- "Identificaste una limitación de tu estudio sin que te la preguntara."
- "Empezaste a responder en 4 s promedio; en la sesión anterior fueron 9 s."
- "Usaste tus objetivos específicos para estructurar 2 respuestas."
- "Practicaste 2 temas que la semana pasada estaban sin practicar."

Formato **prohibido**: "¡Excelente trabajo!", "vas muy bien", "se nota tu esfuerzo".
Elogio sin dato no construye confianza y contamina la medición.

## Por qué diferencia de NotebookLM

Requiere **historial entre sesiones**. Comparar la sesión 3 con la sesión 1 solo es posible
porque el sistema es un entrenador con memoria longitudinal, no un chat sin estado.

## Qué construir

1. **Generador de evidencias**: función pura que recibe (sesión actual, sesiones previas del
   mismo estudiante) y devuelve una lista de logros verificables, cada uno con el dato que
   lo respalda. Con tests.
2. **Reglas de selección**: máximo 4 evidencias por sesión, priorizando (a) mejoras respecto
   a la sesión anterior, (b) logros absolutos de esta sesión. Si no hay ninguna mejora, se
   muestran logros absolutos; **nunca se inventa una mejora**.
3. **Vista de progreso** (`/progreso`): evolución por sesión de latencia media de inicio,
   puntajes por dimensión, temas dominados y autoevaluación 0–10. Gráficos simples.
4. **El agente cierra la sesión por voz** leyendo 2 de esas evidencias antes de despedirse.

## Criterios de aceptación

- [ ] Cada evidencia mostrada cita un número o un hecho registrado.
- [ ] Si no hubo mejora, el sistema no la fabrica.
- [ ] La vista de progreso muestra al menos 3 series temporales por estudiante.
- [ ] El cierre por voz incluye evidencias, no elogios genéricos.

## Qué NO hacer

- No mostrar el puntaje de STAI / PRCS-12 al estudiante durante la intervención: contamina
  la medición T2.
- No maquillar resultados malos. Si empeoró, se dice con dato y se ofrece bajar de nivel.

---

## Estado de la implementación

> Anotado al terminar la tarea. Verificado con `npx tsc --noEmit`.

### Qué se construyó

**Módulos puros** (sin base de datos, sin red, sin modelo):

| Archivo | Qué hace |
|---|---|
| `lib/progress/summary.ts` | Reduce una sesión a los números que se comparan. No mide nada nuevo: reusa `summarizeSessionSignals`, `buildQuestionAnswerPairs`, la rúbrica y la taxonomía. |
| `lib/progress/evidence.ts` | El generador de evidencias y las reglas de selección. También detecta la regresión. |
| `lib/progress/series.ts` | Las seis series temporales de `/progreso`. |
| `lib/progress/closing.ts` | Compone la frase que el agente pronuncia al cerrar. |

**Acciones** (`lib/actions/progress.actions.ts`, con verificación de propiedad como
`feedback`/`preparation`/`prediction`): `getSessionEvidence`, `recordSessionClosing`,
`getProgressOverview`.

**UI**: `components/ProgressEvidence.tsx` (sección *Evidencias de avance* del detalle de
sesión), `components/ProgressCharts.tsx` y `app/(root)/progreso/page.tsx`. Enlaces desde el
navbar, la pantalla de la sesión y la vista de progreso.

**Migración**: `drizzle/0009_dizzy_kid_colt.sql` crea `session_closings`.

### Por qué el cierre por voz no lo redacta el LLM

El texto se compone en `lib/progress/closing.ts` y se entrega literal al TTS con
`vapi.say(texto, true)` — el segundo argumento cuelga la llamada cuando termina de hablar.
Pedirle al modelo "lee estas dos evidencias" dejaría el criterio de aceptación en manos de un
sampler; componer la frase en código lo vuelve una propiedad del repositorio. Es la misma
decisión de `lib/prediction/contrast.ts`, y por eso el cierre **sí** se guarda: es un evento
irrepetible, no un resumen recalculable.

Una evidencia queda fuera del audio: `higher-level-sustained` nombra el nivel de exigencia, y
el prompt le prohíbe al agente mencionar que existen niveles. El cierre sigue siendo su voz, así
que la prohibición vale hasta que la llamada termina; el logro se muestra igual en pantalla.

### Qué se guarda y qué se recalcula

- **Se guarda** `session_closings`: el texto hablado literal, las evidencias leídas en JSON, el
  conteo y `generator_version`. Ocurrió una vez, delante del estudiante, con la evidencia
  disponible en ese segundo.
- **Se recalcula en cada lectura** la lista de evidencias de la pantalla. Evaluar una respuesta
  pendiente tiene que afilarla, no dejar una frase guardada que ya no coincide.

Consecuencia deliberada: el cierre hablado ocurre con la llamada todavía abierta, así que el
juez del doc `02` aún no evaluó las respuestas de esa sesión y las evidencias de **contenido y
claridad normalmente no alcanzan a entrar en el audio**. La pantalla muestra la lista completa
después. Como ambos quedan registrados, la diferencia es auditable en lugar de invisible.

### Márgenes (provisionales, sin calibrar)

`LATENCY_IMPROVEMENT_MIN_MS = 500`, `LEVEL_IMPROVEMENT_MIN = 0,25` sobre 3,
`RATE_IMPROVEMENT_MIN = 0,1`, y mínimos de `2` respuestas / `3` preguntas por lado antes de
comparar. Existen para que el ruido del transcriptor y una sola respuesta afortunada no se
reporten como progreso. La base está vacía: hay que recalibrarlos con las sesiones piloto.

Las comparaciones son siempre sobre **promedios y proporciones**, nunca sobre conteos brutos:
una sesión enfocada (doc `03`) hace menos preguntas que una completa, y comparar conteos las
haría parecer un retroceso.

### Cumplimiento de los criterios de aceptación

- [x] **Cada evidencia cita un número o un hecho registrado.** Toda la prosa sale de
      `evidence.ts`; los componentes formatean y ordenan, pero no redactan. El último recurso
      (`answers-given`) sigue llevando su número.
- [x] **Si no hubo mejora, el sistema no la fabrica.** Una comparación solo se emite cuando la
      misma medición existe en las dos sesiones, con suficiente `n` de cada lado, y la
      diferencia supera el margen. Cuando no hay ninguna, la pantalla lo dice con todas sus
      letras y pasa a logros absolutos.
- [x] **La vista de progreso muestra al menos 3 series temporales.** Hay seis: latencia media de
      inicio, dominio del contenido, claridad y estructura, temas con respaldo del documento, y
      las autoevaluaciones 0–10 previa y posterior. Cada una en su propio gráfico: los segundos,
      la rúbrica 0–3 y la escala 0–10 no comparten eje y no se funden en un puntaje único.
      Una sesión sin medición deja un hueco en la línea, nunca un cero.
- [x] **El cierre por voz incluye evidencias, no elogios genéricos.** Ver arriba.
- [x] **No se muestra STAI ni PRCS-12.** `/progreso` solo lee `voice_sessions` y `session_turns`;
      no toca `survey_responses`. La escala 0–10 sí se muestra: es la autoevaluación que el
      estudiante ya ve en la pantalla previa.
- [x] **No se maquillan los resultados malos.** `setback` reporta la medición que bajó con los
      dos números y ofrece el nivel inmediatamente inferior (o dice que ya estaba en el 1).

### Lo que NO se hizo

- **No hay tests.** La propuesta pide tests para el generador; el usuario pidió explícitamente
  no escribirlos y verificar solo con `npx tsc --noEmit`. La deuda más clara es un
  `lib/progress.test.mts` que afirme, como hace el de feedback, que ninguna frase generada
  contiene "ansiedad", "nervioso", "miedo" ni elogio sin dato, y que una mejora nunca se emite
  sin medición en ambos lados.
- **La migración no se aplicó.** Queda generada; falta correr `npm run db:migrate`.
- **No se detecta "identificaste una limitación sin que te la preguntara".** El ejemplo de la
  propuesta requiere clasificar por tema un turno *del estudiante*, y el clasificador léxico de
  `lib/preparation/classify.ts` está escrito y calibrado para preguntas del jurado. Etiquetar
  respuestas con él produciría falsos positivos que después se leerían como logros inventados.
- **La evidencia no llega al CSV de métricas.** `session_closings` es consultable, pero
  `lib/metrics/exports.ts` todavía no la exporta.
- **El gráfico no tiene tooltip propio**: usa `<title>` de SVG (el tooltip nativo del navegador)
  y la tabla de valores debajo de cada serie, que es la que garantiza la lectura sin color.
- **La oferta de bajar de nivel es una frase, no un botón.** Nombra el nivel sugerido y remite a
  la pantalla previa al simulacro, que es donde el estudiante ya elige nivel. No preselecciona
  nada: la regla de adaptación del doc `01` sigue siendo la que sugiere, y el estudiante manda.
