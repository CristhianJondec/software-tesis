# 00 — Generalidades (léeme antes de cualquier propuesta)

> Este archivo es **contexto compartido**. Cualquier chat que vaya a implementar una propuesta
> de esta carpeta debe leer **este archivo primero** y después el archivo numerado de su tarea.
> `CLAUDE.md` (raíz) ya se carga solo: stack, mapa de archivos y reglas de trabajo están ahí.

## El problema que estas propuestas resuelven

La observación recibida: *"esto se parece mucho a NotebookLM"*.

Es cierta si el software se describe como **"un chat con tu PDF, pero por voz"**. NotebookLM
ya hace chat sobre fuentes, resúmenes, mapas mentales, cuestionarios, tarjetas y audio.
Nada de eso es un aporte de tesis.

## El diferenciador que adoptamos

> **No es un asistente para consultar un documento. Es un entrenador de sustentación oral
> que usa la investigación del propio estudiante como fuente, escala progresivamente la
> exigencia del simulacro y mide si eso reduce la ansiedad ante la exposición.**

Lo que nos separa de NotebookLM no es el RAG ni la voz. Es el **ciclo cerrado**:

```
Medir ansiedad (STAI / PRCS-12 / 0-10 por sesión)
      ↓
Practicar la sustentación (agente en rol de jurado)
      ↓
Analizar desempeño (contenido, estructura, indicadores conductuales)
      ↓
Adaptar la dificultad de la siguiente sesión
      ↓
Volver a practicar
      ↓
Medir progreso (T1 vs T2 + evolución intra-sesiones)
```

NotebookLM no adapta, no mide ansiedad, no compara sesiones y no entrena una conducta.

## Reglas transversales (obligan a TODAS las propuestas)

1. **Nunca afirmar que el sistema "detecta ansiedad".** No hay validación psicológica ni
   fisiológica para eso. El sistema **registra indicadores conductuales observables**
   (latencia de inicio de respuesta, silencios, respuestas incompletas, solicitudes de
   reformulación) y **recoge autoevaluación** (0–10). La palabra "ansiedad" solo se usa
   cuando viene de un instrumento validado que respondió el estudiante.
2. **La adaptación de dificultad se basa principalmente en la autoevaluación del estudiante**,
   apoyada por indicadores de desempeño. No al revés.
3. **Todo lo que el sistema muestre al estudiante debe ser trazable a evidencia registrada**
   ("tardaste 8 s en iniciar", "no mencionaste la muestra"), no a frases genéricas
   ("lo hiciste muy bien", "te noté nervioso").
4. **Todo lo nuevo debe dejar dato medible en base de datos.** Si una función no genera una
   fila consultable para el capítulo de resultados, no entra.
5. **Español en toda la UI**, inglés en código y comentarios. Sin excepción.
6. **No renombrar tablas ni columnas existentes** (`books`, `bookSegments`, `searchBook`).
7. **No romper el flujo funcional obligatorio** (STT → recuperación → LLM anclado → TTS,
   síncrono y repetido) ni las 4 métricas (ICA, PR, LP, RAGAs). Si una propuesta lo
   contradice, **detente y avisa al usuario**.

## Lo que ya existe (no lo vuelvas a construir)

- Agente de voz con rol de jurado + RAG sobre el PDF del estudiante.
- Instrumentos: STAI, PRCS-12 y SUS (`lib/surveys/catalog.ts`, `scoring.ts`, `progress.ts`).
- Registro de sesiones, turnos y evaluaciones (`voiceSessions`, `sessionTurns`,
  `turnEvaluations`, `surveyResponses`).
- `participantCode` y `studyGroup` (experimental / control).
- Latencias instrumentadas y métricas ICA / PR / LP / RAGAs.

## Lo que está prohibido proponer como diferenciador

- Resumir PDFs, generar podcasts, mapas mentales o flashcards → ya es NotebookLM.
- Realidad virtual, reconocimiento facial, detección automática de emociones por voz o
  rostro → amplían el alcance, abren problemas éticos y de privacidad, y exigen validación
  que esta tesis no tiene tiempo de hacer.
- Cualquier función que no aporte a *reducir ansiedad ante la sustentación*.

## Título sugerido para la tesis

> *Diseño e implementación de un agente conversacional por voz basado en RAG y exposición
> gradual adaptativa, orientado a reducir la ansiedad ante la sustentación de investigaciones
> en estudiantes universitarios.*

Usar **"orientado a reducir"** hasta que los resultados muestren reducción estadísticamente
significativa.

## Frase de defensa ante el jurado

> "El aporte no es otro chatbot para consultar documentos. Es un sistema de entrenamiento oral
> personalizado que usa la investigación del estudiante como fuente, simula progresivamente
> una sustentación real y adapta el nivel de exigencia a partir de indicadores de desempeño y
> de la autoevaluación de ansiedad del estudiante."

## Índice de propuestas

| # | Propuesta | Peso en el aporte | Depende de |
|---|---|---|---|
| [01](01-exposicion-gradual-adaptativa.md) | Exposición gradual adaptativa (4 niveles) | **Núcleo** | — |
| [02](02-retroalimentacion-tres-dimensiones.md) | Retroalimentación en 3 dimensiones | Alto | 01 |
| [03](03-mapa-de-preparacion.md) | Mapa de preparación para la sustentación | Alto | — |
| [04](04-prediccion-vs-realidad.md) | Registro de predicciones vs. resultados | Alto | 01 |
| [05](05-evidencias-de-avance.md) | Retroalimentación positiva basada en evidencia | Medio | 01, 02 |
| [06](06-contexto-untrujillo.md) | Contextualización a la sustentación peruana / UNT | Medio | — |
| [07](07-diseno-experimental.md) | Diseño experimental de 3 sesiones + grupo control | **Núcleo** | 01 |

**Orden sugerido:** `01` → (`02`, `03`, `04` en paralelo) → `05` → `06` → `07`.
`07` define el protocolo; conviene leerlo temprano aunque se implemente al final.
