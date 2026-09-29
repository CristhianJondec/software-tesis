**UNIVERSIDAD NACIONAL DE TRUJILLO  
FACULTAD DE INGENIERÍA  
ESCUELA ACADÉMICO PROFESIONAL DE INGENIERÍA DE SISTEMAS  
**

**INVESTFIED: AGENTE CONVERSACIONAL POR VOZ CON GENERACIÓN AUMENTADA  
POR RECUPERACIÓN PARA FORTALECER LA AUTOEFICACIA EN LA SUSTENTACIÓN  
DE AVANCES DE TESIS EN ESTUDIANTES UNIVERSITARIOS**

**PRODUCT BACKLOG FUNCIONAL**

**  
AUTOR:  
**Jondec Delgado, Cristhian André

**  
DOCENTE:  
**Mendoza Rivera, Ricardo Darío

TRUJILLO - PERÚ  
30/09/2026

# 1 Alcance del producto

INVESTFIED es una aplicación web en la que el estudiante sube el avance de su investigación en PDF y lo sustenta por voz ante un agente que hace de docente evaluador. El agente formula sus preguntas a partir de fragmentos recuperados del propio documento. El product backlog reúne las funcionalidades implementadas en la aplicación Next.js (App Router, Server Actions y rutas de servidor), en la base de datos PostgreSQL con pgvector y en los servicios externos de voz, embeddings y almacenamiento. Están organizadas por rol, ruta y sprint.

El sistema atiende a los dos grupos del estudio. El grupo experimental usa el agente de voz y el grupo control recibe solo materiales estáticos. Los dos grupos responden los instrumentos de medición basal y posterior.

OE1 = diagnosticar el nivel inicial de autoeficacia para sustentar avances de proyecto de tesis antes de la intervención. OE2 = diseñar la arquitectura del agente conversacional por voz basado en RAG orientado a la simulación de la sustentación académica. OE3 = implementar el agente conversacional por voz para garantizar una interacción síncrona funcional. OE4 = evaluar el efecto del agente sobre la autoeficacia para sustentar, comparando la medición basal y la posterior a la intervención. El símbolo N/A indica soporte operativo sin relación directa con un objetivo específico.

| **Bloque** | **Funcionalidades mapeadas** | **Evidencia principal** |
| --- | --- | --- |
| Autenticación y acceso | Registro e inicio de sesión con correo y contraseña, protección de rutas por sesión, grupos de estudio (experimental y control), pantalla de cuenta en revisión y acceso de investigador. | sign-in, sign-up, lib/auth.ts, middleware.ts, lib/study/groups.ts, lib/study/access.ts, sin-asignar |
| Biblioteca y carga documental | Listado de las investigaciones propias, búsqueda por título o autor, eliminación, límite de cuatro investigaciones, carga del PDF y de la portada a Cloudflare R2 y elección de la voz del evaluador. | Página de inicio, BookCard, Search, UploadForm, VoiceSelector, /api/upload, /api/cover/[bookId] |
| Procesamiento RAG | Extracción del texto por página, segmentación de 500 palabras con solape de 50, embeddings de 768 dimensiones con Gemini, almacenamiento vectorial con índice HNSW y recuperación por distancia coseno con top-K y umbral. | lib/utils.ts (parsePDFFile), lib/segmentation.ts, lib/embeddings.ts, book_segments, searchBookSegments, /api/vapi/search-book |
| Conversación por voz | Sesión síncrona mediante Vapi: STT Deepgram en español, LLM GPT-4o con el prompt del docente evaluador enviado desde código, TTS Azure en español peruano, transcripción en vivo, límite de 20 minutos y mensajes de error. | hooks/useVapi.ts, VapiControls, Transcript, lib/agent-prompt.ts, lib/constants.ts |
| Práctica adaptativa y retroalimentación | Autoevaluación de 0 a 10 antes y después de la sesión, cuatro niveles de exigencia con una regla de adaptación determinista, informe en tres dimensiones con cita obligatoria, evidencias de avance y progreso entre sesiones. | SessionSetup, PostSessionSurvey, SessionReport, ProgressEvidence, ProgressCharts, lib/difficulty/, lib/feedback/, lib/progress/ |
| Instrumentación y métricas | Persistencia de sesiones, turnos y recuperaciones, latencia del sistema y latencia verbal del estudiante, historial de sesiones, cálculo de ICA, LP, PR y RAGAs, revisión humana y exportación CSV. | session.actions.ts, lib/retrievals.ts, lib/metrics/, /history, /metrics, /metrics/revision |
| Instrumentos del estudio | Encuestas STAI y PRCS-12 en T1 y T2 y SUS para el grupo experimental, desbloqueo secuencial, puntaje automático, seguimiento administrativo, exportación y materiales para el grupo control. | /surveys, lib/surveys/, /admin, /materiales, lib/materials/guide.ts, material.actions.ts |
| Infraestructura | Variables de entorno, migraciones Drizzle, extensión pgvector, bucket privado de R2, configuración del assistant y del tool searchBook en Vapi, compilación y ejecución de Next.js. | drizzle.config.ts, drizzle/, .env, package.json, docs/agente/ |

