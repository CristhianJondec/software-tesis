# 04 — Métricas: ICA, PR, LP y RAGAs

**Prioridad:** P1 · **Depende de:** `01` (obligatorio) y `03` (recomendado)
**Ítems que cierra:** #5 precisión de respuestas · #6 RAGAs · #7 reporte de métricas

> Lee `CLAUDE.md` en la raíz antes de empezar.
> **No empieces si el doc `01` no está terminado.** Sin turnos ni recuperaciones
> persistidas no hay nada que medir.

## Problema

La investigación declara cuatro métricas que **el software debe generar y reportar**, y hoy no
calcula ninguna.

## Objetivo

Una ruta `/metrics` dentro de la app que muestre ICA, PR, LP y RAGAs con datos reales, más
la exportación en CSV para el capítulo de resultados.

## Qué hacer

### 1. ICA — Índice de Completitud Arquitectónica

`(Ci / Ct) × 100` sobre los 5 componentes previstos: STT, LLM, base de datos vectorial,
retriever, TTS.

No lo calcules "a ojo": crea un registro declarativo en `lib/metrics/architecture.ts` con
los 5 componentes, su implementación concreta y el archivo que sirve de evidencia. El ICA es
el porcentaje de los que están marcados como integrados. Hoy da **100%**, pero debe quedar
derivado de datos, no escrito a mano.

### 2. LP — Latencia Promedio

`Σti / n` sobre `session_turns.systemLatencyMs`. Reporta media, mediana, mínimo, máximo y n.

Reporta **por separado** la latencia de respuesta verbal del estudiante
(`studentLatencyMs`), que es dimensión de la variable dependiente y no debe mezclarse con la
latencia del sistema. Agrúpala por participante y por número de sesión: lo interesante para
la investigación es si **baja con la práctica**.

### 3. PR — Precisión de Respuestas

`(Rc / Rt) × 100`. Necesita juicio humano, así que hace falta soporte para registrarlo:

- Tabla `turn_evaluations`: `turnId`, `isCorrect` (bool), `notes` (text), `evaluatedAt`.
- Una pantalla simple de revisión que liste los turnos del agente con su contexto recuperado
  y dos botones, correcto / incorrecto. No la sobrediseñes: es una herramienta interna para
  el investigador, no para los estudiantes.
- Fixture opcional en `lib/metrics/fixtures/` con una batería de preguntas de prueba para
  correr siempre el mismo set entre sprints y hacer las mediciones comparables.

### 4. RAGAs en TypeScript

Implementa en `lib/metrics/ragas.ts` las cuatro métricas sobre las ternas ya persistidas
(pregunta, contexto recuperado, respuesta), usando Gemini como juez — el cliente ya está
configurado en `lib/embeddings.ts`:

| Métrica | Qué mide |
|---|---|
| Faithfulness | que la respuesta no afirme nada fuera del contexto recuperado |
| Answer relevancy | que la respuesta atienda la pregunta |
| Context precision | que los fragmentos recuperados sean pertinentes |
| Context recall | que se haya recuperado lo necesario |

Cada una: descomponer con el LLM juez en afirmaciones verificables, contrastar contra el
contexto, y promediar. Usa temperatura 0 y un prompt de juez fijo y versionado, para que las
mediciones sean reproducibles entre corridas.

> ### ⚠️ Honestidad metodológica — esto va en la investigación
>
> La investigación cita RAGAs como framework de Es et al. (2023), que es una **librería de Python**.
> Aquí se reimplementan las métricas en TypeScript por decisión de stack. Eso es legítimo,
> pero **debe declararse como una adaptación**, no presentarse como si se hubiera usado la
> librería original. Redacta esa nota en `docs/05` y deja un comentario al inicio de
> `ragas.ts` indicando qué fórmulas se siguieron y en qué se apartan de la implementación
> oficial. Si el jurado lo descubre por su cuenta, cuesta mucho más caro.

