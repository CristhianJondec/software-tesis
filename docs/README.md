# Plan de trabajo — Agente conversacional por voz con RAG

Cada archivo numerado es el prompt de **un chat nuevo**. Abre el chat, indica qué documento
seguir, y ese chat hace solo esa tarea.

`CLAUDE.md` (en la raíz) se carga automáticamente en cada sesión de Claude Code: contiene el
contexto del proyecto, el stack, las exigencias de la investigación y las decisiones ya tomadas. No
hace falta pegarlo.

## Orden de ejecución

```
01 ──┬── 02 ──┐
     │        ├── 04 ── 05
     └── 03 ──┘
```

1. **`01`** primero, solo. Crea el esquema del que todo lo demás lee.
2. **`02`** y **`03`** después, **en paralelo**: no tocan los mismos archivos.
3. **`04`** cuando `01` esté listo y ya haya sesiones reales grabadas.
4. **`05`** al final, cuando el código ya no vaya a cambiar.

## Los documentos

| Doc | Tarea | Prioridad | Ítems |
|---|---|---|---|
| [01](01-persistencia-instrumentacion.md) | Persistencia de turnos e instrumentación de latencias | P0 | #1 #2 #3 #12 |
| [02](02-agente-evaluador.md) | Agente en rol de docente evaluador | P0 | #4 #8 #11 #13 |
| [03](03-calidad-retriever.md) | Páginas y umbral de relevancia en el retriever | P2 | #9 #10 |
| [04](04-metricas-evaluacion.md) | ICA, PR, LP y RAGAs + ruta `/metrics` | P1 | #5 #6 #7 |
| [05](05-arquitectura-evidencia-ica.md) | Documentación de arquitectura y evidencia del ICA | P1 | — |

**Entregable del doc `05`:** [`arquitectura.md`](arquitectura.md) — el documento que un
jurado lee sin abrir el código: flujo funcional, evidencia del ICA, decisiones técnicas,
limitaciones y resultados de las métricas.

## Por qué esta agrupación

Los grupos se armaron por **colisión de archivos**, no por prioridad, para que dos chats
nunca editen lo mismo:

- `01` concentra todo lo que toca migraciones + `useVapi.ts` + `session.actions.ts`. Las dos
  latencias y la persistencia comparten los mismos event handlers; separarlas obligaría a
  tres chats a pelearse el mismo hook.
- `02` es el único que toca la configuración del agente. Aislado a propósito: es el cambio
  conceptualmente delicado de la investigación.
- `03` vive en `lib/utils.ts` y `lib/actions/book.actions.ts`. No se cruza con `01` ni `02`.
- `04` es puro consumo de datos: no puede empezar antes porque necesita sesiones reales.
- `05` es documentación y va al final por definición.

## Ya cubierto (no hay tarea pendiente)

- Los 5 componentes del ICA están integrados → ICA = 100%
- Los 3 requisitos funcionales del Product Backlog: interacción por voz, carga del documento,
  recuperación por RAG
- Pasos 1, 2, 4 y 5 del flujo funcional
- Español, internet, micrófono

El hueco no está en las funciones, está en **el rol del agente** (doc `02`) y en **la
instrumentación de métricas** (docs `01` y `04`).

## Fuera del software

Las encuestas de medición (basal y post-intervención) se aplican **por fuera de la app**. La
app solo aporta el `participantCode` y el `studyGroup` que agrega el doc `01`, para poder
cruzar cada encuesta con el uso real: cuántas sesiones, cuánto duraron, y cómo evolucionó la
latencia de respuesta verbal del estudiante.

> Verifica que el instrumento mida **autoeficacia**, que es lo declarado en los objetivos.
