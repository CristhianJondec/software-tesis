**UNIVERSIDAD NACIONAL DE TRUJILLO  
FACULTAD DE INGENIERÍA  
ESCUELA ACADÉMICO PROFESIONAL DE INGENIERÍA DE SISTEMAS**

**  
INVESTFIED: DOCUMENTACIÓN FUNCIONAL DEL SOFTWARE**

**  
AUTOR:  
**Jondec Delgado, Cristhian André  
**  
DOCENTE:  
**Mendoza Rivera, Ricardo Darío  
<br/>TRUJILLO - PERÚ  
30/09/2026

# Propósito del documento

Este documento describe las funcionalidades de INVESTFIED a partir de las historias de usuario organizadas por sprint. Cada historia incluye descripción, un espacio para la evidencia visual y el flujo de ejecución. Antes de las historias se presentan la arquitectura de componentes, el despliegue y la dependencia funcional entre sprints.

# Resumen por sprint

| **Sprint** | **Enfoque** | **Historias** |
| --- | --- | --- |
| Sprint 1 | Acceso y base documental | HU01, HU02, HU03, HU04, HU05 |
| Sprint 2 | Conversación por voz con RAG | HU06, HU07, HU08, HU09, HU10 |
| Sprint 3 | Instrumentación y métricas | HU11, HU12, HU13, HU14, HU15 |
| Sprint 4 | Práctica adaptativa, instrumentos y despliegue | HU16, HU17, HU18, HU19, HU20, HU21 |

# Arquitectura y dependencias

## Diagrama de componentes

El diagrama de componentes muestra las relaciones lógicas entre la aplicación web, la orquestación de voz, la recuperación aumentada y el almacenamiento. La aplicación Next.js es el único punto que accede a la base de datos. Vapi coordina el ciclo de voz y, cuando el LLM necesita contexto, invoca el tool searchBook, que llega al retriever de la aplicación. El retriever embebe la consulta con Gemini y busca los fragmentos más cercanos en PostgreSQL con pgvector. Los archivos PDF y las portadas se guardan en Cloudflare R2.

*Figura 1. Diagrama de componentes de INVESTFIED*

**[ESPACIO RESERVADO PARA IMAGEN]**

*Tipo de figura: diagrama de componentes UML. Debe incluir la aplicación web Next.js/React/TypeScript (pantallas, parseo de PDF y Vapi Web SDK), el servidor Next.js (Server Actions, Better Auth, /api/upload, retriever /api/vapi/search-book, módulo de embeddings y módulo de métricas y juez), Vapi con sus tres subcomponentes (STT Deepgram, LLM GPT-4o y TTS Azure es-PE), Google Gemini (embeddings y juez), PostgreSQL con pgvector y Cloudflare R2. Las flechas deben mostrar el ciclo STT → LLM → TTS, la llamada del LLM al tool searchBook y el camino retriever → embeddings → pgvector.*

Código Mermaid sugerido para generar la figura (borrarlo después de insertar la imagen):

```mermaid
flowchart LR
    subgraph Cliente["Aplicación web en el navegador (Next.js / React / TypeScript)"]
        UI["Pantallas: biblioteca, carga, sesión de voz, historial, progreso, encuestas, materiales, admin y métricas"]
        PDF["Parseo de PDF (pdfjs-dist)"]
        SDK["Vapi Web SDK (useVapi)"]
    end
    subgraph Servidor["Servidor Next.js"]
        SA["Server Actions"]
        AUTH["Better Auth"]
        UP["/api/upload (URL prefirmada)"]
        RET["Retriever /api/vapi/search-book"]
        EMB["Embeddings (lib/embeddings.ts)"]
        MET["Métricas y juez (lib/metrics, lib/feedback)"]
    end
    subgraph Vapi["Vapi: orquestación de voz"]
        STT["STT Deepgram nova-2 (es)"]
        LLM["LLM OpenAI GPT-4o"]
        TTS["TTS Azure es-PE"]
    end
    GEM["Google Gemini (embeddings y juez)"]
    DB[("PostgreSQL + pgvector")]
    R2[("Cloudflare R2")]

    UI --> SA
    UI --> AUTH
    PDF --> UP
    UP -. "URL prefirmada" .-> R2
    SDK -- "audio del estudiante" --> STT
    STT --> LLM
    LLM --> TTS
    TTS -- "audio del agente" --> SDK
    LLM -- "tool searchBook" --> RET
    RET --> EMB
    EMB --> GEM
    RET --> DB
    SA --> EMB
    SA --> DB
    SA --> MET
    MET --> GEM
    AUTH --> DB
```

## Diagrama de despliegue

El diagrama de despliegue muestra dónde se ejecutan los componentes y cómo se conectan durante una sesión. El repositorio no documenta un proveedor de alojamiento para la aplicación, así que el nodo del servidor se rotula de forma genérica como servidor de aplicación Node.js.

