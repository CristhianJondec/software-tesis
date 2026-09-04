# Gestión del proyecto con metodología Scrum

**Proyecto:** Agente conversacional por voz con RAG para la simulación de sustentaciones de avances de investigación  
**Institución:** Universidad Nacional de Trujillo  
**Periodo de trabajo:** 1 de abril al 30 de agosto de 2026  
**Modalidad:** Scrum individual  
**Versión del documento:** 1.0

> Este documento presenta la planificación y el seguimiento académico del proyecto bajo Scrum.
> Las fechas corresponden al periodo de desarrollo declarado para el proyecto. Los valores de las
> métricas de evaluación deben completarse con mediciones reales, no con estimaciones.

## 1. Visión del producto

Desarrollar una aplicación web que permita a un estudiante cargar su avance de investigación en
PDF y practicar una sustentación mediante una conversación de voz. El agente asume el rol de
docente evaluador, formula preguntas en español y utiliza recuperación aumentada por generación
(RAG) para anclar sus intervenciones en el documento del estudiante.

### Objetivo del producto

Entregar un prototipo funcional que integre voz en tiempo real, procesamiento de documentos,
base de datos vectorial, recuperación de contexto y registro de evidencias para evaluar la
calidad de las sesiones.

### Usuarios y partes interesadas

- **Estudiante:** carga su investigación y practica la sustentación.
- **Investigador/desarrollador:** configura el sistema y revisa las sesiones y métricas.
- **Asesor o jurado:** consulta la evidencia técnica y los resultados del prototipo.

## 2. Aplicación de Scrum en un proyecto individual

Al tratarse de un trabajo individual, una misma persona asumió los tres roles de Scrum, manteniendo
separadas sus responsabilidades durante cada sprint:

| Rol Scrum | Responsable | Responsabilidad |
|---|---|---|
| Product Owner | Desarrollador | Definir el valor, priorizar el Product Backlog y validar los incrementos. |
| Scrum Master | Desarrollador | Organizar los sprints, retirar impedimentos y registrar las retrospectivas. |
| Developer | Desarrollador | Analizar, diseñar, programar, probar y documentar el producto. |

La planificación se organizó en sprints de dos semanas, con una revisión y una retrospectiva al
cierre de cada sprint. La capacidad estimada fue de una persona, por lo que se priorizó primero
el flujo mínimo funcional y después la instrumentación para la investigación.

## 3. Product Backlog

La prioridad utiliza `P0` para funcionalidades imprescindibles, `P1` para funcionalidades
importantes y `P2` para mejoras. Los puntos de historia siguen una escala relativa de Fibonacci.