# 2 Roles Scrum

El proyecto lo desarrolló una sola persona, que asumió los tres roles de Scrum manteniendo separadas sus responsabilidades.

| **Rol** | **Responsable** | **Responsabilidades principales** |
| --- | --- | --- |
| Product Owner | Jondec Delgado, Cristhian André | Definir la visión del producto a partir de los objetivos de la investigación, redactar y priorizar las historias de usuario y aceptar cada incremento. |
| Scrum Master | Jondec Delgado, Cristhian André | Organizar los sprints, cuidar que se respete la definición de terminado y resolver impedimentos técnicos y de servicios externos. |
| Development Team | Jondec Delgado, Cristhian André | Analizar, diseñar, programar, probar, desplegar y documentar cada historia de usuario. |
| Interesados | Docente del curso, asesor de tesis y estudiantes participantes | Revisar los incrementos, validar el uso del sistema y aportar la evidencia del estudio. |

# 3 Mapa funcional por rol y ruta

## 3.1 Rutas públicas y de acceso

| **Ruta** | **Pantalla** | **Funcionalidad** | **OE** |
| --- | --- | --- | --- |
| /sign-in | Inicio de sesión | Ingreso con correo y contraseña mediante Better Auth, y redirección según el grupo de estudio. | N/A |
| /sign-up | Registro | Creación de la cuenta con nombre, correo y contraseña. | N/A |
| /sin-asignar | Cuenta en revisión | Pantalla de espera de las cuentas que el investigador todavía no asigna a un grupo. | OE4 |

## 3.2 Grupo experimental

| **Ruta** | **Pantalla** | **Funcionalidad** | **OE** |
| --- | --- | --- | --- |
| / | Biblioteca | Investigaciones propias del estudiante, búsqueda, eliminación y acceso a la sesión de práctica. | N/A |
| /books/new | Agregar investigación | Carga del PDF, portada opcional, título y voz del docente evaluador, con un límite de cuatro investigaciones. | OE2 |
| /books/[slug] | Sesión de voz | Autoevaluación previa, nivel sugerido, conversación por voz, transcripción en vivo, temporizador y modal de cierre. | OE3 |
| /history | Historial | Sesiones anteriores con fecha, duración, número de mensajes, nivel y autoevaluaciones. | OE3 |
| /history/[sessionId] | Detalle de sesión | Transcripción, informe en tres dimensiones, evidencias de avance, exposición gradual, latencias, recuperaciones y evaluación de respuestas. | OE3, OE4 |
| /progreso | Mi progreso | Evolución por investigación y evidencias de avance respaldadas por un dato. | OE4 |
| /surveys | Encuestas | Etapas STAI, PRCS-12 y SUS con su estado: disponible, pendiente o completada. | OE1, OE4 |
| /surveys/[stageId] | Encuesta | Formulario del instrumento, validación de las respuestas y cálculo del puntaje. | OE1, OE4 |

## 3.3 Grupo control

