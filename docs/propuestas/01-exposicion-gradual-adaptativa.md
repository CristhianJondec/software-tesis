# 01 — Exposición gradual adaptativa

> Lee antes: [`00-generalidades.md`](00-generalidades.md)
> **Este es el núcleo del aporte.** Si solo se implementa una propuesta, es esta.

## Qué se propone

Hoy el estudiante entra directamente a un jurado exigente. Eso es contraproducente para alguien
con ansiedad alta: es exposición súbita, no exposición graduada.

Se propone que la simulación tenga **4 niveles de exigencia** y que el sistema decida en qué
nivel arranca cada sesión.

| Nivel | Nombre | Tono del agente | Preguntas | Presión |
|---|---|---|---|---|
| 1 | Ensayo seguro | Amable, alienta | Abiertas, generales sobre el tema | Ninguna. Sin límite de tiempo |
| 2 | Práctica guiada | Cordial pero formal | Específicas del documento, con repregunta suave | Baja. Ofrece reformular |
| 3 | Simulación realista | Formal, distante | Específicas + repreguntas encadenadas | Media. Control de tiempo por respuesta |
| 4 | Simulación desafiante | Exigente, escéptico | Contradicciones, huecos metodológicos, preguntas inesperadas | Alta. Interrumpe, no reformula |

## Por qué diferencia de NotebookLM

NotebookLM responde siempre igual. Aquí el mismo documento genera **cuatro experiencias
distintas** y el sistema elige cuál corresponde. Eso es entrenamiento, no consulta.

Además conecta con literatura de exposición gradual para ansiedad al hablar en público:
la reducción aparece cuando la práctica **se repite y sube de dificultad progresivamente**.

## Qué construir

1. **Niveles como configuración, no como código disperso.** Un solo lugar (junto a
   `lib/agent-prompt.ts` y `lib/constants.ts`) donde cada nivel define: fragmento de system
   prompt, `firstMessage`, temperatura/modelo si aplica, voz, si permite reformulación,
   si hay límite de tiempo por respuesta, número objetivo de preguntas.
2. **Persistir el nivel en la sesión.** Columna nueva en `voiceSessions`
   (`difficultyLevel`, y `levelSource`: `manual` | `auto`). Migración con
   `npm run db:generate` + `db:migrate`.
3. **Autoevaluación previa (0–10).** Antes de iniciar, una sola pregunta:
   *"Del 0 al 10, ¿qué tan nervioso te sientes ahora mismo por sustentar?"*
   Se guarda con la sesión (`preSessionAnxiety`). Al cerrar, la misma escala
   (`postSessionAnxiety`).
4. **Regla de adaptación (determinista y auditable, NO un LLM decidiendo).**
   Entrada: `preSessionAnxiety` + resultado de la sesión anterior. Señales de desempeño:
   - latencia media de inicio de respuesta del estudiante,
   - silencios > umbral,
   - respuestas marcadas incompletas por el evaluador,
   - solicitudes de reformulación.

   Salida: nivel sugerido. La regla debe vivir en una **función pura** con **tests**
   (el proyecto no tiene tests, pero `CLAUDE.md` los exige para lógica pura).
5. **El estudiante siempre puede sobrescribir el nivel.** El sistema sugiere, no impone.
   Si lo cambia a mano, se registra `levelSource = 'manual'`.
6. **UI:** antes de empezar, mostrar el nivel sugerido con una frase que lo justifique
   ("Empezamos en Práctica guiada porque en tu sesión anterior el tiempo de inicio bajó").

## Datos que debe dejar

Por sesión: `difficultyLevel`, `levelSource`, `preSessionAnxiety`, `postSessionAnxiety`,
señales de desempeño agregadas. Esto alimenta la propuesta [07](07-diseno-experimental.md).

## Criterios de aceptación

- [x] Cuatro niveles configurables, cada uno con su system prompt propio.
- [x] El nivel queda guardado en la sesión y es visible en el panel de métricas.
- [x] La escala 0–10 se pide antes y después de cada sesión.
- [x] La regla de adaptación es una función pura testeada, no una llamada al LLM.
- [x] El estudiante puede cambiar el nivel manualmente.

## Qué NO hacer

- No inferir el nivel analizando el audio o el tono de voz.
- No llamar a esto "detección de ansiedad" en ningún texto de UI ni de la tesis.
- No subir de nivel automáticamente sin avisarle al estudiante.


---

## Estado de implementación

**Implementada.** Fecha: 2026-09-16.

### Qué se construyó