| ID | Historia de usuario | Prioridad | Puntos | Criterio de aceptación resumido | Estado |
|---|---|---:|---:|---|---|
| PB-01 | Como estudiante, quiero registrarme e iniciar sesión para proteger mi investigación. | P0 | 3 | El acceso funciona y las rutas privadas exigen una sesión válida. | Terminado |
| PB-02 | Como estudiante, quiero cargar un PDF de investigación para usarlo en la práctica. | P0 | 5 | El PDF se valida, almacena y muestra en la biblioteca del usuario. | Terminado |
| PB-03 | Como sistema, quiero extraer y segmentar el PDF para preparar su contenido. | P0 | 5 | El texto se extrae por páginas y se divide en segmentos de 500 palabras con solape de 50. | Terminado |
| PB-04 | Como sistema, quiero generar embeddings y guardarlos en una base vectorial. | P0 | 8 | Cada segmento queda asociado al documento y puede consultarse por similitud coseno. | Terminado |
| PB-05 | Como estudiante, quiero hacer preguntas sobre mi documento y recibir contexto relevante. | P0 | 8 | El retriever devuelve los mejores fragmentos, aplica top-K y descarta resultados bajo el umbral. | Terminado |
| PB-06 | Como estudiante, quiero conversar por voz con el sistema en tiempo real. | P0 | 8 | La sesión integra STT, LLM y TTS, y permite iniciar y finalizar una conversación. | Terminado |
| PB-07 | Como estudiante, quiero que el agente actúe como docente evaluador. | P0 | 5 | El agente pregunta sobre problema, metodología, resultados y conclusiones con tono académico. | Terminado |
| PB-08 | Como estudiante, quiero que las preguntas estén ancladas en mi investigación. | P0 | 5 | Antes de preguntar sobre contenido, el agente consulta `searchBook`; si no hay contexto, no inventa. | Terminado |
| PB-09 | Como usuario, quiero conversar en español y seleccionar una voz. | P1 | 3 | La configuración usa español y permite elegir una voz disponible antes de la sesión. | Terminado |
| PB-10 | Como investigador, quiero guardar cada sesión, turno y fragmento recuperado. | P0 | 8 | Se persisten hablante, contenido, tiempos, latencias y evidencia recuperada. | Terminado |
| PB-11 | Como investigador, quiero medir la latencia del sistema y del estudiante. | P1 | 5 | Se calculan LP y latencia verbal del estudiante por sesión y participante. | Terminado |
| PB-12 | Como investigador, quiero evaluar manualmente la precisión de las respuestas. | P1 | 5 | Una pantalla permite marcar respuestas correctas o incorrectas y añadir observaciones. | Terminado |
| PB-13 | Como investigador, quiero calcular RAGAs para valorar el anclaje documental. | P1 | 8 | Se calculan las métricas sobre pregunta, contexto y respuesta persistidos. | Terminado |
| PB-14 | Como investigador, quiero consultar y exportar las métricas del proyecto. | P1 | 5 | `/metrics` muestra ICA, PR, LP y RAGAs, y permite exportar los datos en CSV. | Terminado |
| PB-15 | Como jurado, quiero consultar la arquitectura y su evidencia técnica. | P1 | 3 | Existe documentación trazable del flujo, componentes, decisiones y limitaciones. | Terminado |
| PB-16 | Como investigador, quiero identificar al participante y grupo de estudio. | P1 | 3 | El usuario puede asociarse a un código de participante y grupo experimental o control. | Terminado |

**Total estimado:** 87 puntos de historia.  
**Incremento mínimo viable:** PB-01 a PB-08.  
**Incremento final:** PB-01 a PB-16, con documentación y pruebas de las funciones críticas.

## 4. Sprint Backlog y calendario

| Sprint | Fechas | Objetivo del sprint | Historias principales | Incremento entregado |
|---|---|---|---|---|
| S0 | 01–05 abril | Preparar el producto y validar el alcance. | Visión, riesgos y backlog inicial | Alcance definido, arquitectura inicial y criterios de aceptación. |
| S1 | 06–19 abril | Construir la base de la aplicación. | PB-01 | Autenticación, sesiones y estructura base de la interfaz. |
| S2 | 20 abril–03 mayo | Permitir gestionar investigaciones. | PB-02 | Carga, almacenamiento y visualización de documentos PDF. |
| S3 | 04–17 mayo | Preparar el contenido para RAG. | PB-03, PB-04 | Extracción, segmentación, embeddings y persistencia vectorial. |
| S4 | 18–31 mayo | Implementar la conversación de voz. | PB-06, PB-09 | Sesión de voz con STT, LLM, TTS, selección de voz y transcripción. |
| S5 | 01–14 junio | Convertir el asistente en evaluador académico. | PB-07, PB-08 | Prompt del docente evaluador, búsqueda obligatoria y respuestas en español. |
| S6 | 15–28 junio | Generar evidencia de cada conversación. | PB-10, PB-16 | Sesiones, turnos, recuperaciones, código de participante y latencias. |
| S7 | 29 junio–12 julio | Mejorar la trazabilidad y calidad del retriever. | PB-05 | Páginas de origen, top-K configurable y umbral de relevancia. |
| S8 | 13–26 julio | Implementar evaluación de respuestas. | PB-11, PB-12 | Cálculo de latencias y revisión manual de precisión. |
| S9 | 27 julio–09 agosto | Integrar las métricas de investigación. | PB-13, PB-14 | ICA, PR, LP, RAGAs, pantalla `/metrics` y exportación CSV. |
| S10 | 10–23 agosto | Consolidar el producto y la evidencia. | PB-15, ajustes PB-01–PB-14 | Pruebas integrales, correcciones, documentación de arquitectura y limitaciones. |
| S11 | 24–30 agosto | Preparar la entrega final. | Correcciones finales y revisión del incremento | Versión candidata, respaldo de evidencias y cierre del proyecto. |