| **Ruta** | **Pantalla** | **Funcionalidad** | **OE** |
| --- | --- | --- | --- |
| /materiales | Materiales | Documentos PDF compartidos por el investigador, temas típicos de una sustentación y recomendaciones de preparación. | OE4 |
| /surveys | Encuestas | Etapas STAI y PRCS-12 en T1 y T2. La SUS no aplica al grupo control. | OE1, OE4 |
| /surveys/[stageId] | Encuesta | Formulario del instrumento, validación de las respuestas y cálculo del puntaje. | OE1, OE4 |

## 3.4 Investigador y administrador

| **Ruta** | **Pantalla** | **Funcionalidad** | **OE** |
| --- | --- | --- | --- |
| /admin | Usuarios y encuestas | Asignación del grupo de estudio y del código de participante, estado de las encuestas por usuario, exportación CSV de encuestas y gestión de materiales compartidos. | OE1, OE4 |
| /metrics | Métricas de la sustentación simulada | ICA, LP, latencia verbal del estudiante, PR, RAGAs, retroalimentación en tres dimensiones, exposición gradual y exportación CSV. | OE2, OE3, OE4 |
| /metrics/revision | Revisión de respuestas | Revisión humana de cada respuesta del agente, marcada como correcta o incorrecta, para calcular PR. | OE3 |

El acceso de administrador se controla con ADMIN_EMAIL y el de métricas con METRICS_OWNER_EMAILS. Ambos perfiles quedan fuera de la regla de grupos de estudio.

## 3.5 Rutas de servidor y servicios externos

| **Módulo** | **Capacidades** | **OE** |
| --- | --- | --- |
| /api/auth/[...all] | Endpoints de Better Auth para registro, inicio y cierre de sesión con correo y contraseña. | N/A |
| /api/upload | Emisión de URL prefirmadas para subir el PDF y la portada directamente al bucket privado de R2. | OE2 |
| /api/cover/[bookId] y /api/materials/[materialId] | Entrega de portadas y de los PDF del grupo control, previa verificación de acceso. | N/A |
| /api/vapi/search-book | Webhook del tool searchBook: embebe la consulta, recupera los fragmentos, los devuelve con su página y registra la recuperación de la sesión. | OE2, OE3 |
| Server Actions | Investigaciones, sesiones, retroalimentación, progreso, métricas, encuestas, grupos de estudio y materiales, con validación de sesión y de propiedad. | OE2, OE3, OE4 |
| Vapi | Orquestación síncrona de STT (Deepgram nova-2, español), LLM (OpenAI GPT-4o, temperatura 0,4) y TTS (Azure es-PE-CamilaNeural o es-PE-AlexNeural). | OE2, OE3 |
| Google Gemini | Embeddings gemini-embedding-001 de 768 dimensiones y juez gemini-2.5-flash para RAGAs y para el informe post-sesión. | OE2, OE3 |
| PostgreSQL + pgvector | Usuarios, investigaciones, segmentos vectoriales con índice HNSW, sesiones, turnos, recuperaciones, evaluaciones y encuestas. | OE2 |
| Cloudflare R2 | Almacenamiento privado de los PDF de investigación, las portadas y los materiales del grupo control. | OE2 |

# 4 Product backlog por sprints

| **Sprint** | **Fechas** | **Nombre** | **Objetivo del sprint** |
| --- | --- | --- | --- |
| Sprint 1 | 01 abril – 10 mayo | Acceso y base documental | Que un estudiante autenticado y asignado a un grupo pueda subir su investigación y que esta quede segmentada y vectorizada en la base de datos. |
| Sprint 2 | 11 mayo – 21 junio | Conversación por voz con RAG | Que el estudiante sostenga una sustentación por voz en español con un agente evaluador que pregunta anclado en fragmentos recuperados de su documento. |
| Sprint 3 | 22 junio – 16 agosto | Instrumentación y métricas | Que cada sesión quede registrada con turnos, latencias y recuperaciones, y que el investigador calcule, revise y exporte ICA, LP, PR y RAGAs. |
| Sprint 4 | 17 agosto – 28 septiembre | Práctica adaptativa, instrumentos y despliegue | Que el simulacro adapte su exigencia y retroalimente al estudiante, que ambos grupos respondan los instrumentos del estudio y que el sistema quede desplegado para la intervención. |

## Sprint 1 Acceso y base documental