*Figura 2. Diagrama de despliegue de INVESTFIED*

**[ESPACIO RESERVADO PARA IMAGEN]**

*Tipo de figura: diagrama de despliegue UML con nodos y conexiones rotuladas. Nodos: (1) dispositivo del estudiante con navegador web, micrófono y parlantes, que ejecuta la interfaz React y el Vapi Web SDK; (2) servidor de aplicación Node.js con Next.js (Server Actions, rutas API y Better Auth); (3) servidor PostgreSQL con la extensión pgvector; (4) Cloudflare R2 con un bucket privado; (5) plataforma Vapi con Deepgram, OpenAI y Azure Speech; (6) API de Google Gemini. Conexiones: navegador ↔ servidor por HTTPS; navegador ↔ Vapi con audio en tiempo real por WebRTC; navegador → R2 con PUT prefirmado por HTTPS; Vapi → servidor con el webhook HTTPS del tool searchBook; servidor → PostgreSQL por SQL; servidor → R2 por la API compatible con S3; servidor → Gemini por HTTPS. No rotular un proveedor de alojamiento que no se haya usado.*

Código Mermaid sugerido para generar la figura (borrarlo después de insertar la imagen):

```mermaid
flowchart TB
    subgraph Dispositivo["Dispositivo del estudiante"]
        NAV["Navegador web: interfaz React y Vapi Web SDK"]
        MIC["Micrófono y parlantes"]
    end
    subgraph App["Servidor de aplicación Node.js"]
        NEXT["Next.js: Server Actions, rutas API y Better Auth"]
    end
    subgraph Datos["Almacenamiento"]
        PG[("PostgreSQL + pgvector")]
        R2[("Cloudflare R2: bucket privado")]
    end
    subgraph Externos["Servicios externos"]
        VAPI["Vapi: Deepgram STT, OpenAI GPT-4o y Azure Speech TTS"]
        GEM["Google Gemini API"]
    end

    MIC --- NAV
    NAV -- "HTTPS" --> NEXT
    NAV -- "Audio en tiempo real (WebRTC)" --> VAPI
    NAV -- "PUT prefirmado (HTTPS)" --> R2
    VAPI -- "Webhook searchBook (HTTPS)" --> NEXT
    NEXT -- "SQL" --> PG
    NEXT -- "API S3" --> R2
    NEXT -- "HTTPS" --> GEM
```

## Diagrama de dependencia de sprints

La figura siguiente muestra la dependencia funcional entre la base documental, la conversación, la instrumentación y las extensiones de práctica. Cada sprint necesita el incremento del anterior. Las ventanas de fechas son las planificadas y no se presentan como fechas verificadas.

*Figura 3. Dependencia funcional de los cuatro sprints*

**[ESPACIO RESERVADO PARA IMAGEN]**

*Tipo de figura: diagrama de flujo horizontal con cuatro bloques en secuencia: Sprint 1 (HU01–HU05) → Sprint 2 (HU06–HU10) → Sprint 3 (HU11–HU15) → Sprint 4 (HU16–HU21). Dentro de cada bloque se muestran sus historias, y entre bloques se trazan las dependencias entre historias: HU04 → HU05 → HU06 → HU08 (sin documento vectorizado no hay recuperación ni preguntas ancladas); HU07 → HU09 y HU07 → HU11 (sin conversación no hay transcripción ni turnos que guardar); HU11 → HU12 → HU14 y HU11 → HU15 (las métricas se calculan sobre sesiones persistidas); HU11 y HU12 → HU16 (la regla de adaptación lee la sesión anterior); HU06 y HU11 → HU17 (el informe cita fragmentos recuperados de turnos guardados); HU12 y HU17 → HU18 (las evidencias comparan latencias y dimensiones entre sesiones); HU02 → HU19 y HU02 → HU20 (los instrumentos y los materiales dependen del grupo asignado); HU07 → HU19 (la SUS se desbloquea tras una conversación). HU21 depende del conjunto de incrementos.*

Código Mermaid sugerido para generar la figura (borrarlo después de insertar la imagen):

