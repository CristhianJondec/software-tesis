# 06 — Contextualización a la sustentación peruana / UNT

-- no realizar aun

> Lee antes: [`00-generalidades.md`](00-generalidades.md)

## Qué se propone

Que el simulacro se parezca a **la sustentación que el estudiante va a enfrentar realmente**,
no a una defensa genérica traducida del inglés.

Esto **no es el aporte científico** de la tesis — por sí solo no diferencia lo suficiente —
pero sí sustenta la **pertinencia contextual** del sistema y es barato de implementar.

## Qué construir

1. **Banco de preguntas frecuentes de jurado peruano**, organizado por sección de tesis.
   Ejemplos del tipo que hay que cubrir:
   - "¿Por qué su muestra es representativa de la población?"
   - "¿Qué antecedente nacional respalda su instrumento?"
   - "¿Cuál es la diferencia entre su objetivo general y sus específicos?"
   - "¿Su instrumento fue validado? ¿Por quién? ¿Alfa de Cronbach?"
   - "¿Cuál es el aporte de su investigación a la ingeniería?"
   - "¿Por qué ese diseño y no otro?"
   El banco se usa como **guía de estilo del agente**, no como lista fija: las preguntas
   siguen anclándose por RAG al documento del estudiante.
2. **Terminología académica peruana** en el system prompt: "sustentación" (no "defensa"),
   "jurado" (no "comité"), "asesor", "operacionalización de variables", "matriz de
   consistencia", "bachiller", "título profesional".
3. **Modo según tipo de investigación**: cuantitativa / cualitativa / mixta. El estudiante lo
   declara al subir su documento y eso cambia qué preguntas prioriza el agente (una tesis
   cualitativa no recibe preguntas sobre alfa de Cronbach).
4. **Estructura de sesión que imita el formato UNT**: exposición breve inicial del estudiante
   → ronda de preguntas del jurado → observaciones finales.

## Criterios de aceptación

- [ ] El agente usa vocabulario académico peruano, no traducciones genéricas.
- [ ] El tipo de investigación se declara al subir el documento y cambia las preguntas.
- [ ] El banco guía el estilo pero **toda pregunta sigue anclada al documento por RAG**.

## Qué NO hacer

- No convertir el banco en preguntas fijas sin RAG: rompería el flujo funcional obligatorio
  del punto 2 (enriquecer con fragmentos recuperados del documento del estudiante).
- No presentar esta propuesta en la tesis como el diferenciador principal.
