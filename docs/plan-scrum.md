
**UNIVERSIDAD NACIONAL DE TRUJILLO**

**FACULTAD DE INGENIERÍA**

**ESCUELA ACADÉMICO PROFESIONAL DE INGENIERÍA DE SISTEMAS**

**BOOKIFIED: SISTEMA CONVERSACIONAL POR VOZ CON RAG**  
**PARA LA SIMULACIÓN DE SUSTENTACIONES DE INVESTIGACIÓN**

*METODOLOGÍA SCRUM — PRODUCT BACKLOG, HISTORIAS DE USUARIO Y SPRINTS*

**AUTOR:**

[Nombre del estudiante]

**DOCENTE:**

[Nombre del docente]

**TRUJILLO – PERÚ**

01/09/2026

> **Periodo de desarrollo considerado:** abril a agosto de 2026.

**ÍNDICE**  
[1. Product Vision Board](#1-product-vision-board)

[2. Actores del negocio](#2-actores-del-negocio)

[3. Roles de Scrum](#3-roles-de-scrum)

[4. Identificación de procesos](#4-identificación-de-procesos)

[5. Identificación de requerimientos](#5-identificación-de-requerimientos)

[Requerimientos funcionales](#requerimientos-funcionales)

[Requerimientos no funcionales](#requerimientos-no-funcionales)

[6. Historias de usuario](#6-historias-de-usuario)

[7. Product backlog priorizado](#7-product-backlog-priorizado)

[8. Estimación del product backlog](#8-estimación-del-product-backlog)

# **1. Product Vision Board**

Bookified es una plataforma web que permite al estudiante cargar un avance de investigación en
formato PDF y practicar su sustentación mediante una conversación por voz. El sistema procesa el
documento, lo divide en fragmentos, genera representaciones vectoriales y recupera el contexto
relevante para que un agente conversacional formule preguntas relacionadas con la investigación.

El agente asume el rol de docente evaluador de una sustentación de avance. La solución integra
reconocimiento de voz (STT), un modelo de lenguaje (LLM), una base de datos vectorial, un retriever
y síntesis de voz (TTS). Además, registra las sesiones, turnos, latencias y fragmentos recuperados
para producir evidencia medible para la investigación.

*Tabla 1. Product Vision Board*

| Bookified | Usuarios | Necesidades | Producto | Valor |
| ----- | ----- | ----- | ----- | ----- |
| **Sistema conversacional por voz con RAG para practicar sustentaciones de investigación** | Estudiantes que preparan una sustentación. Investigadores que necesitan registrar y evaluar sesiones. Asesores o jurados que revisan la evidencia del prototipo. | Cargar una investigación. Practicar preguntas académicas por voz. Recibir preguntas ancladas en el propio documento. Consultar transcripciones, latencias y métricas. | Biblioteca de investigaciones. Procesamiento PDF con segmentación y embeddings. Retriever con búsqueda vectorial, top-K y umbral. Agente evaluador en español mediante Vapi. Persistencia de sesiones y módulo `/metrics`. | Mayor preparación y confianza para la sustentación. Retroalimentación basada en el documento real. Trazabilidad del contexto usado por el agente. Evidencia cuantitativa para evaluar el sistema. |

# **2. Actores del negocio**

*Tabla 2. Actores del negocio*

| Actor del negocio | Descripción |
| :---: | ----- |
| **Estudiante** | Se registra, carga su avance de investigación, selecciona una voz e inicia una sesión de práctica. Responde las preguntas del agente y consulta la transcripción de la conversación. |
| **Investigador** | Configura el sistema, revisa los turnos y fragmentos recuperados, evalúa la precisión de las respuestas y consulta las métricas del proyecto. |
| **Asesor o jurado** | Revisa la arquitectura, el flujo funcional, la evidencia del ICA y los resultados obtenidos durante la evaluación del prototipo. |
| **Servicios externos** | Vapi coordina la conversación de voz; ElevenLabs proporciona las voces; Gemini genera embeddings y participa en la evaluación RAGAs; Cloudflare R2 almacena archivos. |

# **3. Roles de Scrum**

En la Tabla 3 se presentan los roles Scrum adoptados para un proyecto desarrollado por una sola
persona. La misma persona asumió los roles, pero mantuvo diferenciadas sus responsabilidades.

*Tabla 3. Roles Scrum*

| Responsable | Roles | Responsabilidades principales |
| ----- | ----- | ----- |
| **[Nombre del estudiante]** | Product Owner / Scrum Master / Developer | Definir y priorizar el Product Backlog, organizar los sprints, gestionar impedimentos, analizar requisitos, diseñar, programar, probar y documentar el producto. |

*Nota: completar el nombre del estudiante y del docente antes de presentar el documento.*

# **4. Identificación de procesos**

* Gestionar la autenticación y el acceso seguro de los usuarios.
* Gestionar la biblioteca de investigaciones cargadas por el estudiante.
* Cargar, validar y almacenar documentos PDF en la plataforma.
* Extraer el texto del documento respetando la información de sus páginas.
* Segmentar el contenido y generar embeddings para la búsqueda semántica.
* Recuperar fragmentos relevantes de la investigación mediante la base vectorial.
* Gestionar la sesión de conversación por voz entre el estudiante y el agente.
* Formular preguntas de sustentación en español y en rol de docente evaluador.
* Registrar transcripciones, turnos, recuperaciones y latencias de cada sesión.
* Evaluar la precisión de las respuestas y calcular las métricas del sistema.
* Consultar y exportar los resultados de evaluación para la investigación.
* Documentar la arquitectura, las decisiones técnicas y las limitaciones del prototipo.

# **5. Identificación de requerimientos**

Se describen a continuación los requerimientos funcionales y no funcionales identificados para el
sistema Bookified.

## **Requerimientos funcionales**

Según los procesos identificados, se establecieron las siguientes funcionalidades:

* El sistema debe permitir el registro e inicio de sesión del estudiante.
* El sistema debe restringir las investigaciones y sesiones al usuario autorizado.
* El estudiante debe poder cargar un documento de investigación en formato PDF.
* El sistema debe extraer el texto del PDF y conservar el número de página de origen.
* El sistema debe dividir el texto en segmentos de 500 palabras con un solape de 50 palabras.
* El sistema debe generar embeddings y almacenar los segmentos en PostgreSQL con pgvector.
* El retriever debe buscar fragmentos por similitud coseno y aplicar un valor top-K configurable.
* El retriever debe descartar fragmentos que no superen el umbral de relevancia establecido.
* El estudiante debe poder iniciar y finalizar una conversación de voz sobre su investigación.
* La conversación debe integrar STT, LLM y TTS mediante Vapi y ElevenLabs.
* El agente debe realizar preguntas en español, con el rol de docente evaluador.
* El agente debe consultar el documento antes de formular preguntas de contenido y no debe inventar información.
* El estudiante debe poder seleccionar una voz disponible antes de iniciar la sesión.
* El sistema debe mostrar la transcripción de la conversación en tiempo real.
* El sistema debe registrar cada sesión, turno, fragmento recuperado y distancia de similitud.
* El sistema debe calcular la latencia promedio del sistema y la latencia de respuesta verbal del estudiante.
* El investigador debe poder marcar una respuesta como correcta o incorrecta y agregar observaciones.
* El sistema debe calcular ICA, PR, LP y métricas RAGAs a partir de los datos persistidos.
* El sistema debe mostrar las métricas en la ruta `/metrics` y permitir su exportación en CSV.
* El sistema debe permitir asociar al usuario un código de participante y un grupo de estudio.

## **Requerimientos no funcionales**

*Tabla 4. Requerimientos no funcionales*

| Requerimiento | Descripción |
| ----- | ----- |
| **Seguridad y privacidad** | El sistema debe validar la sesión del usuario y comprobar la propiedad de cada investigación antes de leer o modificar sus datos. Las credenciales y claves de servicios deben mantenerse fuera del repositorio. |
| **Rendimiento** | La recuperación de contexto debe responder con una latencia medible y la conversación debe conservar una interacción suficientemente fluida para el uso por voz. |
| **Usabilidad** | La interfaz debe ser clara, responsive y comprensible para estudiantes sin conocimientos técnicos avanzados. Los mensajes al usuario deben estar en español. |
| **Mantenibilidad** | El código debe organizarse en módulos reutilizables de Next.js, TypeScript, Server Actions, Drizzle y componentes de interfaz. |
| **Trazabilidad** | Cada respuesta evaluable debe poder relacionarse con su pregunta, contexto recuperado, documento y sesión correspondiente. |
| **Disponibilidad** | La aplicación debe informar las limitaciones de conectividad, micrófono, parlantes y disponibilidad de los servicios externos. |
| **Escalabilidad** | La solución debe permitir incorporar más documentos, sesiones y participantes sin cambiar el flujo principal del sistema. |

# **6. Historias de usuario**

Las historias de usuario se presentan ordenadas por el incremento funcional desarrollado entre abril
y agosto de 2026. El estado indicado corresponde al cierre de la versión candidata del proyecto.

*Tabla 5. Historias de usuario*

| HU | Nombre | Descripción |
| ----- | :---: | ----- |
| **HU1** | Registro e inicio de sesión | Como estudiante, quiero registrarme e iniciar sesión para acceder de forma segura a mis investigaciones y sesiones. |
| **HU2** | Biblioteca de investigaciones | Como estudiante, quiero visualizar mis investigaciones cargadas para seleccionar aquella que usaré en la práctica. |
| **HU3** | Carga de investigación en PDF | Como estudiante, quiero cargar un avance de investigación en PDF para convertirlo en la fuente de la sustentación. |
| **HU4** | Extracción y segmentación por páginas | Como sistema, quiero extraer y segmentar el texto del PDF conservando su página de origen para facilitar la trazabilidad. |
| **HU5** | Embeddings del documento | Como sistema, quiero generar embeddings de cada segmento para realizar búsquedas semánticas. |
| **HU6** | Base vectorial | Como sistema, quiero guardar los segmentos y embeddings en PostgreSQL con pgvector para consultarlos durante la conversación. |
| **HU7** | Recuperación de contexto RAG | Como estudiante, quiero que el sistema recupere fragmentos relevantes de mi investigación antes de generar una pregunta. |
| **HU8** | Umbral y top-K del retriever | Como investigador, quiero configurar top-K y un umbral de distancia para evitar contexto irrelevante. |
| **HU9** | Conversación por voz | Como estudiante, quiero conversar en tiempo real con el agente para practicar una sustentación oral. |
| **HU10** | Agente docente evaluador | Como estudiante, quiero que el agente formule preguntas sobre problema, metodología, resultados y conclusiones con rigor académico. |
| **HU11** | Anclaje obligatorio y español | Como estudiante, quiero recibir preguntas en español basadas en mi documento, sin que el agente invente información. |
| **HU12** | Selección de voz y transcripción | Como estudiante, quiero seleccionar una voz y visualizar la transcripción de la sesión mientras converso. |
| **HU13** | Persistencia de sesiones y turnos | Como investigador, quiero guardar cada intervención de la sesión para poder analizar posteriormente la conversación. |
| **HU14** | Registro de latencias y recuperaciones | Como investigador, quiero registrar la latencia del sistema, la respuesta del estudiante y los fragmentos recuperados. |
| **HU15** | Evaluación de precisión | Como investigador, quiero marcar cada respuesta como correcta o incorrecta y registrar una observación. |
| **HU16** | Identificación de participantes | Como investigador, quiero asociar un código y un grupo de estudio a cada participante para cruzar los datos con encuestas externas. |
| **HU17** | Cálculo de ICA y métricas | Como investigador, quiero calcular ICA, PR, LP y RAGAs con los datos de las sesiones. |
| **HU18** | Panel y exportación de resultados | Como investigador, quiero consultar `/metrics` y exportar los resultados en CSV para utilizarlos en el informe de investigación. |
| **HU19** | Documentación de arquitectura | Como asesor o jurado, quiero consultar la arquitectura y sus archivos de evidencia para verificar la integración de los componentes. |
| **HU20** | Manejo de errores y limitaciones | Como usuario, quiero recibir mensajes claros cuando falte conexión, micrófono, parlantes, configuración o contexto relevante. |

# **7. Product backlog priorizado**

*Tabla 6. Product backlog priorizado*

| Historia de usuario | Descripción | Prioridad |
| :---: | ----- | :---: |
| **HU1** | Registro e inicio de sesión | 1 |
| **HU2** | Biblioteca de investigaciones | 1 |
| **HU3** | Carga de investigación en PDF | 1 |
| **HU4** | Extracción y segmentación por páginas | 1 |
| **HU5** | Embeddings del documento | 1 |
| **HU6** | Base vectorial | 1 |
| **HU7** | Recuperación de contexto RAG | 1 |
| **HU8** | Umbral y top-K del retriever | 1 |
| **HU9** | Conversación por voz | 1 |
| **HU10** | Agente docente evaluador | 1 |
| **HU11** | Anclaje obligatorio y español | 1 |
| **HU12** | Selección de voz y transcripción | 2 |
| **HU13** | Persistencia de sesiones y turnos | 1 |
| **HU14** | Registro de latencias y recuperaciones | 1 |
| **HU15** | Evaluación de precisión | 2 |
| **HU16** | Identificación de participantes | 2 |
| **HU17** | Cálculo de ICA y métricas | 1 |
| **HU18** | Panel y exportación de resultados | 1 |
| **HU19** | Documentación de arquitectura | 2 |
| **HU20** | Manejo de errores y limitaciones | 2 |

**Prioridad 1:** funcionalidades indispensables para el flujo principal y la evidencia de la
investigación.  
**Prioridad 2:** funcionalidades importantes para completar la evaluación, la trazabilidad y la
calidad del producto.

# **8. Estimación del product backlog**

En las tablas 7 y 8 se presenta la estimación del Product Backlog mediante puntos de historia y
tiempo ideal de desarrollo. La estimación considera una persona desarrolladora y no incluye tiempos
de espera de servicios externos.

*Tabla 7. Asignación de puntos de historia*

| Tamaño | Puntos | Tiempo [días] |
| :---: | :---: | :---: |
| **XtraSmall (XS)** | 1 | 0.5 |
| **Small (S)** | 2 | 1 |
| **Medium (M)** | 3 | 1.5 |
| **Large (L)** | 5 | 2 |
| **XtraLarge (XL)** | 8 | 3 |

*Tabla 8. Estimación del Product Backlog por sprint*

| Sprint y fechas | HU | Descripción | Tamaño | Puntos | Tiempo [días] |
| ----- | ----- | ----- | :---: | :---: | :---: |
| **Sprint 1** 01–12 abril (Base y acceso) | HU1 | Registro e inicio de sesión | M | 3 | 1.5 |
|  | HU2 | Biblioteca de investigaciones | M | 3 | 1.5 |
|  | HU16 | Identificación de participantes | M | 3 | 1.5 |
| **Subtotal Sprint 1** |  |  |  | **9** | **4.5** |
| **Sprint 2** 13–26 abril (Carga y procesamiento) | HU3 | Carga de investigación en PDF | L | 5 | 2 |
|  | HU4 | Extracción y segmentación por páginas | L | 5 | 2 |
| **Subtotal Sprint 2** |  |  |  | **10** | **4** |
| **Sprint 3** 27 abril–10 mayo (Embeddings y base vectorial) | HU5 | Embeddings del documento | XL | 8 | 3 |
|  | HU6 | Base vectorial | XL | 8 | 3 |
| **Subtotal Sprint 3** |  |  |  | **16** | **6** |
| **Sprint 4** 11–24 mayo (Retriever) | HU7 | Recuperación de contexto RAG | XL | 8 | 3 |
|  | HU8 | Umbral y top-K del retriever | XL | 8 | 3 |
| **Subtotal Sprint 4** |  |  |  | **16** | **6** |
| **Sprint 5** 25 mayo–07 junio (Conversación de voz) | HU9 | Conversación por voz | XL | 8 | 3 |
|  | HU12 | Selección de voz y transcripción | M | 3 | 1.5 |
| **Subtotal Sprint 5** |  |  |  | **11** | **4.5** |
| **Sprint 6** 08–21 junio (Agente evaluador) | HU10 | Agente docente evaluador | L | 5 | 2 |
|  | HU11 | Anclaje obligatorio y español | L | 5 | 2 |
| **Subtotal Sprint 6** |  |  |  | **10** | **4** |
| **Sprint 7** 22 junio–05 julio (Persistencia e instrumentación) | HU13 | Persistencia de sesiones y turnos | XL | 8 | 3 |
|  | HU14 | Registro de latencias y recuperaciones | L | 5 | 2 |
| **Subtotal Sprint 7** |  |  |  | **13** | **5** |
| **Sprint 8** 06–19 julio (Evaluación) | HU15 | Evaluación de precisión | L | 5 | 2 |
|  | HU17 | Cálculo de ICA y métricas | XL | 8 | 3 |
| **Subtotal Sprint 8** |  |  |  | **13** | **5** |
| **Sprint 9** 20 julio–02 agosto (Reporte y documentación) | HU18 | Panel y exportación de resultados | L | 5 | 2 |
|  | HU19 | Documentación de arquitectura | M | 3 | 1.5 |
| **Subtotal Sprint 9** |  |  |  | **8** | **3.5** |
| **Sprint 10** 03–16 agosto (Calidad y errores) | HU20 | Manejo de errores y limitaciones | M | 3 | 1.5 |
|  |  | Pruebas integrales y correcciones | M | 3 | 1.5 |
| **Subtotal Sprint 10** |  |  |  | **6** | **3** |
| **Sprint 11** 17–30 agosto (Cierre y entrega) |  | Validación del incremento, revisión final y preparación de evidencias | M | 3 | 1.5 |
| **Subtotal Sprint 11** |  |  |  | **3** | **1.5** |
| **TOTAL GENERAL** |  |  |  | **115** | **47** |

**Puntos de historia del Product Backlog:** 109 puntos correspondientes a las historias de usuario
y 6 puntos correspondientes a pruebas integrales, correcciones y validación final.  
**Tiempo ideal estimado:** 47 días de trabajo individual, distribuido entre el 1 de abril y el
30 de agosto de 2026.

Durante el desarrollo se priorizó el incremento mínimo viable: autenticación, carga del PDF,
procesamiento RAG y conversación por voz. Posteriormente se incorporaron la persistencia, la
instrumentación, las métricas y la documentación necesaria para sustentar el resultado técnico.

> **Nota metodológica:** las métricas ICA, PR, LP y RAGAs deben reportarse con datos obtenidos de
> sesiones reales o de un conjunto de prueba documentado. Este documento describe la planificación
> y el backlog; no reemplaza los resultados experimentales.