```mermaid
flowchart LR
    subgraph S1["Sprint 1 · Acceso y base documental (HU01–HU05)"]
        HU01["HU01 Registro e inicio de sesión"]
        HU02["HU02 Grupos de estudio"]
        HU03["HU03 Biblioteca"]
        HU04["HU04 Carga de PDF"]
        HU05["HU05 Segmentación y embeddings"]
    end
    subgraph S2["Sprint 2 · Conversación por voz con RAG (HU06–HU10)"]
        HU06["HU06 Retriever top-K y umbral"]
        HU07["HU07 Conversación por voz"]
        HU08["HU08 Agente evaluador anclado"]
        HU09["HU09 Transcripción en vivo"]
        HU10["HU10 Duración y errores"]
    end
    subgraph S3["Sprint 3 · Instrumentación y métricas (HU11–HU15)"]
        HU11["HU11 Persistencia"]
        HU12["HU12 Latencias"]
        HU13["HU13 Historial"]
        HU14["HU14 ICA, LP y RAGAs"]
        HU15["HU15 PR y exportación CSV"]
    end
    subgraph S4["Sprint 4 · Práctica adaptativa, instrumentos y despliegue (HU16–HU21)"]
        HU16["HU16 Exposición gradual"]
        HU17["HU17 Informe en tres dimensiones"]
        HU18["HU18 Evidencias y progreso"]
        HU19["HU19 Instrumentos T1 y T2"]
        HU20["HU20 Materiales del grupo control"]
        HU21["HU21 Despliegue"]
    end

    S1 ==> S2 ==> S3 ==> S4
    HU01 --> HU02
    HU03 --> HU04
    HU04 --> HU05 --> HU06 --> HU08
    HU07 --> HU08
    HU07 --> HU09
    HU07 --> HU10
    HU07 --> HU11
    HU11 --> HU12 --> HU14
    HU11 --> HU13
    HU11 --> HU15
    HU11 --> HU16
    HU12 --> HU16
    HU06 --> HU17
    HU11 --> HU17
    HU12 --> HU18
    HU17 --> HU18
    HU02 --> HU19
    HU07 --> HU19
    HU02 --> HU20
```

# Documentación funcional por historia de usuario

## Sprint 1: Acceso y base documental

Este sprint establece el acceso seguro, la separación de los participantes en grupo experimental y grupo control, la biblioteca de investigaciones y el procesamiento del PDF hasta dejarlo segmentado y vectorizado en la base de datos.

| **HU01: Registro e inicio de sesión** |
| --- |
| **Descripción:** Permite que el estudiante cree una cuenta e ingrese al sistema con su correo y contraseña. |
| **[ESPACIO RESERVADO PARA IMAGEN]**<br>Captura sugerida: pantallas /sign-in y /sign-up con sus formularios de correo y contraseña. |
| **Descripción del flujo de ejecución:**<br><br>1\. El usuario ingresa a la pantalla de inicio de sesión.<br><br>2\. Si ya tiene cuenta, escribe su correo y contraseña y presiona Iniciar sesión.<br><br>3\. Si no tiene cuenta, entra a Registrarse, completa nombre, correo y contraseña y envía el formulario.<br><br>4\. Better Auth valida las credenciales, crea la sesión y la guarda en PostgreSQL.<br><br>5\. Si el usuario intenta abrir una ruta protegida sin sesión, el middleware lo redirige a /sign-in.<br><br>6\. Con la sesión activa, el sistema lo envía a la pantalla que corresponde a su grupo de estudio. |

| **HU02: Grupos de estudio y control de acceso** |
| --- |
| **Descripción:** Permite al investigador asignar a cada participante al grupo experimental o al grupo control y darle un código de participante. El acceso a cada pantalla depende de ese grupo. |
| **[ESPACIO RESERVADO PARA IMAGEN]**<br>Captura sugerida: panel /admin con el selector de grupo y el código de participante, y la pantalla /sin-asignar. |
| **Descripción del flujo de ejecución:**<br><br>1\. Un usuario recién registrado no tiene grupo y el sistema lo mantiene en /sin-asignar con el mensaje Tu cuenta está en revisión.<br><br>2\. El investigador ingresa a /admin, cuyo acceso se valida con el correo definido en ADMIN_EMAIL.<br><br>3\. Busca al participante en el detalle por usuario.<br><br>4\. Le asigna el grupo experimental o el grupo control y, si corresponde, un código de participante único.<br><br>5\. El sistema guarda el grupo en la base de datos y lo lee de allí en cada pantalla y en cada Server Action.<br><br>6\. Si el participante es experimental, accede a la biblioteca, las sesiones de voz, el historial, el progreso y las encuestas.<br><br>7\. Si es control, solo accede a /materiales y /surveys, y cualquier otra ruta lo redirige a /materiales.<br><br>8\. Si el investigador quita el grupo, la cuenta vuelve a quedar bloqueada en /sin-asignar. |

| **HU03: Biblioteca de investigaciones** |
| --- |
| **Descripción:** Permite al estudiante del grupo experimental ver, buscar y eliminar sus investigaciones cargadas y abrir la sesión de práctica de cada una. |
| **[ESPACIO RESERVADO PARA IMAGEN]**<br>Captura sugerida: página de inicio con la sección Investigaciones Recientes, el buscador y las tarjetas con portada. |
| **Descripción del flujo de ejecución:**<br><br>1\. El estudiante ingresa a la página de inicio.<br><br>2\. El sistema lista solo las investigaciones del usuario autenticado, de la más reciente a la más antigua.<br><br>3\. Si escribe en el buscador, la lista se filtra por título o autor.<br><br>4\. Cada tarjeta muestra la portada, que se entrega desde R2 mediante /api/cover/[bookId].<br><br>5\. Si el estudiante elimina una investigación, el sistema verifica que le pertenezca, la borra y muestra la confirmación.<br><br>6\. Al seleccionar una tarjeta, el estudiante entra a la sesión de práctica de esa investigación. |

