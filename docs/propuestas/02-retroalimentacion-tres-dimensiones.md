# 02 — Retroalimentación en tres dimensiones

> Lee antes: [`00-generalidades.md`](00-generalidades.md) · Depende de [`01`](01-exposicion-gradual-adaptativa.md)

## Qué se propone

Al terminar cada sesión, el sistema entrega un informe con **tres dimensiones separadas**,
no una nota global:

1. **Dominio del contenido** — ¿la respuesta es correcta y está respaldada por el documento?
2. **Claridad y estructura** — ¿la respuesta tiene orden, responde lo que se preguntó,
   conecta con los objetivos/metodología?
3. **Seguridad comunicativa observable** — indicadores conductuales registrados, descritos
   como hechos, nunca como diagnóstico.

Ejemplo del tono correcto:

> "Tu respuesta sobre la muestra fue correcta y coincide con la sección 3.2 de tu documento.
> Tardaste 9 segundos en empezar a responder y pediste que repitiera la pregunta una vez.
> No explicaste la relación entre el tamaño de muestra y el objetivo específico 2."

Tono **prohibido**:

> ~~"Se te notó muy ansioso"~~ · ~~"Estuviste inseguro"~~ · ~~"Lo hiciste muy bien"~~

## Por qué diferencia de NotebookLM

NotebookLM evalúa comprensión de un texto. Aquí se evalúa **la conducta de sustentar**:
qué tan rápido arrancas, si te quedas en silencio, si pides reformular. Eso solo existe
porque hay voz, turnos y tiempos instrumentados.

## Qué construir

1. **Evaluación por turno, no solo por sesión.** Ya existe `turnEvaluations`; extenderla con
   las tres dimensiones (puntaje + justificación textual corta + cita del fragmento del
   documento que respalda el juicio de contenido).
2. **Dimensión 3 se calcula, no se opina.** Se deriva de datos ya registrados:
   latencia de inicio de respuesta, duración de silencios intra-respuesta, número de
   reformulaciones pedidas, respuestas abandonadas. Función pura + tests.
3. **Las dimensiones 1 y 2 las juzga el LLM**, pero **obligado a citar** el fragmento
   recuperado que sustenta su juicio. Sin cita, la evaluación se marca como no concluyente.
4. **Informe post-sesión en UI**, en español, con las tres dimensiones visualmente separadas
   y el detalle por pregunta desplegable.

## Datos que debe dejar

Por turno: puntaje de cada dimensión, justificación, `sourceSegmentId` citado.
Por sesión: promedio por dimensión. Alimenta [`05`](05-evidencias-de-avance.md) y
la métrica PR.

## Criterios de aceptación

- [x] Las tres dimensiones aparecen separadas en el informe, nunca fusionadas en una nota.
- [x] Ningún texto de la dimensión 3 usa la palabra "ansiedad", "nervioso" o "inseguro".
- [x] Todo juicio de contenido cita un fragmento del documento del estudiante.
- [x] La dimensión 3 es reproducible: mismos datos → mismo resultado.

## Qué NO hacer

- No convertir esto en un puntaje único ni en una "nota de sustentación".
- No pedirle al LLM que estime el estado emocional del estudiante.


---

## Estado de implementación

**Implementada.** Fecha: 2026-09-18.

### Qué se construyó

| Pieza | Archivo |
|---|---|
| Rúbrica de las dimensiones 1 y 2, y promedios por dimensión | `lib/feedback/rubric.ts` |
| Dimensión 3: hechos contados + frases factuales | `lib/feedback/observations.ts` |
| Armado de casos (pregunta → respuesta del estudiante → fragmentos) | `lib/feedback/cases.ts` |
| Juez LLM de las dimensiones 1 y 2, con cita obligatoria | `lib/feedback/evaluate.ts` |
| Ensamblado del informe de sesión | `lib/feedback/report.ts` |
| Tests de todo lo anterior (57 casos) | `lib/feedback.test.mts` |
| Tabla `turn_feedback` | `database/schema/turnFeedback.ts`, `drizzle/0006_good_eternals.sql` |
| Columna `max_pause_ms` en `session_turns` | `database/schema/sessionTurns.ts` |
| Instrumentación de la pausa intra-respuesta | `hooks/useVapi.ts` |
| Server actions (leer informe / evaluar pendientes) | `lib/actions/feedback.actions.ts` |
| UI del informe, tres dimensiones separadas y detalle desplegable | `components/SessionReport.tsx` |
| Informe en el detalle de la sesión + enlace desde el cierre | `app/(root)/history/[sessionId]/page.tsx`, `components/PostSessionSurvey.tsx` |
| Promedios por dimensión en métricas y 6 columnas nuevas en el CSV de sesiones | `app/(root)/metrics/page.tsx`, `lib/metrics/` |