## 5. Ceremonias y artefactos

### Sprint Planning

Al inicio de cada sprint se seleccionaron historias según prioridad, dependencias y capacidad de
una persona. Cada historia se dividió en tareas técnicas, de prueba y de documentación.

### Daily Scrum

Se realizó un seguimiento breve y personal con tres preguntas: qué se completó, qué se haría a
continuación y qué impedimento debía resolverse. Los impedimentos se registraron como decisiones
técnicas o tareas pendientes.

### Sprint Review

Al cierre de cada sprint se verificó el incremento ejecutando el flujo disponible: iniciar sesión,
cargar un PDF, iniciar una sesión de voz, recuperar contexto y revisar la evidencia generada.

### Sprint Retrospective

Se revisó qué funcionó, qué debía mejorarse y qué acción concreta se incorporaría al siguiente
sprint. En un equipo individual, esta ceremonia permitió evitar que la programación desplazara las
pruebas y la documentación.

## 6. Definition of Ready

Una historia podía entrar a un sprint cuando tenía un objetivo claro, criterios de aceptación
verificables, prioridad definida, dependencias identificadas y una estimación en puntos de historia.

## 7. Definition of Done

Una historia se consideró terminada cuando:

- la funcionalidad estaba implementada e integrada en la aplicación;
- los datos de entrada se validaban y se respetaba la autorización del usuario;
- la interfaz y los mensajes estaban en español;
- se verificaba el flujo principal y los casos de error relevantes;
- la lógica pura incorporaba pruebas automatizadas cuando correspondía;
- la documentación técnica o de configuración quedaba actualizada;
- no se exponían claves ni credenciales en el repositorio.

## 8. Riesgos e impedimentos gestionados

| Riesgo | Impacto | Tratamiento |
|---|---|---|
| Dependencia de Vapi, ElevenLabs, Gemini y almacenamiento externo | Alto | Documentar variables de entorno, configuración, límites y comportamiento ante errores. |
| Respuestas del agente no sustentadas en el PDF | Alto | Hacer obligatoria la recuperación, aplicar umbral de relevancia y registrar fragmentos. |
| Pérdida de sesiones o turnos | Alto | Persistir sesiones, turnos y recuperaciones en la base de datos. |
| Falta de datos reales para calcular métricas | Alto | Separar la implementación de métricas de la recolección; reportar `n` y no inventar resultados. |
| Trabajo individual y alcance amplio | Medio | Priorizar el MVP, usar sprints cortos y dejar suscripciones como andamiaje fuera del alcance. |
| Configuración del assistant fuera del repositorio | Medio | Versionar el prompt y la configuración de referencia en `docs/agente/`. |

## 9. Resultado del proyecto

Al finalizar el periodo se obtuvo un incremento funcional compuesto por:

1. autenticación y biblioteca de investigaciones;
2. carga, segmentación y vectorización de documentos PDF;
3. recuperación de fragmentos con página y umbral de relevancia;
4. conversación de voz en español con el agente en rol de docente evaluador;
5. persistencia de sesiones, turnos, latencias y recuperaciones;
6. evaluación de precisión, métricas ICA, PR, LP y RAGAs, y exportación de resultados;
7. documentación de arquitectura, decisiones técnicas, limitaciones y evidencias.

El alcance se limitó a un prototipo de investigación: requiere internet, micrófono, parlantes y
servicios externos configurados. Las encuestas de la investigación se aplican fuera de la
aplicación; el sistema solo registra el código y grupo del participante para facilitar el cruce
posterior.

## 10. Retrospectiva final

**Qué funcionó:** priorizar primero el flujo estudiante–PDF–voz–RAG permitió validar el valor del
producto antes de construir el módulo de métricas. La documentación versionada facilitó justificar
las decisiones ante un jurado.

**Qué se mejoraría:** realizar antes pruebas con documentos académicos reales, calibrar el umbral
del retriever con un conjunto de consultas representativo y automatizar la sincronización de la
configuración del assistant cuando el proveedor lo permita.

**Acción posterior:** ejecutar una prueba piloto, recolectar sesiones reales, completar las
evaluaciones humanas y reportar los resultados estadísticos sin reemplazarlos por valores
estimados.