| **HU04: Carga de investigación en PDF** |
| --- |
| **Descripción:** Permite subir el avance de investigación en PDF, con portada opcional, título y voz del docente evaluador, para convertirlo en la fuente de la sustentación. |
| **[ESPACIO RESERVADO PARA IMAGEN]**<br>Captura sugerida: pantalla /books/new con el formulario completo y el selector de voz Camila o Alex. |
| **Descripción del flujo de ejecución:**<br><br>1\. El estudiante ingresa a Agregar.<br><br>2\. Si ya tiene cuatro investigaciones, el sistema muestra el aviso de límite alcanzado y no permite subir otra.<br><br>3\. Adjunta el archivo PDF, de hasta 50 MB.<br><br>4\. Opcionalmente adjunta una portada JPG, PNG o WEBP, de hasta 10 MB.<br><br>5\. Escribe el título y elige la voz del docente evaluador: Camila (femenina) o Alex (masculina), ambas en español peruano.<br><br>6\. El sistema valida que no exista otra investigación con el mismo título.<br><br>7\. El navegador pide a /api/upload una URL prefirmada y sube el PDF y la portada directamente al bucket privado de R2.<br><br>8\. Si no se adjuntó portada, el sistema usa la imagen de la primera página del PDF.<br><br>9\. El sistema registra la investigación con la voz elegida y continúa con el procesamiento del texto. |

| **HU05: Extracción, segmentación y embeddings** |
| --- |
| **Descripción:** Extrae el texto del PDF conservando la página de origen, lo divide en segmentos y genera sus embeddings para guardarlos en la base de datos vectorial. |
| **[ESPACIO RESERVADO PARA IMAGEN]**<br>Captura sugerida: registros de la tabla book_segments en Drizzle Studio, con contenido, número de página y embedding. |
| **Descripción del flujo de ejecución:**<br><br>1\. El sistema lee el PDF con pdfjs-dist y extrae el texto de cada página.<br><br>2\. Divide el texto en segmentos de 500 palabras con un solape de 50 palabras y registra la página de origen de cada segmento.<br><br>3\. Envía los segmentos por lotes al modelo gemini-embedding-001, que devuelve vectores de 768 dimensiones.<br><br>4\. Guarda cada segmento con su texto, página y embedding en la tabla book_segments.<br><br>5\. El índice HNSW con distancia coseno deja los segmentos listos para la búsqueda semántica.<br><br>6\. Si falla el guardado de los segmentos, el sistema muestra el mensaje Error al guardar los segmentos de la investigación.<br><br>7\. Si todo termina bien, el estudiante pasa directamente a la sesión de práctica de esa investigación. |

## Sprint 2: Conversación por voz con RAG

Este sprint integra los cinco componentes de la arquitectura en un ciclo síncrono: el estudiante habla, Vapi transcribe, el LLM recupera fragmentos del documento mediante el retriever, formula una pregunta anclada en ese contexto y la voz sintetizada la reproduce.

| **HU06: Recuperación de contexto con top-K y umbral** |
| --- |
| **Descripción:** Recupera los fragmentos más cercanos a la consulta del agente, descarta los que no superan el umbral de relevancia y los devuelve con su número de página. |
| **[ESPACIO RESERVADO PARA IMAGEN]**<br>Captura sugerida: sección Recuperaciones del documento en el detalle de una sesión, con la consulta, los fragmentos y sus distancias. |
| **Descripción del flujo de ejecución:**<br><br>1\. Durante la conversación, el LLM decide que necesita contexto e invoca el tool searchBook con bookId, sessionId y la consulta.<br><br>2\. Vapi envía la solicitud al webhook /api/vapi/search-book.<br><br>3\. El sistema valida los parámetros y embebe la consulta con Gemini.<br><br>4\. Busca en book_segments los cinco fragmentos más cercanos por distancia coseno (top-K = 5).<br><br>5\. Descarta los fragmentos con una distancia mayor a 0,6.<br><br>6\. Si quedan fragmentos, los devuelve al LLM precedidos por su página.<br><br>7\. Si no queda ninguno, devuelve un mensaje que obliga al agente a decir que el tema no aparece en la investigación.<br><br>8\. Después de responder a Vapi, el sistema registra la recuperación asociada a la sesión. |

