# 07 — Diseño experimental: 3 sesiones + grupo control real

-- parcialmente implementado: los dos grupos sí; el protocolo de 3 sesiones no

> Lee antes: [`00-generalidades.md`](00-generalidades.md) · Depende de [`01`](01-exposicion-gradual-adaptativa.md)
> **Núcleo del aporte.** Sin esto, las demás propuestas no se pueden *demostrar*.

## El problema del diseño actual

Medir STAI/PRCS-12 antes y después de **un solo uso** del sistema demuestra, como mucho,
que "usar IA ayuda". Eso es débil ante un jurado y no aísla el aporte.

## Qué se propone

**Intervención de 3 sesiones con dificultad progresiva**, y un grupo control que use el
mismo software **sin adaptación**.

### Protocolo por participante

| Momento | Qué ocurre |
|---|---|
| T1 (basal) | STAI + PRCS-12, antes de cualquier uso |
| Sesión 1 | 10–15 min. Nivel inicial según autoevaluación. Escala 0–10 antes y después |
| Sesión 2 | 10–15 min. Nivel adaptado. Misma estructura de preguntas |
| Sesión 3 | 10–15 min. Nivel adaptado. Misma estructura de preguntas |
| T2 (post) | STAI + PRCS-12 + SUS, al terminar la sesión 3 |
| T3 (opcional) | Seguimiento a 1 semana: PRCS-12 |

### Los dos grupos (usa el `studyGroup` que ya existe)

> **Decisión tomada (2026-09-19): el control es pasivo.** Lo que sigue en esta sección
> describía un control activo (mismo agente con dificultad fija). Se descartó. Lo
> implementado es el control pasivo descrito más abajo en "Lo implementado".

- **Experimental:** agente con exposición gradual adaptativa (propuesta `01`),
  retroalimentación en 3 dimensiones (`02`) y evidencias de avance (`05`).
- ~~**Control:** el mismo agente de voz con RAG sobre su documento, pero con
  **dificultad fija** (siempre nivel 3), sin adaptación, sin evidencias de avance
  comparativas.~~

Con un control activo la hipótesis habría sido *"la adaptación progresiva produce un
beneficio adicional sobre el mismo sistema sin adaptar"*. Con el control pasivo que se
implementó, la hipótesis es **"la práctica hablada con un agente anclado en el propio
documento reduce la ansiedad más que el material de preparación escrito"** — que es la
comparación contra la práctica habitual, no contra una versión degradada del sistema.

## Lo implementado (2026-09-19)

**Control pasivo.** Los dos roles existen en código y `studyGroup` decide qué ve cada uno:

| | Experimental | Control |
|---|---|---|
| Biblioteca, subir investigación, sesión de voz | Sí | No |
| Historial, mapa de preparación, progreso | Sí | No |
| Encuestas (`/surveys`) | Sí | Sí, sin SUS |
| Materiales (`/materiales`) | Sí | Sí |

- **Un solo punto de decisión:** `lib/study/groups.ts` (reglas puras) y
  `lib/study/access.ts` (guardas de servidor). Ningún `if` de grupo fuera de ahí.
- **Tres estados, no dos.** `study_group = NULL` es "todavía no es participante": la
  cuenta no entra a ninguna de las dos vistas y aterriza en `/sin-asignar`. Así nadie
  produce datos fuera del protocolo por el solo hecho de registrarse.
- **La asignación es del investigador.** Se hace en `/admin` con
  `setParticipantStudyGroup`, nunca desde una pantalla del participante: el protocolo
  prohíbe que el estudiante sepa o elija su grupo.
- **El material del control está emparejado en contenido.** `lib/materials/guide.ts` se
  construye sobre `PREPARATION_TOPICS`, los mismos 12 temas sobre los que el agente
  examina al grupo experimental. Lo que cambia entre grupos es la *entrega* (leer vs.
  sustentar en voz alta), no la materia. Sin ese emparejamiento, una diferencia entre
  grupos podría explicarse por "el experimental recibió más información".
- **Los PDF compartidos** se suben desde `/admin` (tabla `study_materials`, R2) y los ven
  los dos grupos.
- Los investigadores (`ADMIN_EMAIL`, `METRICS_OWNER_EMAILS`) pasan por encima de la
  restricción: si no, quien asigna los grupos quedaría fuera del panel donde se asignan.

**Lo que no se hizo y sigue pendiente de este documento:** el protocolo de 3 sesiones
(puntos 2 y 3 de "Qué construir"). Hoy `/surveys` desbloquea T2 para el control apenas
termina T1, porque su condición de avance (`hasConversation`) no aplica a un grupo que no
conversa. Antes de recolectar hay que decidir qué evento del control desbloquea T2.

## Qué construir

1. **Bandera de comportamiento por grupo.** `studyGroup` ya existe; debe **efectivamente
   cambiar** el comportamiento del agente. Un solo punto de decisión, no `if` esparcidos.
2. **Estado del protocolo por participante:** en qué sesión va, si completó T1, si ya puede
   hacer T2. El sistema debe bloquear T2 hasta completar la sesión 3, y bloquear la sesión 1
   hasta completar T1.
3. **Escala 0–10 por sesión** (viene de la propuesta `01`) — es la medida repetida que permite
   ver la curva intra-sujeto, no solo el pre/post.
4. **Exportación de datos para análisis** (CSV): una fila por participante con
   `participantCode`, `studyGroup`, STAI T1/T2, PRCS T1/T2, SUS, y por sesión: nivel,
   ansiedad 0–10 pre/post, latencia media de inicio, puntajes por dimensión, temas dominados.
   Sin datos personales: solo `participantCode`.
5. **Panel del investigador**: cuántos participantes en cada grupo, en qué etapa está cada uno,
   quiénes tienen el protocolo incompleto.

## Criterios de aceptación

- [ ] `studyGroup` cambia realmente el comportamiento del agente.
- [ ] El sistema impide saltarse el orden T1 → S1 → S2 → S3 → T2.
- [ ] El CSV exportado es suficiente para correr el análisis estadístico sin tocar la base.
- [ ] El export no contiene nombres ni correos, solo `participantCode`.

## Qué NO hacer

- No revelarle al participante a qué grupo pertenece.
- No mostrar puntajes de STAI/PRCS-12 al participante antes de T2.
- No cambiar el protocolo a mitad de la recolección: invalida la muestra.

## Nota para la redacción de la tesis

Declarar explícitamente como limitación: muestra por conveniencia, sin aleatorización ciega
del evaluador, y ausencia de medición fisiológica de ansiedad. Declararlo fortalece la tesis;
ocultarlo la debilita.