| Pieza | Archivo |
|---|---|
| Los 4 niveles (prompt, `firstMessage`, temperatura, reglas) | `lib/difficulty/levels.ts` |
| Indicadores conductuales observables de una sesión | `lib/difficulty/signals.ts` |
| Regla de adaptación (función pura) | `lib/difficulty/adaptation.ts` |
| Tests de las tres anteriores (40 casos) | `lib/difficulty.test.mts` |
| Bloque `{{levelDirectives}}` en el system prompt | `lib/agent-prompt.ts` |
| Columnas nuevas en `voice_sessions` | `database/schema/voiceSessions.ts`, `drizzle/0005_dry_ego.sql` |
| `getSessionPreparation`, nivel en `startVoiceSession`, `savePostSessionAnxiety` | `lib/actions/session.actions.ts` |
| Nivel aplicado a la llamada (prompt, apertura, temperatura) | `hooks/useVapi.ts` |
| Escala 0–10 reutilizable | `components/AnxietyScale.tsx` |
| Pantalla previa: escala, nivel sugerido con justificación, override | `components/SessionSetup.tsx` |
| Escala de cierre | `components/PostSessionSurvey.tsx` |
| Nivel visible en historial y detalle de sesión | `app/(root)/history/` |
| Sección "Exposición gradual adaptativa" y columnas nuevas en el CSV de sesiones | `app/(root)/metrics/page.tsx`, `lib/metrics/` |

### Columnas nuevas en `voice_sessions`

`difficulty_level` (1–4, default 1) · `level_source` (`auto` \| `manual`, default `auto`) ·
`pre_session_anxiety` (0–10, nullable) · `post_session_anxiety` (0–10, nullable).

`NULL` en las autoevaluaciones significa **sin responder**, nunca 0. Nada en el código las
convierte a 0, y la UI las muestra como "Sin respuesta".

### La regla, en una línea

Primera sesión: nivel 1, salvo autoevaluación ≤ 3 → nivel 2. Con sesión previa: se parte del
nivel anterior y se mueve **como máximo un paso**. Autoevaluación ≥ 8 → baja. Autoevaluación
6–7 → baja si hubo dificultad, si no repite. Autoevaluación ≤ 5 → baja si hubo dificultad;
sube si la sesión fue fluida o si la autoevaluación es ≤ 3; repite en cualquier otro caso.
Nunca sube con menos de 3 turnos del estudiante (evidencia insuficiente) ni cuando la
autoevaluación de cierre de la sesión anterior fue ≥ 8.

"Dificultad" y "fluidez" son umbrales exportados y documentados en `adaptation.ts` y
`signals.ts`, para que la tesis reporte el criterio exacto.

### Decisiones que conviene conocer

- **`level_source` lo deriva el servidor**, no el cliente: `startVoiceSession` vuelve a correr
  la regla sobre el historial guardado y marca `manual` solo si el nivel recibido difiere del
  sugerido. Un cliente manipulado no puede falsear el dato.
- **El límite de tiempo por respuesta es una instrucción del prompt, no un temporizador duro.**
  Cortar el micrófono destruiría la medición de latencia de respuesta verbal, que es una
  dimensión de la variable dependiente.
- **La autoevaluación de cierre es de escritura única.** El número que el estudiante dio al
  terminar es la medición; editarlo después sería otra medición.
- **Sesiones sin ningún turno se saltan** al buscar "la sesión anterior": una llamada que
  nunca conectó no es una práctica y no debe congelar la progresión. Una sesión donde solo
  habló el agente **sí** cuenta: que el estudiante no respondiera es evidencia.
- La detección de pedidos de reformulación es por coincidencia de frases en español
  (`signals.ts`). Es determinista y auditable, pero es una heurística: si en el piloto aparecen
  falsos negativos, se amplía la lista y se reporta la versión usada.

### Lo que NO se hizo

- **No se ajustó `RETRIEVER_TOP_K` ni `RETRIEVER_MAX_DISTANCE` por nivel.** Cambiar el
  retriever entre niveles haría incomparables las métricas RAGAs y PR entre sesiones.
- **No se calibraron los umbrales contra datos reales.** La base está vacía; los valores
  (8 s de silencio, 10 palabras, 6 s / 3,5 s de latencia media) son razonados, no medidos.
  Hay que revisarlos con el piloto y reportar los definitivos.
- **No se implementó `02` (retroalimentación en 3 dimensiones)**, que es lo que convertiría
  estos indicadores en devolución al estudiante. Hoy solo se muestran en el historial.