| **HU07: Conversación por voz síncrona** |
| --- |
| **Descripción:** Permite al estudiante sostener una conversación por voz en tiempo real con el agente, con reconocimiento y síntesis de voz en español. |
| **[ESPACIO RESERVADO PARA IMAGEN]**<br>Captura sugerida: pantalla de sesión de voz con el indicador de estado, el temporizador y el nivel activo. |
| **Descripción del flujo de ejecución:**<br><br>1\. El estudiante abre una investigación de su biblioteca.<br><br>2\. Completa el panel Antes de empezar y presiona Iniciar.<br><br>3\. El sistema crea el registro de la sesión y llama a Vapi con el ASSISTANT_ID y los assistantOverrides: prompt, modelo, primer mensaje del nivel, voz elegida y variables de la sesión.<br><br>4\. Vapi transcribe la voz del estudiante con Deepgram nova-2 en español.<br><br>5\. El LLM GPT-4o genera la réplica del docente evaluador.<br><br>6\. Azure Speech la sintetiza con la voz es-PE-CamilaNeural o es-PE-AlexNeural.<br><br>7\. El indicador de estado muestra si el agente está hablando o escuchando, y el ciclo se repite en cada turno.<br><br>8\. Si el estudiante presiona Finalizar conversación, la llamada se corta de inmediato. |

| **HU08: Agente docente evaluador anclado** |
| --- |
| **Descripción:** Define el comportamiento del agente como docente evaluador de una sustentación de avance: pregunta en español, una cosa a la vez, basándose solo en el documento del estudiante. |
| **[ESPACIO RESERVADO PARA IMAGEN]**<br>Captura sugerida: transcripción de una sesión en la que el agente menciona la página del documento en su pregunta. |
| **Descripción del flujo de ejecución:**<br><br>1\. En cada llamada, el sistema envía a Vapi el system prompt de lib/agent-prompt.ts y el modelo EVALUATOR_MODEL (GPT-4o, temperatura 0,4).<br><br>2\. El agente abre la sesión con el primer mensaje del nivel de exigencia elegido.<br><br>3\. Antes de preguntar sobre el contenido, consulta el documento con searchBook.<br><br>4\. Formula una sola pregunta por turno, breve y sin listas, y puede citar la página del fragmento recuperado.<br><br>5\. Avanza en orden por las fases de la sustentación: apertura, problema y justificación, metodología, y resultados y conclusiones. Cuando una respuesta es vaga o contradice el documento, repregunta como máximo dos veces, y termina con un cierre de fortalezas y puntos a corregir.<br><br>6\. Si el tema no aparece en el documento, lo dice explícitamente y no inventa contenido.<br><br>7\. Ante un silencio, espera. Si el estudiante lo pide, reformula la pregunta.<br><br>8\. Responde siempre en español y no actúa como asistente de redacción. |

| **HU09: Transcripción en tiempo real** |
| --- |
| **Descripción:** Muestra durante la sesión la transcripción de lo que dicen el estudiante y el agente. |
| **[ESPACIO RESERVADO PARA IMAGEN]**<br>Captura sugerida: panel de transcripción con turnos del estudiante y del agente durante una sesión activa. |
| **Descripción del flujo de ejecución:**<br><br>1\. Al iniciar la sesión, el panel de transcripción queda visible debajo de los controles.<br><br>2\. Mientras el estudiante habla, el sistema muestra su texto parcial y lo reemplaza por el texto final.<br><br>3\. El texto del agente se toma de los mensajes voice-input de Vapi, que contienen el texto literal enviado a la síntesis de voz.<br><br>4\. El turno del agente se cierra cuando el estudiante empieza a hablar o cuando termina la llamada.<br><br>5\. Cada turno cerrado se agrega al historial visible de la conversación. |

| **HU10: Duración máxima y manejo de errores** |
| --- |
| **Descripción:** Limita la sesión a 20 minutos, avisa al agente para que cierre a tiempo e informa al estudiante con mensajes claros cuando falla la conexión, el micrófono o un servicio externo. |
| **[ESPACIO RESERVADO PARA IMAGEN]**<br>Captura sugerida: temporizador de la sesión y panel de requisitos abierto con el mensaje sobre conexión, micrófono y parlantes. |
| **Descripción del flujo de ejecución:**<br><br>1\. Antes de iniciar, el estudiante puede abrir el panel de requisitos, que indica que necesita conexión estable, micrófono y parlantes o audífonos.<br><br>2\. Durante la sesión, el temporizador muestra el tiempo transcurrido sobre el máximo de 20 minutos.<br><br>3\. Tres minutos antes del límite, el sistema indica al agente que empiece el cierre.<br><br>4\. Vapi corta la llamada al alcanzar la duración máxima.<br><br>5\. Si la sesión termina por inactividad, por pérdida de conexión o de forma inesperada, el sistema muestra el mensaje correspondiente e invita a reintentar.<br><br>6\. Si no se pudo iniciar, indica revisar la conexión, el permiso del micrófono y la disponibilidad de los servicios externos. |

