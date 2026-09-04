# CLAUDE.md — Contexto del proyecto

> Este archivo se carga automáticamente en cada sesión de Claude Code.
> Los chats de tarea viven en `docs/`. Léelo completo antes de tocar código.

## Qué es este proyecto

Agente conversacional por voz con RAG que **simula la sustentación de un avance de investigación**:
el estudiante sube su investigación en PDF y un agente por voz, en el rol de docente evaluador, le
hace preguntas ancladas en su propio documento.

Es el artefacto tecnológico de una investigación de la **Universidad Nacional de Trujillo, 2026**.
Eso importa: el software no solo debe funcionar, debe **producir evidencia medible** para
el capítulo de resultados.

El código base viene de un proyecto de "chat con libros" (JS Mastery). Por eso quedan
nombres del dominio anterior: `books`, `bookSegments`, `searchBook`, `IBook`. **La UI ya
dice "investigación", el esquema todavía dice "books". No renombres el esquema** — no aporta a los
objetivos y rompe cosas. Trabaja con los nombres que existen.

## Stack

- **Next.js 16** (App Router, Server Actions) + React 19 + TypeScript
- **Postgres + pgvector**, ORM **Drizzle** (`drizzle-kit generate` / `migrate`)
- **Better Auth** (`lib/auth.ts`, `lib/session.ts`)
- **Vapi Web SDK** (`@vapi-ai/web`) para voz — STT, LLM y TTS los orquesta Vapi
- **ElevenLabs** para las voces (vía Vapi)
- **Gemini `text-embedding-004`** para embeddings, 768 dimensiones
- **Cloudflare R2** para PDFs y portadas
- Tailwind v4 + shadcn/ui + sonner (toasts)

## Mapa de archivos clave

| Qué | Dónde |
|---|---|
| Pipeline RAG (ingesta, guardado, búsqueda) | `lib/actions/book.actions.ts` |
| Embeddings (Gemini) | `lib/embeddings.ts` |
| Parseo de PDF y segmentación | `lib/utils.ts` (`parsePDFFile`, `splitIntoSegments`) |
| Webhook que Vapi llama para recuperar contexto | `app/api/vapi/search-book/route.ts` |
| Ciclo de vida de la llamada por voz | `hooks/useVapi.ts` |
| UI de la sesión de voz | `components/VapiControls.tsx`, `components/Transcript.tsx` |
| Registro de sesiones | `lib/actions/session.actions.ts` |
| Esquema de base de datos | `database/schema/*.ts` |
| Config de voces y del assistant | `lib/constants.ts` |

## Cómo funciona hoy el flujo de voz

1. `useVapi.start()` valida límites, crea un registro en `voice_sessions` y llama a
   `vapi.start(ASSISTANT_ID, { variableValues: { title, author, bookId } })`.
2. Vapi maneja STT, LLM y TTS. Cuando el LLM decide recuperar contexto, llama al tool
   `searchBook` → `POST /api/vapi/search-book` con `bookId` y `query`.
3. La ruta ejecuta `searchBookSegments()`: embebe la consulta y busca por distancia coseno
   en `book_segments` (índice HNSW).
4. Los eventos de Vapi (`speech-start`, `speech-end`, `message`) actualizan el estado y la
   transcripción en vivo en `useVapi.ts`.

**El comportamiento del agente (prompt, modelo, tools) está en el dashboard de Vapi**, no en
el repo. Solo existe `ASSISTANT_ID` en `.env`. La referencia versionada vive en
`docs/agente/`.

## Lo que exige la investigación (no negociable)

**Componentes de arquitectura (ICA)** — los 5 deben estar integrados y demostrados:
STT · LLM · base de datos vectorial · retriever · TTS

**Flujo funcional obligatorio:**
1. El estudiante habla → STT transcribe
2. El texto se **enriquece con fragmentos recuperados del documento del estudiante**
3. El LLM genera pregunta/réplica **anclada en ese contexto**, en rol de docente evaluador
4. TTS sintetiza la respuesta
5. El ciclo es **síncrono y repetido**

**Métricas que el software debe generar y reportar:**

| Métrica | Fórmula |
|---|---|
| ICA — Completitud Arquitectónica | (Ci / Ct) × 100 |
| PR — Precisión de Respuestas | (Rc / Rt) × 100 |
| LP — Latencia Promedio del sistema | Σti / n |
| RAGAs | anclaje de las respuestas al documento fuente |

**Además:** el software debe registrar la **latencia de respuesta verbal del estudiante**
(tiempo entre el fin de la pregunta del agente y su primera palabra). Es una dimensión de la
variable dependiente de la investigación, no un extra.

**Restricciones declaradas:** opera **solo en español**, requiere internet, requiere
micrófono y parlantes.

## Decisiones ya tomadas (no las vuelvas a plantear)

1. **El assistant de Vapi se configura a mano en el dashboard.** El repo guarda el prompt y
   la config como referencia auditable en `docs/agente/`, pero no se crea por API.
2. **La base de datos está vacía**, sin usuarios ni investigaciones reales. Las migraciones y los
   cambios de segmentación son libres: no hace falta backfill ni conservar datos.
3. **Todas las métricas, incluido RAGAs, se implementan en TypeScript** dentro del repo. No
   se agrega Python. (Ver la nota de honestidad metodológica en `docs/04`.)

## Convenciones

- **Toda la UI y los mensajes al usuario van en español.** El código y los comentarios en inglés.
- Acceso a datos mediante **Server Actions** (`'use server'`), no rutas API — salvo el
  webhook de Vapi y el upload, que sí deben ser rutas.
- Toda acción valida sesión con `requireUser()` / `getSession()` y **verifica propiedad**
  del recurso antes de leer o escribir.
- Las acciones devuelven `{ success, data?, error? }`. No lanzan hacia el cliente.
- Migraciones con `npm run db:generate` y luego `npm run db:migrate`. Nunca edites a mano
  los archivos de `drizzle/`.
- No hay tests en el proyecto. Si agregas lógica pura (cálculo de métricas, segmentación),
  agrega tests para esa lógica.

## Reglas de trabajo

- No renombres tablas ni columnas existentes.
- No toques la lógica de suscripciones ni de facturación: es andamiaje heredado, irrelevante
  para la investigación.
- Si un cambio contradice algo de "Lo que exige la investigación", **detente y díselo al usuario**
  antes de implementarlo.
- Al terminar una tarea de `docs/`, deja anotado en ese archivo qué quedó hecho y qué no.