### La rúbrica

Cuatro niveles descritos (0–3) por dimensión, en `rubric.ts`. El juez **elige un nivel**, no
inventa un decimal: un nivel descrito se puede releer, discutir y volver a calificar a mano
contra la misma descripción; un 0.73 no. El puntaje 0–1 que reporta la tesis se **deriva** del
nivel (`nivel / 3`), en un solo lugar.

`NULL` en un nivel significa **no concluyente**, nunca 0. Los nulos se cuentan aparte y jamás
entran al promedio: un turno que el juez no pudo anclar es una ausencia de medición, y
promediarlo como 0 reportaría al estudiante como equivocado por una falla del sistema.

### La cita obligatoria

El nivel de contenido se acepta **solo** si el juez nombra uno de los fragmentos que se le
entregaron. Un índice fuera de la lista no es una cita: se descarta el nivel, se guarda
`citationRejected` en `detail` y la dimensión queda no concluyente. La claridad no cita, porque
no es una afirmación sobre el documento.

Un bug que esto sacó a la luz y quedó corregido con test: `Number(null) === 0`, así que un juez
que respondiera `"fragmento": null` —la forma documentada de decir "no puedo citar"— habría
citado silenciosamente el fragmento 0. `resolveCitation` ahora solo acepta un número o una
cadena numérica.

### Tres desvíos de la propuesta, con su motivo

1. **Tabla nueva `turn_feedback` en lugar de extender `turnEvaluations`.** La propuesta decía
   "extenderla". No se hizo: `turn_evaluations` es el **juicio humano sobre turnos del AGENTE**
   y es el denominador de PR. Estas tres dimensiones son un **juicio LLM sobre turnos del
   ESTUDIANTE**. Sujeto distinto, evaluador distinto, unidad de análisis distinta. Mezclarlas
   obligaría a inventar un `isCorrect` para cada fila de estudiante y arriesgaría meter esas
   filas en el denominador de PR, corrompiendo una métrica ya reportada.
2. **La dimensión 3 no tiene puntaje.** La propuesta pide "puntaje de cada dimensión". Un solo
   número rotulado "seguridad comunicativa" se lee como una medición de cómo se sintió el
   estudiante, que es exactamente lo que la regla 1 de `00-generalidades` prohíbe afirmar. En su
   lugar entrega **hechos con su número al lado** ("tardaste 9 segundos en empezar", "hiciste
   una pausa de 4 segundos"), verificables contra la transcripción. Los conteos por sesión
   quedan igual de disponibles para la tesis. Si se decide agregar un compuesto después, se
   calcula de estos mismos datos sin migración.
3. **La dimensión 3 no se guarda, se recalcula.** Es aritmética sobre `session_turns`. Guardar
   un número derivado lo dejaría a la deriva respecto de la evidencia que resume; así es
   reproducible por construcción.

### Sobre `max_pause_ms`

La propuesta pide "duración de silencios intra-respuesta". No estaba instrumentado, así que se
agregó: `useVapi` mide la **brecha más larga entre dos transcripciones parciales consecutivas**
del turno del estudiante.

Hay que reportarlo con honestidad: **no es silencio acústico**, es silencio tal como lo vio el
transcriptor. El STT emite parciales por lotes, así que una brecha corta puede ser cadencia del
transcriptor y no una pausa del estudiante. Por eso el umbral que la hace reportable
(`LONG_PAUSE_MS = 3 s`) está por encima de esa cadencia. Un turno con un solo parcial no tiene
brecha medible, y se guarda como `NULL`, no como 0.

### Lo que NO se hizo

- **No se calibró `LONG_PAUSE_MS` contra sesiones reales.** La base está vacía. Hay que correr
  el piloto, leer la columna `max_pause_ms` y fijar el umbral por encima del piso de ruido del
  transcriptor que se use. Mismo pendiente que los umbrales de `01`.
- **No hay acuerdo inter-evaluador.** La tesis puede querer contrastar los niveles del juez con
  los de un docente humano sobre una submuestra. La tabla lo permite sin migración
  (`promptVersion` distingue versiones), pero la UI de revisión humana de estas dimensiones no
  existe: la que hay (`/metrics/revision`) es para PR, sobre turnos del agente.
- **No se implementó `05` (evidencias de avance)**, que es lo que compararía estos promedios
  entre sesiones para mostrarle progreso al estudiante. Hoy el informe es por sesión.
- El juez corre **a pedido**, con un botón, en lotes de 12 respuestas. No se dispara al
  terminar la sesión: cada respuesta cuesta dos llamadas al juez y hacerlo automático dejaría
  la sesión colgada del rate limit de Gemini.
