# 03 — Calidad del retriever: páginas y umbral de relevancia

**Prioridad:** P2 · **Depende de:** nada · **Se puede hacer en paralelo con:** `02`
**Ítems que cierra:** #9 umbral de similitud y top-k configurable · #10 número de página

> Lee `CLAUDE.md` en la raíz antes de empezar.

## Problema

Dos defectos del retriever que un jurado técnico puede observar:

**1. El agente no puede citar la página.** `parsePDFFile` en `lib/utils.ts:135-146`
concatena el texto de todas las páginas en un solo string y recién después lo corta. La
información de página se pierde en ese paso, así que `splitIntoSegments` nunca puede
emitirla y la columna `pageNumber` de `book_segments` **queda siempre vacía**. Sin página no
hay trazabilidad académica.

**2. El retriever siempre devuelve 3 fragmentos, sean relevantes o no.** En
`app/api/vapi/search-book/route.ts:26` el límite está fijo en `3` y no hay ningún corte por
distancia. Si el estudiante pregunta algo que no está en su investigación, igual se le entregan al
LLM los 3 fragmentos menos malos, y el modelo tiende a responder como si fueran pertinentes.
Eso es justo lo que RAGAs va a penalizar.

## Objetivo

Que cada fragmento sepa de qué página salió, y que el retriever admita honestamente que no
encontró nada cuando no encontró nada.

## Qué hacer

### 1. Conservar la página durante el parseo

En `lib/utils.ts`:

- `parsePDFFile` debe construir un arreglo `{ pageNumber, text }[]` en lugar de un string
  único.
- `splitIntoSegments` debe recibir ese arreglo y emitir `pageNumber` en cada `TextSegment`.
  Mantén el tamaño de 500 palabras con solape de 50 — **no cambies esos valores**, están
  reportados en la investigación.
- Un segmento puede cruzar el borde de dos páginas por el solape. Regla simple y defendible:
  se le asigna la página donde **empieza** el segmento. Déjalo escrito en un comentario.
- Actualiza el tipo `TextSegment` en `types.d.ts` si hace falta.

`saveBookSegments` ya inserta `pageNumber` (`lib/actions/book.actions.ts:158`), así que en
cuanto el valor llegue lleno se guarda solo.

> La base de datos está vacía (ver `CLAUDE.md`): **no escribas script de backfill.**

### 2. Umbral y top-k en el retriever

En `searchBookSegments` (`lib/actions/book.actions.ts:186`):

- Agrega `distance` al `select` — el doc `01` también lo necesita para `turn_retrievals`.
- Acepta un umbral máximo de distancia coseno y descarta lo que lo supere.
- Deja `topK` y el umbral como constantes exportadas y comentadas, no como números sueltos
  dentro de la función. Van a citarse en la investigación como parámetros de configuración.
- Punto de partida razonable: `topK = 5`, umbral de distancia coseno `0.6`. **Ajústalo
  empíricamente** con consultas reales sobre un PDF de prueba y anota en el propio archivo
  con qué criterio elegiste el valor final.

### 3. Devolver las citas al agente

En `app/api/vapi/search-book/route.ts`:

- Que el texto devuelto incluya la página de cada fragmento, con un formato que el LLM pueda
  leer y repetir. Por ejemplo, anteponer `[Página 34]` a cada fragmento.
- Quita el `3` hardcodeado y usa la constante de `topK`.
- Cuando no sobreviva ningún fragmento al umbral, devuelve un mensaje explícito de que el
  tema no aparece en el documento. El mensaje actual ya existe pero hoy es inalcanzable.

## Criterio de aceptación

- Subir un PDF nuevo y verificar en la base que `book_segments.page_number` está lleno y los
  valores son crecientes y coherentes con el documento.
- Una consulta sobre un tema **presente** en la investigación devuelve fragmentos con su página.
- Una consulta sobre un tema **claramente ausente** (por ejemplo, preguntar por criptomonedas
  en una investigación de educación) devuelve el mensaje de "no encontrado", no tres fragmentos al
  azar.
- El agente puede decir "en la página X..." y el número corresponde de verdad.

## Estado

- [x] **Hecho** (2026-09-03), salvo la calibración empírica del umbral.

### Qué quedó hecho

- `parsePDFFile` (`lib/utils.ts`) ya no concatena: construye `PdfPage[]`
  (`{ pageNumber, text }`) y se lo pasa a `splitIntoSegments`.
- La segmentación se movió a **`lib/segmentation.ts`** (lógica pura, sin
  dependencias de runtime) para poder testearla. Ahí viven también
  `SEGMENT_SIZE_WORDS = 500` y `SEGMENT_OVERLAP_WORDS = 50`; los valores **no
  cambiaron**.
- Cada segmento lleva `pageNumber`. Regla, escrita en un comentario del código: un
  segmento que cruza el borde de dos páginas se atribuye a la página donde
  **empieza**.
- `types.d.ts`: nuevo tipo `PdfPage`. `TextSegment.pageNumber` ya existía.
- `lib/constants.ts`: constantes `RETRIEVER_TOP_K = 5` y
  `RETRIEVER_MAX_DISTANCE = 0.6`, comentadas para citarse en la investigación.
- `searchBookSegments` (`lib/actions/book.actions.ts`) ya devolvía `distance`;
  ahora acepta `maxDistance`, descarta lo que lo supera y registra en consola
  cuántos de los `topK` vecinos sobrevivieron al umbral.
- `app/api/vapi/search-book/route.ts`: sin el `3` hardcodeado (usa
  `RETRIEVER_TOP_K`), antepone `[Página N]` a cada fragmento y, cuando no
  sobrevive ninguno, devuelve un mensaje en español que le ordena al agente decir
  que el tema no aparece en la investigación y no inventar ni citar páginas.
- Tests de la lógica pura de segmentación en `lib/segmentation.test.mts`
  (`node:test`, sin dependencias nuevas). Se corren con `npm test`. Cubren:
  ventana y solape por defecto, página de inicio por segmento, segmento a caballo
  entre dos páginas, páginas vacías y parámetros inválidos.

### Qué NO quedó hecho

- **El umbral 0.6 no está calibrado empíricamente.** No hay investigación cargada ni base
  de datos con datos, así que no se pudieron medir distancias reales. El valor
  está marcado como `PROVISIONAL` en `lib/constants.ts`, con el criterio y el
  procedimiento de calibración escritos ahí mismo: ingestar una investigación real,
  correr ~10 consultas dentro del tema y ~10 fuera del tema, leer la columna
  `distance` de `turn_retrievals` y mover el umbral al punto medio entre la peor
  distancia dentro del tema y la mejor fuera del tema. **Ese número final es el
  que va en la investigación.**
- Los cuatro criterios de aceptación (page_number lleno y creciente, consulta
  presente, consulta ausente, el agente citando la página) **no se verificaron
  contra la base**: requieren subir un PDF real. Quedan para la misma sesión de
  calibración.

### Nota para quien siga

`splitIntoSegments` cambió de firma (`string` -> `PdfPage[]`) y de archivo
(`lib/utils.ts` -> `lib/segmentation.ts`). El único consumidor era
`parsePDFFile`, ya actualizado.