## Sprint 3: Instrumentación y métricas

Este sprint convierte cada sesión en evidencia medible: guarda turnos, recuperaciones y latencias, permite revisar el historial y calcula las métricas que exige la investigación.

| **HU11: Persistencia de sesiones, turnos y recuperaciones** |
| --- |
| **Descripción:** Guarda cada sesión de voz con sus turnos y los fragmentos recuperados para analizar después la conversación. |
| **[ESPACIO RESERVADO PARA IMAGEN]**<br>Captura sugerida: tablas voice_sessions, session_turns y turn_retrievals en Drizzle Studio con datos de una sesión. |
| **Descripción del flujo de ejecución:**<br><br>1\. Al iniciar, el sistema verifica que la investigación pertenezca al estudiante y crea el registro en voice_sessions con el nivel, su origen y la autoevaluación previa.<br><br>2\. Cuando Vapi confirma la llamada, el sistema asocia su identificador a la sesión.<br><br>3\. Cada turno cerrado del estudiante o del agente se guarda en session_turns con su rol, texto y orden.<br><br>4\. Si un turno recibe más texto después de guardarse, el sistema lo actualiza.<br><br>5\. Cada recuperación del retriever se guarda en turn_retrievals con la consulta, el segmento y la distancia.<br><br>6\. Al terminar la llamada, el sistema registra el fin y la duración de la sesión. |

| **HU12: Registro de latencias** |
| --- |
| **Descripción:** Registra la latencia del sistema y la latencia de respuesta verbal del estudiante en cada turno. |
| **[ESPACIO RESERVADO PARA IMAGEN]**<br>Captura sugerida: sección Rendimiento de la sesión con la respuesta del estudiante, la respuesta del sistema y la latencia por turno. |
| **Descripción del flujo de ejecución:**<br><br>1\. El sistema escucha los eventos de inicio y fin de habla de Vapi.<br><br>2\. Cuando el estudiante termina de hablar, empieza a medir la latencia del sistema, que termina cuando el agente comienza su réplica.<br><br>3\. Cuando el agente termina su pregunta, empieza a medir la latencia del estudiante, que termina con su primera palabra.<br><br>4\. Cada latencia se guarda en el turno correspondiente, como systemLatencyMs o studentLatencyMs.<br><br>5\. Si no hay medición, el valor queda vacío y se muestra como Sin datos, nunca como cero.<br><br>6\. Las dos latencias se reportan por separado y nunca se promedian juntas. |

| **HU13: Historial y detalle de sesiones** |
| --- |
| **Descripción:** Permite al estudiante revisar sus sesiones anteriores y el detalle completo de cada una, en modo de solo lectura. |
| **[ESPACIO RESERVADO PARA IMAGEN]**<br>Captura sugerida: pantalla /history con la lista de sesiones y la pantalla de detalle con su menú de secciones. |
| **Descripción del flujo de ejecución:**<br><br>1\. El estudiante abre Historial desde el menú de su perfil o desde una investigación.<br><br>2\. El sistema lista sus sesiones con fecha, duración, número de mensajes, nivel y autoevaluaciones.<br><br>3\. Al elegir una sesión, el sistema verifica que le pertenezca y carga el detalle.<br><br>4\. El detalle muestra la conversación, el informe, las evidencias de avance, la exposición gradual, el rendimiento, las recuperaciones y la evaluación de respuestas.<br><br>5\. La conversación no puede continuarse desde el historial. |

| **HU14: Panel de ICA, LP y RAGAs** |
| --- |
| **Descripción:** Calcula y muestra al investigador el ICA, la latencia promedio del sistema, la latencia del estudiante y las métricas RAGAs a partir de los datos registrados. |
| **[ESPACIO RESERVADO PARA IMAGEN]**<br>Captura sugerida: pantalla /metrics con las tarjetas de ICA, LP, latencia del estudiante y RAGAs. |
| **Descripción del flujo de ejecución:**<br><br>1\. El investigador ingresa a /metrics, cuyo acceso se valida con METRICS_OWNER_EMAILS.<br><br>2\. El sistema calcula el ICA como (Ci / Ct) × 100 a partir del registro de los cinco componentes: STT, LLM, base vectorial, retriever y TTS.<br><br>3\. Calcula la LP como el promedio de las latencias del sistema, con mediana, mínimo y máximo.<br><br>4\. Muestra aparte la latencia de respuesta verbal del estudiante con los mismos estadísticos.<br><br>5\. Si hay ternas pendientes, el investigador presiona calcular RAGAs y el juez gemini-2.5-flash evalúa fidelidad, pertinencia, precisión del contexto y cobertura del contexto.<br><br>6\. El panel muestra también los promedios de la retroalimentación en tres dimensiones y el resumen de la exposición gradual.<br><br>7\. Si cambia la versión del prompt del juez, el investigador puede borrar los puntajes y volver a calcularlos. |