| **ID** | **Historia de usuario** | **Evidencia implementada** | **OE** |
| --- | --- | --- | --- |
| HU01 | Como estudiante, quiero registrarme e iniciar sesión con mi correo y contraseña para acceder de forma segura a mis investigaciones. | app/(auth)/sign-in, app/(auth)/sign-up, lib/auth.ts, lib/session.ts, /api/auth/[...all], middleware.ts. | N/A |
| HU02 | Como investigador, quiero asignar a cada participante al grupo experimental o al grupo control y darle un código de participante para separar su acceso y comparar ambos grupos. | /admin, StudyGroupSelect, setParticipantStudyGroup, setParticipantCode, lib/study/groups.ts, lib/study/access.ts, /sin-asignar. | OE4 |
| HU03 | Como estudiante, quiero ver, buscar y eliminar mis investigaciones cargadas para elegir la que usaré en la práctica. | Página de inicio, BookCard, Search, getAllBooks, deleteBook, /api/cover/[bookId], LimitReachedModal. | N/A |
| HU04 | Como estudiante, quiero cargar mi avance de investigación en PDF, con portada opcional y la voz del evaluador, para convertirlo en la fuente de la sustentación. | /books/new, UploadForm, VoiceSelector, /api/upload, createBook, lib/r2.ts, columna books.persona. | OE2 |
| HU05 | Como sistema, quiero extraer el texto por página, segmentarlo y generar sus embeddings para almacenarlo en la base vectorial. | parsePDFFile (lib/utils.ts), splitIntoSegments (lib/segmentation.ts), lib/embeddings.ts, saveBookSegments, tabla book_segments con índice HNSW. | OE2 |

## Sprint 2 Conversación por voz con RAG

| **ID** | **Historia de usuario** | **Evidencia implementada** | **OE** |
| --- | --- | --- | --- |
| HU06 | Como estudiante, quiero que el sistema recupere los fragmentos más relevantes de mi investigación, descartando los irrelevantes, para que las preguntas se basen en mi documento. | /api/vapi/search-book, searchBookSegments, RETRIEVER_TOP_K = 5, RETRIEVER_MAX_DISTANCE = 0,6, fragmentos con número de página. | OE2, OE3 |
| HU07 | Como estudiante, quiero conversar por voz en tiempo real con el agente para practicar mi sustentación oral. | hooks/useVapi.ts, VapiControls, VAPI_SPANISH_TRANSCRIBER, VAPI_SPANISH_VOICE, VAPI_START_SPEAKING_PLAN, assistantOverrides. | OE3 |
| HU08 | Como estudiante, quiero que el agente actúe como docente evaluador, pregunte en español una cosa a la vez y se base solo en mi documento, sin inventar información. | lib/agent-prompt.ts (regla de anclaje, cita de página, fases, límites), EVALUATOR_MODEL, tool searchBook. | OE2, OE3 |
| HU09 | Como estudiante, quiero ver la transcripción de la conversación mientras hablo para seguir las preguntas y mis respuestas. | Transcript, lib/transcript.ts, mensajes voice-input de Vapi, cierre de turno al hablar el estudiante. | OE3 |
| HU10 | Como estudiante, quiero que la sesión tenga una duración máxima y que el sistema me avise con claridad si falla la conexión, el micrófono o un servicio externo. | MAX_SESSION_DURATION_MINUTES = 20, aviso de cierre 3 minutos antes, contador de tiempo, mensajes de error en useVapi, panel de requisitos en VapiControls. | OE3 |

## Sprint 3 Instrumentación y métricas

