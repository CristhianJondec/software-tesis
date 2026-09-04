# 02 — Agente en rol de docente evaluador

**Prioridad:** P0 · **Depende de:** nada · **Se puede hacer en paralelo con:** `03`
**Ítems que cierra:** #4 prompt de evaluador · #8 anclaje RAG en cada turno · #11 idioma español · #13 documentar el stack

> Lee `CLAUDE.md` en la raíz antes de empezar.

## Problema

El paso 3 del flujo funcional de la investigación dice que el LLM debe generar preguntas **en el rol
del docente evaluador**. Hoy no lo hace:

- El primer mensaje es de lectura, no de sustentación:
  *"¿ya leíste esta investigación o estamos empezando desde cero?"* (`hooks/useVapi.ts:245`)
- Las voces están descritas para *"book conversations"* (`lib/constants.ts:15`)
- El prompt real está en el dashboard de Vapi, **fuera del repositorio**: no es auditable
  por el jurado ni versionable.

Y hay una discrepancia de arquitectura: la investigación plantea el enriquecimiento RAG como **paso
obligatorio** del ciclo, pero la implementación lo deja como un tool call opcional que el
LLM decide invocar o no.

## Objetivo

Convertir el agente en un docente evaluador que interroga al estudiante sobre **su propia
investigación**, siempre anclado en fragmentos recuperados, y dejar esa configuración documentada en
el repo aunque se aplique a mano.

## Qué hacer

> **Esta tarea casi no escribe código.** Produce documentos, más un cambio chico en
> `useVapi.ts` y `constants.ts`. La config se aplica a mano en el dashboard de Vapi
> (decisión ya tomada, ver `CLAUDE.md`).

### 1. `docs/agente/prompt-evaluador.md`

El system prompt completo, en español, listo para pegar. Debe establecer:

- **Rol:** docente evaluador de un jurado de investigación de la Universidad Nacional de Trujillo.
  Serio y exigente, pero no hostil — el objetivo es fortalecer la confianza del estudiante,
  no quebrarla.
- **Fases de la sustentación**, avanzando conforme el estudiante responde:
  1. apertura e invitación a presentar el avance
  2. preguntas sobre el problema y la justificación
  3. preguntas sobre la metodología
  4. preguntas sobre resultados y conclusiones
  5. repreguntas sobre respuestas débiles o evasivas
  6. cierre con observaciones
- **Regla de anclaje (#8):** antes de formular cualquier pregunta de contenido **debe**
  llamar a `searchBook` sobre el tema que va a preguntar, y la pregunta debe basarse en lo
  recuperado. Prohibido preguntar sobre algo que no esté en el documento.
- **Prohibido inventar.** Si `searchBook` no devuelve nada útil, la conducta correcta es
  señalarlo como un vacío del documento — que es exactamente lo que haría un jurado real.
- **Citar la fuente** cuando el fragmento traiga número de página
  (*"en la página 34 afirmas que..."*). Depende del doc `03`; escríbelo condicional.
- **Una pregunta a la vez.** Espera la respuesta. Turnos breves: esto es voz, no texto.
- **Solo español** (#11), registro académico peruano.

### 2. `docs/agente/vapi-config.md`

La configuración exacta a replicar en el dashboard, para que sea reproducible:

- Modelo LLM elegido, con nombre y versión exactos (#13). **Ve al dashboard y anota el que
  está configurado hoy** — la investigación no lo especifica, así que tú lo defines y lo documentas.
- Transcriber con `language: "es"` explícito (#11).
- Voz de ElevenLabs y sus parámetros (ya están en `lib/constants.ts:38-45`).
- Los valores de turn-taking de `VAPI_DASHBOARD_CONFIG` (`lib/constants.ts:47-66`).
- **JSON del tool `searchBook`**, con estos parámetros:
  - `bookId` (string, requerido)
  - `query` (string, requerido)
  - `sessionId` (string, requerido) ← **nuevo, lo necesita el doc `01`**
- La URL del webhook.

### 3. Cambios en el código

- `hooks/useVapi.ts:245` — reemplaza el `firstMessage` por una apertura de sustentación:
  presentarse como parte del jurado, indicar que se evaluará el avance de investigación, e invitar
  al estudiante a exponer brevemente su trabajo.
- `lib/constants.ts` — reescribe las descripciones de las voces en términos de docente
  evaluador, no de narrador de libros. **No cambies los IDs de voz.**

## Criterio de aceptación

Con la config pegada en el dashboard, una sesión de prueba debe mostrar que el agente:

- Se presenta como jurado y pide la exposición del avance. No pregunta si "leíste el libro".
- Formula preguntas **específicas del documento subido**, no genéricas sobre metodología.
- Llama a `searchBook` **antes** de cada pregunta de contenido (verificable en los logs del
  webhook, y en `turn_retrievals` si el doc `01` ya está hecho).
- Repregunta cuando la respuesta es vaga.
- Habla siempre en español, aunque el estudiante meta términos en inglés.
- Ante un tema ausente del documento, lo señala como vacío en vez de inventar.

## Nota para la investigación

Deja constancia explícita en `vapi-config.md` de que la configuración del agente se aplica
manualmente en el dashboard de Vapi. Es una limitación real de reproducibilidad y es mejor
declararla que dejar que el jurado la descubra.

## Estado

- [x] **Hecho en el repo** (2026-09-03) · ⚠️ **falta aplicar la config a mano en el dashboard**

### Qué quedó hecho

- `docs/agente/prompt-evaluador.md` — system prompt completo en español, listo para pegar.
  Cubre rol de jurado UNT, las 6 fases, la regla de anclaje obligatoria sobre `searchBook`,
  la prohibición de inventar, una pregunta por turno y solo español (#4, #8, #11).
- `docs/agente/vapi-config.md` — config exacta a replicar: modelo LLM definido y justificado
  (#13), transcriber con `language: "es"`, voz y parámetros de ElevenLabs, bloque de
  turn-taking, JSON del tool `searchBook` con los tres parámetros —`sessionId` incluido— y
  la URL del webhook. Incluye la declaración explícita de que la config se aplica a mano.
- `hooks/useVapi.ts` — `firstMessage` reemplazado por la apertura de sustentación: el agente
  se presenta como jurado e invita a exponer el avance.
- `lib/constants.ts` — descripciones de voz reescritas en español y en términos de docente
  evaluador. Los IDs de voz no se tocaron.

### Qué NO quedó hecho

- **Aplicar la configuración en el dashboard de Vapi.** Es manual por decisión de proyecto y
  requiere acceso a la cuenta. Usa el checklist final de `vapi-config.md`.
- **Confirmar el modelo LLM contra el dashboard.** No hubo acceso al dashboard, así que el
  modelo se *definió* (`openai / gpt-4o`) en lugar de *anotarse*. Antes de reportarlo en la
  investigación, verifica cuál quedó configurado y corrige `vapi-config.md` si difiere.
- **Verificar el criterio de aceptación.** Requiere una sesión de prueba real, que solo es
  posible después de aplicar la config. El checklist está al final de `prompt-evaluador.md`.
- **Cita de página.** La regla quedó escrita condicional, como pedía la tarea: hoy
  `book_segments.page_number` está vacío, así que el agente no citará páginas hasta que el
  doc `03` esté hecho. No requiere volver a tocar el prompt.