| **HU15: Revisión humana (PR) y exportación CSV** |
| --- |
| **Descripción:** Permite revisar a mano cada respuesta del agente para calcular la precisión de respuestas (PR) y exportar las métricas en CSV para el análisis estadístico. |
| **[ESPACIO RESERVADO PARA IMAGEN]**<br>Captura sugerida: pantalla /metrics/revision con una respuesta del agente, la pregunta previa, los fragmentos y los botones de evaluación. |
| **Descripción del flujo de ejecución:**<br><br>1\. El investigador ingresa a Revisión de respuestas desde /metrics.<br><br>2\. Filtra los turnos pendientes, revisados o todos.<br><br>3\. En cada turno revisa la intervención previa del estudiante, la respuesta del agente y los fragmentos recuperados.<br><br>4\. Marca la respuesta como correcta o incorrecta según el criterio de revisión, o quita una evaluación ya hecha.<br><br>5\. El sistema calcula PR como (Rc / Rt) × 100, donde Rt son solo los turnos revisados, y reporta los pendientes aparte.<br><br>6\. Desde /metrics, el investigador exporta tres CSV (turnos, sesiones y participantes) en UTF-8 y con el código de participante.<br><br>7\. Los archivos quedan listos para cruzarlos con las encuestas en SPSS o R. |

## Sprint 4: Práctica adaptativa, instrumentos y despliegue

Este sprint agrega las extensiones que diferencian al producto de un asistente genérico de consulta de documentos: exigencia adaptativa, retroalimentación en tres dimensiones y evidencias de avance. También incorpora los instrumentos del estudio para ambos grupos y deja el sistema desplegado para la intervención.

| **HU16: Exposición gradual adaptativa** |
| --- |
| **Descripción:** Ofrece cuatro niveles de exigencia y sugiere uno con una regla determinista a partir de la autoevaluación del estudiante y de su sesión anterior. El estudiante puede cambiarlo. |
| **[ESPACIO RESERVADO PARA IMAGEN]**<br>Captura sugerida: panel Antes de empezar con la escala de 0 a 10, el nivel sugerido y las cuatro tarjetas de nivel. |
| **Descripción del flujo de ejecución:**<br><br>1\. Al abrir una investigación, el sistema muestra el panel Antes de empezar.<br><br>2\. El estudiante responde de 0 a 10 qué tan nervioso se siente por sustentar. La respuesta es opcional.<br><br>3\. La regla de adaptación parte de esa respuesta y la respalda con el nivel y los indicadores de la sesión anterior (silencios largos, respuestas incompletas, pedidos de reformulación y latencia media del estudiante). Con eso sugiere subir, mantener o bajar un nivel.<br><br>4\. El sistema muestra el nivel sugerido con su motivo: Ensayo seguro, Práctica guiada, Simulación realista o Simulación desafiante.<br><br>5\. Si el estudiante elige otro nivel, el sistema registra que la elección fue manual.<br><br>6\. Al iniciar, el nivel determina el primer mensaje y las directivas que recibe el agente. |

| **HU17: Informe post-sesión en tres dimensiones** |
| --- |
| **Descripción:** Entrega al estudiante un informe que separa dominio del contenido, claridad y estructura, y conducta comunicativa registrada, sin una nota global. Todo juicio de contenido cita el fragmento del documento que lo respalda. |
| **[ESPACIO RESERVADO PARA IMAGEN]**<br>Captura sugerida: sección Informe de la sesión con las tres tarjetas de dimensión y el detalle por pregunta con su cita. |
| **Descripción del flujo de ejecución:**<br><br>1\. Al cerrar la sesión, el estudiante llega al informe en /history/[sessionId]#informe.<br><br>2\. El sistema muestra cuántas respuestas están evaluadas, pendientes o sin fragmento recuperado.<br><br>3\. El estudiante presiona Evaluar pendientes.<br><br>4\. El juez evalúa el contenido de cada respuesta con la rúbrica y debe citar uno de los fragmentos recuperados para esa pregunta.<br><br>5\. Si no hay una cita válida, el juicio de contenido queda como no concluyente, nunca como cero.<br><br>6\. La claridad se evalúa a partir de la pregunta y la respuesta, sin cita.<br><br>7\. La conducta comunicativa se reporta como hechos registrados: silencios largos, respuestas incompletas, pedidos de reformulación y latencias.<br><br>8\. El informe muestra las tres dimensiones por separado y el detalle por pregunta. |