### 5. Ruta `/metrics`

Server component bajo `app/(root)/metrics/`, protegido: solo el usuario investigador. Muestra las
cuatro métricas con su n, y un botón de exportación a CSV por sesión y por participante,
listo para SPSS o R.

## Criterio de aceptación

- `/metrics` carga con datos de sesiones reales, sin valores inventados ni placeholders.
- ICA muestra 100% derivado del registro de componentes.
- LP muestra media y n reales; la latencia del estudiante aparece aparte.
- PR se calcula sobre turnos efectivamente marcados, e indica cuántos faltan por revisar.
- Las cuatro métricas RAGAs dan valores entre 0 y 1 y son estables al recalcular.
- El CSV abre correctamente y trae el código de participante.

## Estado

- [x] **Hecho en el repo** (2026-09-03) · ⚠️ **falta correr sesiones reales para poblar LP, PR y RAGAs**

### Qué quedó hecho

**Esquema** (`database/schema/turnEvaluations.ts`, migración `0002_parallel_namor`, aplicada):

- `turn_evaluations` — `turnId` (índice único), `isCorrect`, `notes`, `evaluatedBy`,
  `evaluatedAt`. El índice único hace que volver a marcar un turno **actualice** el veredicto
  en vez de meter una segunda fila contradictoria en el mismo denominador.
- `ragas_evaluations` — **no estaba en la especificación**. Ver "Decisiones y desvíos".

**Lógica pura** (`lib/metrics/`, sin base de datos, toda con tests):

| Archivo | Qué hace |
|---|---|
| `architecture.ts` | Registro declarativo de los 5 componentes con su evidencia; `computeIca()` deriva `(Ci/Ct)×100`. |
| `latency.ts` | `summarizeLatency` (media, mediana, mín, máx, p95, n), numeración cronológica de sesiones por participante, agrupación de la latencia del estudiante y tendencia primera-vs-última sesión. |
| `precision.ts` | `computePrecision`: PR sobre los turnos revisados, con los pendientes aparte. |
| `triples.ts` | Arma las ternas (pregunta, contexto, respuesta) desde `session_turns` + `turn_retrievals`. |
| `ragas.ts` | Las cuatro métricas, con los prompts del juez fijos y versionados. |
| `csv.ts`, `format.ts` | Serialización RFC 4180 y formateo determinista (sin `toLocaleString`, que rompería la hidratación). |
| `fixtures/preguntas-piloto.ts` | 12 preguntas fijas: estructura, metodología, profundidad y 3 fuera de tema. |

**Infraestructura de servidor:**

- `lib/metrics/judge.ts` — juez Gemini con `temperature: 0`, `thinkingBudget: 0` y respuesta
  JSON forzada. El modelo se pincha en `GEMINI_JUDGE_MODEL` (por defecto `gemini-2.5-flash`).
- `lib/metrics/queries.ts` — lecturas crudas (turnos, sesiones, recuperaciones, evaluaciones,
  puntajes). Verificadas contra la base real: los cinco joins corren sin error.
- `lib/metrics/report.ts` y `exports.ts` — arman el reporte completo y los tres CSV.
- `lib/actions/metrics.actions.ts` — server actions: `getMetricsOverview`, `getTurnsForReview`,
  `saveTurnEvaluation`, `deleteTurnEvaluation`, `recomputeRagas`, `clearRagasScores`,
  `exportMetricsCsv`. Todas empiezan por `requireResearchOwner()`.
- `lib/metrics/access.ts` — allowlist por `METRICS_OWNER_EMAILS` (ya agregada al `.env`).
  **Falla cerrado**: sin la variable no entra nadie. Estas pantallas leen las transcripciones
  de todos los participantes, así que no alcanza con la verificación de propiedad habitual.

**UI:**

- `/metrics` — ICA con su tabla de evidencia, LP, latencia del estudiante (global, por
  participante y sesión, y primera-vs-última), PR con pendientes, las cuatro RAGAs con su n,
  y la exportación. Acceso por URL: no hay enlace en el navbar, porque el navbar lo ve todo
  el mundo.