| **ID** | **Historia de usuario** | **Evidencia implementada** | **OE** |
| --- | --- | --- | --- |
| HU11 | Como investigador, quiero que cada sesión, turno y fragmento recuperado quede guardado para analizar después la conversación. | startVoiceSession, linkVapiCall, saveSessionTurn, updateSessionTurn, endVoiceSession, recordTurnRetrievals, tablas voice_sessions, session_turns y turn_retrievals. | OE3 |
| HU12 | Como investigador, quiero registrar la latencia del sistema y la latencia de respuesta verbal del estudiante para medir la fluidez técnica y la conducta del estudiante. | Campos systemLatencyMs y studentLatencyMs, lib/metrics/latency.ts, cálculo en useVapi.ts. | OE3, OE4 |
| HU13 | Como estudiante, quiero consultar el historial y el detalle de mis sesiones para revisar lo que respondí y cómo se desarrolló la práctica. | /history, /history/[sessionId], getConversationHistory, getConversationById. | OE3 |
| HU14 | Como investigador, quiero un panel que calcule ICA, LP, la latencia del estudiante y RAGAs a partir de los datos registrados para reportar la evaluación del sistema. | /metrics, getMetricsOverview, lib/metrics/architecture.ts, lib/metrics/ragas.ts, lib/metrics/judge.ts, RagasControls, recomputeRagas. | OE2, OE3 |
| HU15 | Como investigador, quiero revisar a mano las respuestas del agente para calcular PR y exportar las métricas en CSV para el análisis estadístico. | /metrics/revision, TurnReviewList, saveTurnEvaluation, lib/metrics/precision.ts, ExportCsvButtons, exportMetricsCsv (turnos, sesiones y participantes). | OE3, OE4 |

## Sprint 4 Práctica adaptativa, instrumentos y despliegue

| **ID** | **Historia de usuario** | **Evidencia implementada** | **OE** |
| --- | --- | --- | --- |
| HU16 | Como estudiante, quiero que el simulacro tenga cuatro niveles de exigencia y que el sistema me sugiera uno a partir de mi autoevaluación y de mi sesión anterior, pudiendo cambiarlo, para no enfrentar desde el inicio un jurado exigente. | SessionSetup, AnxietyScale, lib/difficulty/levels.ts, lib/difficulty/signals.ts, lib/difficulty/adaptation.ts, getSessionPreparation. | OE3 |
| HU17 | Como estudiante, quiero recibir al terminar un informe en tres dimensiones separadas, con la cita del fragmento que respalda cada juicio de contenido, para saber qué corregir sin una nota global. | SessionReport, evaluateSessionFeedback, lib/feedback/rubric.ts, evaluate.ts, observations.ts y report.ts, tabla turn_feedback. | OE3 |
| HU18 | Como estudiante, quiero ver al cerrar la sesión mis avances respaldados por un dato, registrar mi autoevaluación final y consultar mi evolución entre sesiones. | PostSessionSurvey, savePostSessionAnxiety, getSessionEvidence, lib/progress/evidence.ts y series.ts, /progreso, ProgressCharts, ProgressEvidence. | OE4 |
| HU19 | Como participante, quiero responder los instrumentos de medición basal y posterior del estudio, y como investigador, quiero seguir su avance y exportarlos para comparar las dos mediciones. | /surveys, /surveys/[stageId], lib/surveys/catalog.ts, scoring.ts y progress.ts, submitSurvey, getAdminSurveyOverview, exportSurveySummaryCsv. | OE1, OE4 |
| HU20 | Como investigador, quiero compartir materiales de preparación con el grupo control para que reciba una condición pasiva sin el agente de voz. | /materiales, lib/materials/guide.ts, MaterialsManager, createStudyMaterial, deleteStudyMaterial, /api/materials/[materialId]. | OE4 |
| HU21 | Como equipo de desarrollo, quiero desplegar la aplicación con una configuración reproducible de base de datos, almacenamiento y servicios externos para que los participantes la usen durante la intervención. | Variables de entorno (.env), drizzle-kit migrate, extensión pgvector, bucket privado de R2, assistant y tool searchBook en Vapi, next build / next start, docs/agente/. | OE3 |

# 5 Priorización y estimación del product backlog

La estimación usa puntos de historia y tiempo ideal de desarrollo para una sola persona. No incluye los tiempos de espera de los servicios externos.

| **Tamaño** | **Puntos** | **Tiempo ideal [días]** |
| --- | --- | --- |
| Extra pequeño (XS) | 1 | 0,5 |
| Pequeño (S) | 2 | 1 |
| Mediano (M) | 3 | 1,5 |
| Grande (L) | 5 | 2 |
| Extra grande (XL) | 8 | 3 |

