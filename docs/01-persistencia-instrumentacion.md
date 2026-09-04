# 01 — Persistencia de conversación e instrumentación de latencias

**Prioridad:** P0 · **Depende de:** nada · **Bloquea a:** `04`
**Ítems que cierra:** #1 latencia del estudiante · #2 latencia del sistema (LP) · #3 persistencia de turnos y fragmentos · #12 código de participante

> Lee `CLAUDE.md` en la raíz antes de empezar.

## Problema

Hoy la conversación **se pierde**. Los mensajes viven solo en `useState` dentro de
`hooks/useVapi.ts` y desaparecen al salir de la página. `voice_sessions` guarda únicamente
`durationSeconds`. Los fragmentos que el retriever devuelve se mandan a Vapi y **se
descartan** sin dejar rastro.

Consecuencia: no se puede calcular PR, ni LP, ni RAGAs, ni la latencia de respuesta verbal
del estudiante — que es una dimensión de la variable dependiente de la investigación.

## Objetivo

Que al terminar una sesión de voz quede en base de datos, por cada turno: quién habló, qué
dijo, cuánto tardó, y qué fragmentos del documento se recuperaron para responderle.

## Qué hacer

### 1. Esquema nuevo

Crea `database/schema/sessionTurns.ts` y expórtalo desde `database/schema/index.ts`.

**`session_turns`** — un registro por intervención:

- `id`, `sessionId` (FK → `voice_sessions`, cascade), `turnIndex` (int)
- `role` — `assistant` o `user`
- `content` (text)
- `startedAt`, `endedAt` (timestamp)
- `studentLatencyMs` (int, nullable) — solo en turnos del estudiante
- `systemLatencyMs` (int, nullable) — solo en turnos del agente
- Índice por `(sessionId, turnIndex)`

**`turn_retrievals`** — qué se recuperó para responder:

- `id`, `turnId` (FK → `session_turns`, cascade)
- `segmentId` (FK → `book_segments`), `query` (text), `rank` (int), `distance` (real)
- Índice por `turnId`

En `database/schema/auth.ts`, agrega a `users`:

- `participantCode` (text, nullable, unique) — para cruzar con las encuestas externas
- `studyGroup` (text, nullable) — `experimental` o `control`

### 2. Instrumentar las latencias en `hooks/useVapi.ts`

Los event handlers ya existen; solo falta marcar el tiempo. Usa refs, no estado.