| **HU18: Evidencias de avance y progreso** |
| --- |
| **Descripción:** Muestra al cerrar la sesión los avances respaldados por un dato, registra la autoevaluación final y permite consultar la evolución del estudiante entre sesiones. |
| **[ESPACIO RESERVADO PARA IMAGEN]**<br>Captura sugerida: modal de cierre con el Resumen de la sesión y la escala final, y la pantalla /progreso con sus gráficos. |
| **Descripción del flujo de ejecución:**<br><br>1\. Al finalizar la conversación, el sistema abre el modal de cierre.<br><br>2\. El modal muestra por escrito las evidencias de la sesión: logros registrados y mejoras respecto de la sesión anterior con el mismo documento, cada una con su dato.<br><br>3\. Si algo empeoró, también se muestra con su dato.<br><br>4\. El estudiante responde la autoevaluación final de 0 a 10 y la guarda.<br><br>5\. El sistema lo lleva directamente al informe de la sesión.<br><br>6\. En Mi progreso, el estudiante elige una investigación y ve la evolución de la latencia de respuesta, el dominio del contenido, la claridad, los temas respondidos con respaldo y las autoevaluaciones previa y posterior.<br><br>7\. Con una sola sesión medida, el sistema indica que todavía no hay evolución que leer. |

| **HU19: Instrumentos de medición basal y posterior** |
| --- |
| **Descripción:** Permite a los participantes responder los instrumentos del estudio en T1 y T2, y al investigador seguir su avance y exportar los puntajes para comparar ambas mediciones. |
| **[ESPACIO RESERVADO PARA IMAGEN]**<br>Captura sugerida: pantalla /surveys con las cinco etapas y sus estados, y el resumen de encuestas en /admin. |
| **Descripción del flujo de ejecución:**<br><br>1\. El participante ingresa a Encuestas.<br><br>2\. Las dos mediciones basales, STAI T1 (20 ítems, escala de 0 a 3) y PRCS-12 T1 (12 ítems, escala de 1 a 6), están disponibles en cualquier orden.<br><br>3\. En el grupo experimental, la SUS (10 ítems, escala de 1 a 5) se desbloquea cuando completa ambas basales y al menos una conversación con el agente.<br><br>4\. STAI T2 se desbloquea después de la SUS en el grupo experimental, o después de las basales en el grupo control.<br><br>5\. PRCS-12 T2 se desbloquea después de STAI T2.<br><br>6\. Al enviar, el sistema valida que todas las respuestas estén completas, calcula el puntaje con la regla de cada instrumento, incluidos los ítems invertidos, y lo guarda.<br><br>7\. En /admin, el investigador ve el estado de cada etapa por participante y exporta el resumen de encuestas en CSV. |

| **HU20: Materiales del grupo control** |
| --- |
| **Descripción:** Permite al investigador compartir PDF de preparación con el grupo control, que recibe una condición pasiva sin el agente de voz. |
| **[ESPACIO RESERVADO PARA IMAGEN]**<br>Captura sugerida: sección Materiales compartidos en /admin y la pantalla /materiales vista por un participante control. |
| **Descripción del flujo de ejecución:**<br><br>1\. El investigador ingresa a /admin, a la sección Materiales compartidos.<br><br>2\. Escribe un título, una descripción opcional y adjunta un PDF.<br><br>3\. El sistema valida el archivo, lo sube a R2 y registra el material.<br><br>4\. El participante control ingresa a /materiales.<br><br>5\. Ve los documentos compartidos, los doce temas típicos de una sustentación y las recomendaciones de preparación.<br><br>6\. Al abrir un documento, el sistema verifica que el usuario tenga acceso a materiales y lo entrega desde R2.<br><br>7\. Un participante experimental que intenta abrir /materiales es redirigido a la biblioteca. |

| **HU21: Despliegue y operación del sistema** |
| --- |
| **Descripción:** Permite publicar y operar la aplicación con una configuración reproducible de la base de datos, el almacenamiento y los servicios externos.<br><br>**Pantallas o componentes:** .env, drizzle.config.ts, carpeta drizzle/, package.json, configuración del assistant en Vapi y docs/agente/. |
| **[ESPACIO RESERVADO PARA IMAGEN]**<br>Captura sugerida: configuración del tool searchBook en el dashboard de Vapi con su server URL, y la aplicación en ejecución. |
| **Descripción del flujo de ejecución:**<br><br>1\. El equipo configura las variables de entorno de base de datos, Better Auth, Cloudflare R2, Vapi, Gemini y los correos de administrador y de métricas.<br><br>2\. Prepara PostgreSQL con la extensión pgvector y aplica las migraciones con npm run db:migrate.<br><br>3\. Crea el bucket privado de R2 para los PDF, las portadas y los materiales.<br><br>4\. En el dashboard de Vapi configura el assistant, el transcriber y el tool searchBook con la URL pública de /api/vapi/search-book.<br><br>5\. Compila la aplicación con npm run build y la ejecuta con npm run start.<br><br>6\. El system prompt, el modelo, la voz y el plan de turnos se envían desde el código en cada llamada, así que no dependen de la configuración del dashboard.<br><br>7\. El investigador asigna los grupos de estudio y el sistema queda listo para la intervención. |