| **HU** | **Nombre** | **Prioridad** | **Tamaño** | **Puntos** | **Días** |
| --- | --- | --- | --- | --- | --- |
| HU01 | Registro e inicio de sesión | 1 | M | 3 | 1,5 |
| HU02 | Grupos de estudio y control de acceso | 1 | L | 5 | 2 |
| HU03 | Biblioteca de investigaciones | 2 | M | 3 | 1,5 |
| HU04 | Carga de investigación en PDF | 1 | L | 5 | 2 |
| HU05 | Extracción, segmentación y embeddings | 1 | XL | 8 | 3 |
| **Subtotal Sprint 1** | | | | **24** | **10** |
| HU06 | Recuperación de contexto con top-K y umbral | 1 | XL | 8 | 3 |
| HU07 | Conversación por voz síncrona | 1 | XL | 8 | 3 |
| HU08 | Agente docente evaluador anclado | 1 | L | 5 | 2 |
| HU09 | Transcripción en tiempo real | 2 | M | 3 | 1,5 |
| HU10 | Duración máxima y manejo de errores | 2 | M | 3 | 1,5 |
| **Subtotal Sprint 2** | | | | **27** | **11** |
| HU11 | Persistencia de sesiones, turnos y recuperaciones | 1 | XL | 8 | 3 |
| HU12 | Registro de latencias | 1 | L | 5 | 2 |
| HU13 | Historial y detalle de sesiones | 2 | M | 3 | 1,5 |
| HU14 | Panel de ICA, LP y RAGAs | 1 | XL | 8 | 3 |
| HU15 | Revisión humana (PR) y exportación CSV | 1 | L | 5 | 2 |
| **Subtotal Sprint 3** | | | | **29** | **11,5** |
| HU16 | Exposición gradual adaptativa | 3 | L | 5 | 2 |
| HU17 | Informe post-sesión en tres dimensiones | 3 | XL | 8 | 3 |
| HU18 | Evidencias de avance y progreso | 3 | L | 5 | 2 |
| HU19 | Instrumentos de medición basal y posterior | 1 | L | 5 | 2 |
| HU20 | Materiales del grupo control | 2 | M | 3 | 1,5 |
| HU21 | Despliegue y operación del sistema | 1 | M | 3 | 1,5 |
| **Subtotal Sprint 4** | | | | **29** | **12** |
| **TOTAL** | | | | **109** | **44,5** |

**Prioridad 1:** indispensable para el flujo obligatorio STT → recuperación → LLM anclado → TTS, para el cálculo de ICA, PR, LP y RAGAs, o para aplicar los instrumentos del estudio.  
**Prioridad 2:** completa la experiencia de uso, la trazabilidad y la condición del grupo control.  
**Prioridad 3:** extensiones de práctica que diferencian el producto de un asistente genérico de consulta de documentos. No condicionan el flujo obligatorio ni el cálculo de las métricas.

# 6 Definición de terminado

Una historia de usuario se considera terminada cuando cumple todas estas condiciones:

- La funcionalidad está integrada en la rama principal y la aplicación compila sin errores de tipos (`npx tsc --noEmit`).
- Toda la interfaz y los mensajes al usuario están en español.
- Cada Server Action valida la sesión y la propiedad del recurso, y devuelve `{ success, data?, error? }` sin lanzar errores hacia el cliente.
- Los cambios de esquema se generan y aplican con migraciones de Drizzle.
- La lógica pura que afecta la medición (segmentación, niveles, métricas, encuestas) tiene pruebas unitarias que pasan con `npm test`.
- La funcionalidad se probó de punta a punta en la aplicación con al menos una investigación real.

***Nota sobre las fechas:** las ventanas de cada sprint corresponden a la planificación del proyecto entre abril y septiembre de 2026. No son fechas de entrega verificadas en el historial del repositorio.*

***Nota metodológica:** las métricas ICA, PR, LP y RAGAs deben reportarse con datos obtenidos de sesiones reales o de un conjunto de prueba documentado. Los umbrales de la regla de adaptación (HU16), de los indicadores conductuales (HU17) y de las evidencias de avance (HU18) se fijaron por razonamiento y deben recalibrarse con las sesiones piloto. Este documento describe el backlog y no reemplaza los resultados experimentales.*