- **Latencia del estudiante (#1):** guarda el timestamp en `speech-end` del agente
  (`useVapi.ts:126`). Cuando llegue el **primer transcript parcial del usuario**
  (`useVapi.ts:161`), la diferencia es `studentLatencyMs`. Resetea el marcador después de
  usarlo, para no medir dos veces en el mismo turno.
- **Latencia del sistema (#2):** guarda el timestamp en el transcript **final** del usuario.
  Cuando dispare el siguiente `speech-start` del agente, la diferencia es `systemLatencyMs`.

### 3. Persistir cada turno

Crea `saveSessionTurn()` en `lib/actions/session.actions.ts`.

**Guarda turno por turno, no al final de la sesión.** Si el estudiante cierra la pestaña o
se cae la red, la evidencia debe estar a salvo. Llámala cuando se cierra cada turno (al
llegar el transcript final) y que falle en silencio con `console.error` — un error de
guardado **nunca** debe cortar la conversación en curso.

Valida que la sesión pertenezca al usuario antes de escribir.

### 4. Vincular los fragmentos recuperados

Aquí está la parte no obvia: el webhook `app/api/vapi/search-book/route.ts` **no sabe a qué
sesión pertenece la llamada**, así que hoy no puede asociar lo recuperado con nada.

Solución: pasar el `sessionId` a Vapi y hacer que vuelva en el tool call.

1. En `useVapi.ts`, agrega `sessionId` a `variableValues` en la llamada a `vapi.start()`
   (junto a `title`, `author`, `bookId`).
2. En la ruta, lee `sessionId` de los argumentos del tool y guarda las filas en
   `turn_retrievals` con el `query`, el `rank` y la `distance` de cada fragmento.
   `searchBookSegments()` todavía no devuelve `distance` — agrégalo al `select`.
3. Asocia al último turno de esa sesión. Si aún no existe el turno, guarda con `turnId` nulo
   y no bloquees la respuesta: **el webhook debe responderle a Vapi rápido**, la persistencia
   va después de armar la respuesta o en paralelo.

> ⚠️ El tool `searchBook` está definido en el dashboard de Vapi y hoy **no acepta**
> `sessionId`. Agregar ese parámetro es tarea del doc `02`. Coordina: si `02` todavía no se
> hizo, deja el código leyendo `sessionId` de forma opcional y avisa al usuario que debe
> actualizar el schema del tool en Vapi.

## Criterio de aceptación

Después de una conversación de prueba de unos 2 minutos:

- `session_turns` tiene una fila por intervención, en orden, con el texto correcto.
- Los turnos del estudiante tienen `studentLatencyMs` con valores plausibles (300–4000 ms).
- Los turnos del agente tienen `systemLatencyMs` con valores plausibles (500–3000 ms).
- `turn_retrievals` tiene filas con `query`, `rank` y `distance` reales.
- Cerrar la pestaña a mitad de la conversación **no** pierde los turnos ya completados.

## Notas

- No cambies el comportamiento visible de la UI. La transcripción en vivo sigue igual.
- Si el guardado por turno mete latencia perceptible en la conversación, dilo — se puede
  pasar a una cola en memoria que descargue cada N turnos, pero solo si hace falta.

## Estado

- [x] Hecho (2026-09-03) — falta la prueba de conversación real y el doc `02`.

### Qué quedó hecho

**Esquema** (`database/schema/sessionTurns.ts`, exportado en `index.ts`):
- `session_turns` con `sessionId`, `turnIndex`, `role`, `content`, `startedAt`, `endedAt`,
  `studentLatencyMs`, `systemLatencyMs` e índice `(session_id, turn_index)`.
- `turn_retrievals` con `turnId` (nullable), `segmentId`, `query`, `rank`, `distance`.
- `users` ahora tiene `participantCode` (único, nullable) y `studyGroup`.
- Migración `drizzle/0001_yummy_goliath.sql` **generada y ya aplicada** a la base.

**Instrumentación** (`hooks/useVapi.ts`): refs nuevos, sin estado ni re-render.
- `studentLatencyMs` = primer transcript parcial del usuario − `speech-end` del agente.
  El marcador se limpia al usarse, así que un turno se mide una sola vez.
- `systemLatencyMs` = `speech-start` del agente − transcript final del usuario.
- Los marcadores se resetean en `call-start`.

**Persistencia** (`saveSessionTurn` en `lib/actions/session.actions.ts`):
- Se llama al cerrar cada turno (transcript final), turno por turno, no al final.
- Valida propiedad de la sesión con `requireUser()` antes de escribir.
- El llamado es fire-and-forget: cualquier fallo va a `console.error` y no corta la llamada.
- Tipos `SaveTurnInput` / `SaveTurnResult` en `types.d.ts`.

**Fragmentos recuperados**:
- `useVapi` manda `sessionId` en `variableValues` de `vapi.start()`.
- `searchBookSegments()` ahora devuelve `distance` en el `select`.
- El webhook lee `sessionId` de los argumentos del tool **de forma opcional** y persiste vía
  `recordTurnRetrievals()` (`lib/retrievals.ts`) dentro de `after()` de Next: la respuesta a
  Vapi se arma y se devuelve primero, la escritura ocurre después.
- Los fragmentos se asocian al último turno de la sesión; si aún no existe, la fila queda con
  `turnId` nulo.

### Decisiones y desvíos

- **`turn_retrievals` lleva también `sessionId`** (no estaba en la especificación). Sin él, una
  fila con `turnId` nulo — el caso que el propio doc contempla — quedaría huérfana y sin uso
  para RAGAs. Con `sessionId` se puede reasociar después.
- **`recordTurnRetrievals` no es un Server Action** sino un módulo server-only en `lib/`. Si
  fuera `'use server'` quedaría expuesto al navegador y el webhook no tiene sesión de usuario
  que validar: cualquiera podría inyectar recuperaciones falsas.

### Qué falta

- ⚠️ **Bloqueado por el doc `02`:** el tool `searchBook` del dashboard de Vapi todavía no
  declara el parámetro `sessionId`, así que hoy llega vacío y `turn_retrievals` **no se
  llena**. El código ya está listo y no falla; en cuanto `02` agregue `sessionId` al schema
  del tool (y el prompt lo pase como `{{sessionId}}`), empieza a registrar solo.
- **Falta la prueba de conversación de 2 minutos** del criterio de aceptación: hay que correrla
  para confirmar los rangos de latencia (300–4000 ms del estudiante, 500–3000 ms del sistema).
- **Sin tests**: el proyecto no tiene runner y lo agregado no es lógica pura (son handlers de
  eventos y escrituras a base de datos). El cálculo de métricas del doc `04` sí debería
  llevarlos.