- `/metrics/revision` — la pantalla de marcado: pregunta, respuesta, fragmentos recuperados
  con página y distancia, botones correcto/incorrecto y una nota opcional. Filtros
  pendientes / revisados / todos, de 40 en 40.

**Tests** (`lib/metrics.test.mts`, 44 casos, `npm test`): ICA, las cuatro estadísticas de
latencia, la numeración de sesiones, la tendencia, PR, el armado de ternas (incluidos los
casos raros: recuperación sin turno, búsqueda sin respuesta, segmento duplicado), los
ayudantes de RAGAs y `computeRagasForTriple` completo con un juez simulado — incluida la
estabilidad al recalcular y el fallo aislado de una métrica.

### Decisiones y desvíos

- **`ragas_evaluations` (tabla nueva, no pedida).** Cada terna cuesta 6 llamadas al juez y 4
  embeddings; calcularlas en cada carga de `/metrics` sería lento, caro y —peor— haría que
  los números cambiaran entre visitas. Se cachean por `(turnId, promptVersion)`. Subir
  `RAGAS_PROMPT_VERSION` genera filas nuevas en vez de reescribir mediciones ya reportadas.
- **`context_recall` es una adaptación, no la fórmula oficial.** La versión de Es et al. mide
  cuántas oraciones del `ground_truth` son atribuibles al contexto, y aquí no hay ground
  truth: las sustentaciones son conversaciones espontáneas. Se mide, en cambio, cuántos de
  los requisitos de información que exige la pregunta están cubiertos por el contexto
  recuperado. `context_precision` también se desvía: juzga contra la respuesta dada, no
  contra una respuesta de referencia. Ambos desvíos están escritos en la cabecera de
  `ragas.ts` y **tienen que ir a `docs/05`**.
- **`recomputeRagas` procesa 10 ternas por invocación.** Un botón de "calcular todo" se pasaría
  del timeout y dejaría la corrida a medias sin forma de saber hasta dónde llegó. La acción
  devuelve cuántas faltan y el botón se vuelve a apretar.
- **Una métrica sin datos devuelve `null`, no 0**, y la UI la muestra como "—". Un cero es una
  medición; un vacío es la ausencia de una, y la investigación no puede confundirlos. Lo mismo en el
  CSV: celda vacía, nunca 0 ni "NA".
- **Sin ruta de API para el CSV.** La acción devuelve el texto y el navegador arma el archivo,
  para respetar la convención de `CLAUDE.md` (datos por server actions).

### Qué NO quedó hecho

- **No hay datos para LP, PR ni RAGAs.** La base tiene 13 sesiones pero **0 turnos**: son
  sesiones anteriores al doc `01`. Hasta que no se corra una sustentación real con la
  instrumentación puesta, `/metrics` muestra ICA = 100 % y el resto vacío, que es exactamente
  lo que debe mostrar.
- **Criterio de aceptación sin verificar por la misma razón:** "carga con datos de sesiones
  reales", "LP muestra media y n reales", "las cuatro RAGAs dan valores entre 0 y 1 y son
  estables al recalcular" (probado con juez simulado, falta con Gemini real) y "el CSV abre
  correctamente y trae el código de participante" (falta abrirlo con filas de verdad).
- **Ningún usuario tiene `participantCode` todavía**, así que las tablas por participante
  dirán "sin código" hasta que se asignen. La asignación es manual, por base de datos.
- **La nota de honestidad metodológica falta en `docs/05`**, que aún está pendiente. En el
  código ya está, en la cabecera de `lib/metrics/ragas.ts`.
- **El umbral del retriever sigue sin calibrar** (viene del doc `03`). El bloque
  `fuera-de-tema` de `fixtures/preguntas-piloto.ts` es el control que esa calibración
  necesita.
