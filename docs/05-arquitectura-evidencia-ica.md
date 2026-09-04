# 05 — Documentación de arquitectura y evidencia del ICA

**Prioridad:** P1 · **Depende de:** `01`, `02`, `03`, `04` terminados
**Cierra:** la evidencia documental que pide el Anexo 3 y el capítulo de arquitectura

> Lee `CLAUDE.md` en la raíz antes de empezar.
> Hazlo **al final**, cuando el código ya no vaya a cambiar. Si lo escribes antes, la
> documentación va a mentir.

## Problema

El repositorio no tiene ningún documento de arquitectura propio: el `README.md` sigue siendo
el del proyecto original de "chat con libros". No hay diagrama del flujo, ni justificación de
las decisiones técnicas, ni evidencia trazable de que los 5 componentes del ICA están
integrados.

El ICA da 100% en la realidad, pero **afirmarlo no es demostrarlo**.

## Objetivo

Un documento que un jurado pueda leer sin abrir el código y quedar convencido de que la
arquitectura descrita en la investigación es la que está implementada.

## Qué hacer

Escribe `docs/arquitectura.md` con estas secciones:

### 1. Diagrama del flujo funcional

Un diagrama Mermaid que reproduzca los 5 pasos del flujo declarado en la investigación: voz del
estudiante → STT → recuperación RAG → LLM en rol evaluador → TTS → vuelta al estudiante.

Marca con claridad **qué corre en Vapi y qué corre en este software**. Es la primera
pregunta que va a hacer el jurado, y la respuesta honesta favorece: delegar STT y TTS a un
servicio especializado es una decisión de arquitectura, no una carencia.

### 2. Tabla de evidencia del ICA

Una fila por componente, con cuatro columnas: componente previsto · implementación concreta ·
archivo o configuración donde se verifica · estado.

| Componente | Implementación | Evidencia |
|---|---|---|
| STT | Vapi (transcriber, `language: es`) | `docs/agente/vapi-config.md` |
| LLM | (el que se documentó en el doc `02`) | `docs/agente/vapi-config.md` |
| Base de datos vectorial | Postgres + pgvector, índice HNSW cosine | `database/schema/bookSegments.ts` |
| Retriever | Búsqueda por distancia coseno con umbral | `lib/actions/book.actions.ts` |
| TTS | Vapi + ElevenLabs | `lib/constants.ts` |

Cierra con el cálculo: `ICA = (5/5) × 100 = 100%`.

### 3. Decisiones técnicas y su justificación

La investigación dejó abierto qué LLM, qué embeddings y qué base vectorial usar. Aquí se cierra, y
cada elección necesita su razón:

- **Gemini `text-embedding-004`, 768 dimensiones** — rendimiento en español, distinción
  entre `RETRIEVAL_DOCUMENT` y `RETRIEVAL_QUERY`.
- **pgvector con índice HNSW** — evita sumar un servicio externo de base vectorial.
- **Segmentación de 500 palabras con solape de 50** — justifica el tamaño y qué pasa con el
  contexto en los bordes.
- **Vapi** — única tecnología presupuestada en la investigación (Tabla 6 y Tabla 12).
- **Configuración del agente aplicada manualmente** en el dashboard: declara la limitación
  de reproducibilidad que ya quedó anotada en el doc `02`.
- **Adaptación de RAGAs a TypeScript**: traslada aquí la nota de honestidad metodológica del
  doc `04`. No la escondas en un comentario del código.

### 4. Limitaciones operativas

Las que la investigación ya declara — solo español, requiere internet, requiere micrófono y
parlantes, no replica la presencia física de un evaluador real — más las que hayan aparecido
durante el desarrollo. Una limitación descubierta y declarada suma credibilidad; una
descubierta por el jurado, resta.

### 5. Resultados de las métricas

Los valores reales que arrojó `/metrics` (doc `04`), con la fecha de medición y el n de cada
una. Si alguna quedó sin datos suficientes, dilo con esas palabras en vez de omitirla.

## Criterio de aceptación

- Un lector que no abra el código entiende cómo funciona el sistema completo.
- Cada uno de los 5 componentes del ICA tiene evidencia verificable señalada por archivo.
- Cada decisión técnica que la investigación dejó abierta está cerrada y justificada.
- Ninguna afirmación del documento contradice lo que hace el código.

## Estado

- [x] **Hecho** (2026-09-04) — `docs/arquitectura.md` escrito. §6 (resultados) queda con las
  métricas declaradas **sin datos suficientes**, porque todavía no hay sesiones instrumentadas.

