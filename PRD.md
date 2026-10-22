# PRD — Simulador de sustentación por voz

## Qué es

Aplicación web donde un estudiante universitario sube el avance de su investigación (PDF) y
practica la sustentación conversando **por voz** con un agente que actúa como **docente
evaluador**. El agente hace preguntas **ancladas en el propio documento** del estudiante
(RAG), citando páginas. Opera solo en español.

Es el artefacto tecnológico de una tesis (Universidad Nacional de Trujillo, 2026). Además
de funcionar, debe **producir evidencia medible** para el capítulo de resultados.

## Usuarios

- **Grupo experimental:** sube su investigación, practica con el agente de voz y responde las encuestas.
- **Grupo control:** sin agente; solo lee materiales escritos (`/materiales`) y responde las encuestas (`/surveys`).
- **Sin asignar:** espera en `/sin-asignar` hasta que el admin le asigne grupo.
- **Admin / investigador:** asigna grupos, sube materiales y consulta las métricas (`/metrics`).

## Flujo principal (experimental)

1. Sube el PDF y elige la voz (femenina o masculina, español peruano).
2. El PDF se segmenta (500 palabras, solape de 50) y se embebe en pgvector.
3. Antes de cada sesión da una autoevaluación de ansiedad (0–10); el sistema sugiere un nivel de exigencia (1–4).
4. Conversación por voz: STT → el LLM consulta `searchBook` (retriever) → pregunta anclada → TTS. El ciclo se repite (máximo 20 min).
5. Al colgar ve un resumen escrito, da su autoevaluación final y recibe un informe de la sesión.
6. Puede consultar su progreso entre sesiones (`/progreso`).

## Requisitos no negociables

- 5 componentes integrados: **STT, LLM, base vectorial, retriever, TTS**.
- Toda pregunta de contenido se basa en fragmentos recuperados del documento; nada inventado.
- Se registra por turno la **latencia del sistema** y la **latencia de respuesta del estudiante**.
- Métricas reportables: **ICA** (declarado y observado), **PR** (revisión humana), **LP**, **RAGAs** (adaptación en TypeScript) y exportación CSV.
- Solo español; requiere internet, micrófono y parlantes.

## Stack

Next.js 16 (App Router, Server Actions) · Postgres + pgvector (Drizzle) · Better Auth ·
Vapi (Deepgram STT, GPT-4o, Azure TTS es-PE) · Gemini embeddings (768) y juez · Cloudflare R2.

## Fuera de alcance

Suscripciones y facturación (andamiaje heredado), otros idiomas y grabación de audio.

## Referencias

`CLAUDE.md` (contexto y reglas) · `docs/` (tareas, propuestas, configuración del agente).