### Qué quedó hecho

`docs/arquitectura.md`, con las cinco secciones que pedía la tarea y tres agregadas:

| Sección | Contenido |
|---|---|
| 1 | Qué es el sistema; separa el flujo de **ingesta** del flujo de **sustentación** |
| 2 | Diagrama Mermaid del flujo funcional, con subgrafos que separan **navegador / Vapi / este software / Postgres**, más los cinco pasos explicados uno por uno |
| 3 | Tabla de evidencia del ICA (componente · implementación · archivo donde se verifica · dónde corre · estado) y el cálculo `(5/5)×100 = 100 %`. Incluye §3.1: el índice se **deriva** de `lib/metrics/architecture.ts`, no está escrito a mano |
| 4 | Nueve decisiones técnicas justificadas: embeddings, pgvector/HNSW, segmentación 500/50 y la regla de página, retriever (top-K y umbral), Vapi, config manual del dashboard, **la nota de honestidad metodológica de RAGAs**, los dos relojes de latencia, y las decisiones de seguridad y acceso |
| 5 | Limitaciones: las declaradas en la investigación, las **descubiertas durante el desarrollo**, lo que el software deliberadamente no mide, y el umbral sin calibrar |
| 6 | Resultados de las métricas con fecha de medición y n |
| 7 | *(agregada)* Cómo verificar cada afirmación del documento sin recorrer el repositorio |
| 8 | *(agregada)* Reglas de mantenimiento para que el documento no se despegue del código |

**La nota de honestidad metodológica de RAGAs (§4.7) se trasladó desde el doc `04`**, como
pedía la tarea: está en el cuerpo del documento, tabla por métrica, con el desvío de cada una y
una redacción sugerida para la investigación. No quedó escondida en un comentario del código.

**Limitaciones nuevas, no listadas en la tarea, encontradas al escribir el documento:**

- **Un PDF escaneado sin capa de texto produce cero segmentos**: no hay OCR. El documento se
  sube y el agente se queda sin nada a lo que anclarse.
- **La extracción no distingue estructura**: tablas, fórmulas, encabezados y pies de página
  entran al flujo de palabras como texto corrido.
- **El webhook no valida `VAPI_SERVER_SECRET`** (la variable existe, la ruta no la verifica).
  Ya estaba anotada en `vapi-config.md`; ahora está declarada como limitación del artefacto.

### Qué NO quedó hecho

- **§6 no tiene valores.** Verificado contra la base el 2026-09-04: 2 usuarios (0 con
  `participant_code`), 2 documentos, **0 segmentos**, 13 sesiones (todas anteriores al doc `01`)
  y **0 turnos, 0 recuperaciones, 0 evaluaciones, 0 puntajes RAGAs**. La única métrica con valor
  es el **ICA = 100 %**, que no depende de que haya sesiones: se verifica por inspección del
  código. LP, la latencia del estudiante, PR y las cuatro RAGAs están escritas como **"sin datos
  suficientes"** con `n = 0`, no omitidas y no en cero.
- **§6.3 es la lista de nueve pasos** que hay que completar antes de poder llenar esa tabla, en
  orden. Los tres primeros son bloqueantes: aplicar la config en el dashboard de Vapi
  (con `sessionId` en el tool), confirmar el modelo LLM real e ingestar una investigación.
- **El umbral `RETRIEVER_MAX_DISTANCE = 0.6` sigue provisional** (viene del doc `03`). El
  documento lo dice en §4.4 y §5.4: **el número que va a la investigación es el calibrado, no el
  0.6**. Cuando se calibre, hay que corregir `lib/constants.ts` **y** §4.4.
- **El `README.md` de la raíz sigue siendo el del proyecto original** de "chat con libros"
  (menciona Clerk y MongoDB, que este proyecto no usa). La tarea pedía `docs/arquitectura.md`,
  no reescribir el README, así que no se tocó. Vale la pena hacerlo antes de entregar el
  repositorio, aunque sea para que no contradiga al documento de arquitectura.

### Advertencia de mantenimiento

El documento afirma cosas verificables sobre archivos concretos. Si el código cambia y el
documento no, la evidencia deja de valer y el efecto es peor que no haberlo escrito. §8 fija
las tres reglas: parámetro que cambia → §4 en el mismo commit; dashboard que cambia →
`docs/agente/` y §3; medición nueva → §6 reescrita completa, sin mezclar fechas.
