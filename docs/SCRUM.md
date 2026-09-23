**UNIVERSIDAD NACIONAL DE TRUJILLO**

**FACULTAD DE INGENIERÍA**

**ESCUELA ACADÉMICO PROFESIONAL DE INGENIERÍA DE SISTEMAS**




**INVESTFIED - Agente conversacional por voz con generación aumentada por recuperación para fortalecer la autoeficacia en la sustentación de tesis en estudiantes universitarios**

*METODOLOGÍA SCRUM — PRODUCT BACKLOG, HISTORIAS DE USUARIO Y SPRINTS*







**AUTOR:**

Jondec Delgado Cristhian André 







**DOCENTE:**

Mendoza Rivera, Ricardo Darío













**TRUJILLO – PERÚ**

30/09/2026
**\

# **1. Product Vision Board**
Investfied es una plataforma web que permite al estudiante cargar un avance de investigación en\
formato PDF y practicar su sustentación mediante una conversación por voz. El sistema procesa el\
documento, lo divide en fragmentos, genera representaciones vectoriales y recupera el contexto\
relevante para que un agente conversacional formule preguntas relacionadas con la investigación.

El agente asume el rol de docente evaluador de una sustentación de avance. La solución integra\
reconocimiento de voz (STT), un modelo de lenguaje (LLM), una base de datos vectorial, un retriever\
y síntesis de voz (TTS). Además, registra las sesiones, turnos, latencias y fragmentos recuperados\
para producir evidencia medible para la investigación.

Sobre ese núcleo funcional se incorporó un segundo bloque de funcionalidades orientadas al aporte\
diferencial de la tesis: el simulacro no responde siempre igual, sino que escala su exigencia en\
cuatro niveles; al cerrar cada sesión se entrega un informe en tres dimensiones separadas; y el\
estudiante dispone de un mapa de preparación por tema, de un registro de predicciones contrastado\
con la evidencia de la sesión y de una vista de progreso entre sesiones. Estas extensiones son las\
que diferencian al producto de un asistente genérico de consulta de documentos, porque evalúan la\
conducta de sustentar y no la comprensión de un texto.

*Tabla 1. Product Vision Board*

|**Investfied**|**Usuarios**|**Necesidades**|**Producto**|**Valor**|
| :- | :- | :- | :- | :- |
|**Sistema conversacional por voz con RAG y exposición gradual adaptativa para practicar sustentaciones de investigación**|Estudiantes que preparan una sustentación, asignados a grupo experimental o de control. Investigadores que necesitan registrar y evaluar sesiones. Asesores o jurados que revisan la evidencia del prototipo.|Cargar una investigación. Practicar preguntas académicas por voz con una exigencia acorde al momento. Recibir preguntas ancladas en el propio documento. Saber en qué temas se está flojo. Ver avances entre sesiones. Consultar transcripciones, latencias y métricas.|Biblioteca de investigaciones. Procesamiento PDF con segmentación y embeddings. Retriever con búsqueda vectorial, top-K y umbral. Agente evaluador en español mediante Vapi. Cuatro niveles de exigencia con regla de adaptación determinista. Informe post-sesión en tres dimensiones. Mapa de preparación por tema. Contraste de predicciones. Vista de progreso longitudinal. Persistencia de sesiones y módulo /metrics.|Mayor preparación y confianza para la sustentación. Retroalimentación basada en el documento real y en hechos registrados. Trazabilidad del contexto usado por el agente. Evidencia cuantitativa para evaluar el sistema y para contrastar el grupo experimental con el de control.|
# **2. Roles de Scrum**
En la Tabla 3 se presentan los roles Scrum adoptados para un proyecto desarrollado por una sola\
persona. La misma persona asumió los roles, pero mantuvo diferenciadas sus responsabilidades.

*Tabla 3. Roles Scrum*

|**Responsable**|**Roles**|**Responsabilidades principales**|
| :- | :- | :- |
|**Cristhian André Jondec Delgado** |Product Owner / Scrum Master / Developer|Definir y priorizar el Product Backlog, organizar los sprints, gestionar impedimentos, analizar requisitos, diseñar, programar, probar y documentar el producto.|

*Nota: completar el nombre del estudiante y del docente antes de presentar el documento.*
# **4. Identificación de procesos**
• Gestionar la autenticación y el acceso seguro de los usuarios.

• Gestionar los roles de usuario y la asignación del participante al grupo experimental o de control.

• Gestionar la biblioteca de investigaciones cargadas por el estudiante.

• Cargar, validar y almacenar documentos PDF en la plataforma.

• Extraer el texto del documento respetando la información de sus páginas.

• Segmentar el contenido y generar embeddings para la búsqueda semántica.

• Recuperar fragmentos relevantes de la investigación mediante la base vectorial.

• Determinar el nivel de exigencia del simulacro a partir de la autoevaluación y del desempeño previo.

• Gestionar la sesión de conversación por voz entre el estudiante y el agente.

• Formular preguntas de sustentación en español y en rol de docente evaluador.

• Registrar transcripciones, turnos, recuperaciones y latencias de cada sesión.

• Evaluar cada respuesta del estudiante en contenido, claridad e indicadores conductuales observables.

• Clasificar por tema las preguntas del agente y medir la cobertura del documento por tema.

• Registrar las predicciones previas del estudiante y contrastarlas con la evidencia de la sesión.

• Comparar sesiones sucesivas del mismo estudiante para reportar avances verificables.

• Evaluar la precisión de las respuestas y calcular las métricas del sistema.

• Consultar y exportar los resultados de evaluación para la investigación.
# **5. Identificación de requerimientos**
Se describen a continuación los requerimientos funcionales y no funcionales identificados para el\
sistema Investfied.
## **Requerimientos funcionales**
Según los procesos identificados, se establecieron las siguientes funcionalidades:

• El sistema debe permitir el registro e inicio de sesión del estudiante.

• El sistema debe diferenciar roles de usuario y registrar el grupo de estudio (experimental o control) de cada participante.

• El estudiante debe poder cargar un documento de investigación en formato PDF.

• El sistema debe extraer el texto del PDF y conservar el número de página de origen.

• El sistema debe dividir el texto en segmentos de 500 palabras con un solape de 50 palabras.

• El sistema debe generar embeddings y almacenar los segmentos en PostgreSQL con pgvector.

• El retriever debe buscar fragmentos por similitud coseno y aplicar un valor top-K configurable.

• El retriever debe descartar fragmentos que no superen el umbral de relevancia establecido.

• El estudiante debe poder iniciar y finalizar una conversación de voz sobre su investigación.

• La conversación debe integrar STT, LLM y TTS mediante Vapi y ElevenLabs.

• El agente debe realizar preguntas en español, con el rol de docente evaluador.

• El agente debe consultar el documento antes de formular preguntas de contenido y no debe inventar información.

• El sistema debe mostrar la transcripción de la conversación en tiempo real.

• El sistema debe registrar cada sesión, turno, fragmento recuperado y distancia de similitud.

• El sistema debe calcular la latencia promedio del sistema y la latencia de respuesta verbal del estudiante.

• El sistema debe calcular ICA, PR, LP y métricas RAGAs a partir de los datos persistidos.

• El sistema debe mostrar las métricas y permitir su exportación en CSV.

• El sistema debe ofrecer cuatro niveles de exigencia del simulacro y sugerir uno mediante una regla determinista, permitiendo que el estudiante lo modifique.

• El sistema debe solicitar una autoevaluación de 0 a 10 antes y después de cada sesión y registrarla junto con la sesión.

• El sistema debe entregar, al cerrar la sesión, un informe con tres dimensiones separadas: dominio del contenido, claridad y estructura, e indicadores conductuales observables.

• Todo juicio de contenido debe citar el fragmento del documento que lo sustenta; sin cita, la evaluación se marca como no concluyente.

• El sistema debe mostrar un mapa de preparación que clasifique cada tema en domina, parcial, no practicado o hueco en el documento, con las páginas asociadas.

• El estudiante debe poder iniciar una sesión enfocada únicamente en los temas débiles.

• El sistema debe registrar predicciones previas opcionales y contrastarlas con los hechos registrados de la sesión, sin calificar al estudiante.

• El sistema debe recordar, al inicio de cada sesión, la estrategia declarada al cerrar la sesión anterior.

• El sistema debe generar evidencias de avance respaldadas por un dato registrado y mostrar la evolución del estudiante entre sesiones.

• El agente debe cerrar la sesión por voz leyendo evidencias verificables, nunca elogios genéricos.
## **Requerimientos no funcionales**
*Tabla 4. Requerimientos no funcionales*

|**Requerimiento**|**Descripción**|
| :- | :- |
|**Seguridad y privacidad**|El sistema debe validar la sesión del usuario, comprobar la propiedad de cada investigación antes de leer o modificar sus datos y restringir por rol el acceso a los datos de otros participantes. Las credenciales y claves de servicios deben mantenerse fuera del repositorio.|
|**Rendimiento**|La recuperación de contexto debe responder con una latencia medible y la conversación debe conservar una interacción suficientemente fluida para el uso por voz.|
|**Usabilidad**|La interfaz debe ser clara, responsive y comprensible para estudiantes sin conocimientos técnicos avanzados. Los mensajes al usuario deben estar en español.|
|**Mantenibilidad**|El código debe organizarse en módulos reutilizables de Next.js, TypeScript, Server Actions, Drizzle y componentes de interfaz.|
|**Trazabilidad**|Cada respuesta evaluable debe poder relacionarse con su pregunta, contexto recuperado, documento y sesión correspondiente.|
|**Reproducibilidad**|Las decisiones que afectan la medición —nivel sugerido, indicadores conductuales, estado por tema, contraste de predicciones y evidencias de avance— deben calcularse con funciones deterministas y umbrales declarados en el código, de modo que los mismos datos produzcan siempre el mismo resultado.|
|**Rigor en el lenguaje**|Ningún texto generado por el sistema debe afirmar estados emocionales del estudiante. Los indicadores conductuales se reportan como hechos con su número asociado; la palabra "ansiedad" solo se usa cuando proviene de un instrumento validado respondido por el estudiante.|
|**Disponibilidad**|La aplicación debe informar las limitaciones de conectividad, micrófono, parlantes y disponibilidad de los servicios externos.|
# **6. Historias de usuario**
Las historias de usuario se presentan ordenadas por el incremento funcional desarrollado entre abril\
y septiembre de 2026. Las historias HU1 a HU18 corresponden al núcleo funcional del sistema; las\
historias HU19 a HU23 corresponden a las extensiones incorporadas una vez alcanzado ese núcleo.\
El estado indicado corresponde al cierre de la versión candidata del proyecto.

*Tabla 5. Historias de usuario*

|**HU**|**Nombre**|**Descripción**|
| :- | :- | :- |
|**HU1**|Registro e inicio de sesión|Como estudiante, quiero registrarme e iniciar sesión para acceder de forma segura a mis investigaciones y sesiones.|
|**HU2**|Roles de usuario y grupo de estudio|Como investigador, quiero diferenciar roles de usuario y asignar a cada participante al grupo experimental o al grupo de control, para separar el acceso a las funcionalidades y poder comparar ambos grupos en los resultados.|
|**HU3**|Biblioteca de investigaciones|Como estudiante, quiero visualizar mis investigaciones cargadas para seleccionar aquella que usaré en la práctica.|
|**HU4**|Carga de investigación en PDF|Como estudiante, quiero cargar un avance de investigación en PDF para convertirlo en la fuente de la sustentación.|
|**HU5**|Extracción y segmentación por páginas|Como sistema, quiero extraer y segmentar el texto del PDF conservando su página de origen para facilitar la trazabilidad.|
|**HU6**|Embeddings del documento|Como sistema, quiero generar embeddings de cada segmento para realizar búsquedas semánticas.|
|**HU7**|Base vectorial|Como sistema, quiero guardar los segmentos y embeddings en una base de datos para consultarlos durante la conversación.|
|**HU8**|Recuperación de contexto RAG|Como estudiante, quiero que el sistema recupere fragmentos relevantes de mi investigación antes de generar una pregunta.|
|**HU9**|Umbral y top-K del retriever|Como investigador, quiero configurar top-K y un umbral de distancia para evitar contexto irrelevante.|
|**HU10**|Conversación por voz|Como estudiante, quiero conversar en tiempo real con el agente para practicar una sustentación oral.|
|**HU11**|Agente docente evaluador|Como estudiante, quiero que el agente formule preguntas sobre problema, metodología, resultados y conclusiones con rigor académico.|
|**HU12**|Anclaje obligatorio y español|Como estudiante, quiero recibir preguntas en español basadas en mi documento, sin que el agente invente información.|
|**HU13**|Selección de voz y transcripción|Como estudiante, quiero visualizar la transcripción de la sesión mientras converso.|
|**HU14**|Persistencia de sesiones y turnos|Como investigador, quiero guardar cada intervención de la sesión para poder analizar posteriormente la conversación.|
|**HU15**|Registro de latencias y recuperaciones|Como investigador, quiero registrar la latencia del sistema y la respuesta del estudiante.|
|**HU16**|Cálculo de ICA y métricas|Como investigador, quiero calcular ICA, PR, LP y RAGAs con los datos de las sesiones.|
|**HU17**|Panel y exportación de resultados|Como investigador, quiero consultar metricas y exportar los resultados en CSV para utilizarlos en el informe de investigación.|
|**HU18**|Manejo de errores y limitaciones|Como usuario, quiero recibir mensajes claros cuando falte conexión, micrófono, parlantes, configuración o contexto relevante.|
|**HU19**|Exposición gradual adaptativa|Como estudiante, quiero que el simulacro tenga cuatro niveles de exigencia y que el sistema me sugiera uno a partir de mi autoevaluación de 0 a 10 y de mi sesión anterior, pudiendo cambiarlo, para no enfrentar un jurado exigente desde la primera práctica.|
|**HU20**|Informe post-sesión en tres dimensiones|Como estudiante, quiero recibir al terminar un informe que separe dominio del contenido, claridad y estructura, e indicadores conductuales observables, con la cita del fragmento que respalda cada juicio de contenido, para saber qué corregir sin recibir una nota global.|
|**HU21**|Mapa de preparación para la sustentación|Como estudiante, quiero ver cada tema de mi investigación clasificado en domina, parcial, no practicado o hueco en el documento, con sus páginas, y poder practicar solo los temas débiles, para saber qué tan listo estoy y dónde exactamente estoy flojo.|
|**HU22**|Predicción previa y contraste con la sesión|Como estudiante, quiero registrar antes de la sesión qué creo que me preguntarán, qué parte temo y qué pasaría si no recuerdo algo, y ver después el contraste con lo que realmente ocurrió, para confrontar mis expectativas con evidencia registrada.|
|**HU23**|Evidencias de avance y progreso longitudinal|Como estudiante, quiero que al cerrar la sesión se me muestren avances concretos respaldados por un dato y poder consultar mi evolución entre sesiones, para reconocer progreso sin elogios genéricos.|
# **7. Product backlog priorizado**
*Tabla 6. Product backlog priorizado*

|**Historia de usuario**|**Descripción**|**Prioridad**|
| :- | :- | :- |
|**HU1**|Registro e inicio de sesión|1|
|**HU2**|Roles de usuario y grupo de estudio|1|
|**HU3**|Biblioteca de investigaciones|1|
|**HU4**|Carga de investigación en PDF|1|
|**HU5**|Extracción y segmentación por páginas|1|
|**HU6**|Embeddings del documento|1|
|**HU7**|Base vectorial|1|
|**HU8**|Recuperación de contexto RAG|1|
|**HU9**|Umbral y top-K del retriever|1|
|**HU10**|Conversación por voz|1|
|**HU11**|Agente docente evaluador|1|
|**HU12**|Anclaje obligatorio y español|1|
|**HU13**|Selección de voz y transcripción|2|
|**HU14**|Persistencia de sesiones y turnos|1|
|**HU15**|Registro de latencias y recuperaciones|1|
|**HU16**|Cálculo de ICA y métricas|1|
|**HU17**|Panel y exportación de resultados|1|
|**HU18**|Manejo de errores y limitaciones|2|
|**HU19**|Exposición gradual adaptativa|3|
|**HU20**|Informe post-sesión en tres dimensiones|3|
|**HU21**|Mapa de preparación para la sustentación|3|
|**HU22**|Predicción previa y contraste con la sesión|3|
|**HU23**|Evidencias de avance y progreso longitudinal|3|

**Prioridad 1:** funcionalidades indispensables para el flujo principal y la evidencia de la\
investigación.\
**Prioridad 2:** funcionalidades importantes para completar la evaluación, la trazabilidad y la\
calidad del producto.\
**Prioridad 3:** extensiones incorporadas una vez estabilizado el núcleo funcional. No condicionan\
el flujo obligatorio STT → recuperación → LLM anclado → TTS ni el cálculo de ICA, PR, LP y RAGAs,\
pero sostienen el aporte diferencial de la investigación frente a un asistente genérico de consulta\
de documentos.
# **8. Estimación del product backlog**
En las tablas 7 y 8 se presenta la estimación del Product Backlog mediante puntos de historia y\
tiempo ideal de desarrollo. La estimación considera una persona desarrolladora y no incluye tiempos\
de espera de servicios externos.

*Tabla 7. Asignación de puntos de historia*

|**Tamaño**|**Puntos**|**Tiempo [días]**|
| :- | :- | :- |
|**XtraSmall (XS)**|1|0\.5|
|**Small (S)**|2|1|
|**Medium (M)**|3|1\.5|
|**Large (L)**|5|2|
|**XtraLarge (XL)**|8|3|

*Tabla 8. Estimación del Product Backlog por sprint*

|**Sprint y fechas**|**HU**|**Descripción**|**Tamaño**|**Puntos**|**Tiempo [días]**|
| :- | :- | :- | :- | :- | :- |
|**Sprint 1** 01–12 abril (Base, acceso y roles)|HU1|Registro e inicio de sesión|M|3|1\.5|
||HU2|Roles de usuario y grupo de estudio|M|3|1\.5|
||HU3|Biblioteca de investigaciones|M|3|1\.5|
|**Subtotal Sprint 1**||||**9**|**4.5**|
|**Sprint 2** 13–26 abril (Carga y procesamiento)|HU4|Carga de investigación en PDF|L|5|2|
||HU5|Extracción y segmentación por páginas|L|5|2|
|**Subtotal Sprint 2**||||**10**|**4**|
|**Sprint 3** 27 abril–10 mayo (Embeddings y base vectorial)|HU6|Embeddings del documento|XL|8|3|
||HU7|Base vectorial|XL|8|3|
|**Subtotal Sprint 3**||||**16**|**6**|
|**Sprint 4** 11–24 mayo (Retriever)|HU8|Recuperación de contexto RAG|XL|8|3|
||HU9|Umbral y top-K del retriever|XL|8|3|
|**Subtotal Sprint 4**||||**16**|**6**|
|**Sprint 5** 25 mayo–07 junio (Conversación de voz)|HU10|Conversación por voz|XL|8|3|
||HU13|Selección de voz y transcripción|M|3|1\.5|
|**Subtotal Sprint 5**||||**11**|**4.5**|
|**Sprint 6** 08–21 junio (Agente evaluador)|HU11|Agente docente evaluador|L|5|2|
||HU12|Anclaje obligatorio y español|L|5|2|
|**Subtotal Sprint 6**||||**10**|**4**|
|**Sprint 7** 22 junio–05 julio (Persistencia e instrumentación)|HU14|Persistencia de sesiones y turnos|XL|8|3|
||HU15|Registro de latencias y recuperaciones|L|5|2|
|**Subtotal Sprint 7**||||**13**|**5**|
|**Sprint 8** 06–19 julio (Evaluación)|HU16|Cálculo de ICA y métricas|XL|8|3|
|**Subtotal Sprint 8**||||**8**|**3**|
|**Sprint 9** 20 julio–02 agosto (Reporte y documentación)|HU17|Panel y exportación de resultados|L|5|2|
|**Subtotal Sprint 9**||||**5**|**2**|
|**Sprint 10** 03–16 agosto (Calidad y errores)|HU18|Manejo de errores y limitaciones|M|3|1\.5|
|||Pruebas integrales y correcciones|M|3|1\.5|
|**Subtotal Sprint 10**||||**6**|**3**|
|**Sprint 11** 17–30 agosto (Cierre del núcleo funcional)||Validación del incremento, revisión final y preparación de evidencias|M|3|1\.5|
|**Subtotal Sprint 11**||||**3**|**1.5**|
|**Sprint 12** 01–14 septiembre (Exposición gradual y retroalimentación)|HU19|Exposición gradual adaptativa|XL|8|3|
||HU20|Informe post-sesión en tres dimensiones|XL|8|3|
|**Subtotal Sprint 12**||||**16**|**6**|
|**Sprint 13** 15–28 septiembre (Diagnóstico, predicción y progreso)|HU21|Mapa de preparación para la sustentación|XL|8|3|
||HU22|Predicción previa y contraste con la sesión|L|5|2|
||HU23|Evidencias de avance y progreso longitudinal|L|5|2|
|**Subtotal Sprint 13**||||**18**|**7**|
|**TOTAL GENERAL**||||**141**|**56.5**|

**Puntos de historia del Product Backlog:** 135 puntos correspondientes a las historias de usuario\
y 6 puntos correspondientes a pruebas integrales, correcciones y validación final.\
**Tiempo ideal estimado:** 56,5 días de trabajo individual, distribuido entre el 1 de abril y el\
28 de septiembre de 2026.

Durante el desarrollo se priorizó el incremento mínimo viable: autenticación, carga del PDF,\
procesamiento RAG y conversación por voz. Posteriormente se incorporaron la persistencia, la\
instrumentación, las métricas y la documentación necesaria para sustentar el resultado técnico.\
Con ese núcleo estable, los sprints 12 y 13 agregaron las funcionalidades de valor diferencial:\
la exposición gradual adaptativa, la retroalimentación en tres dimensiones, el mapa de preparación,\
el registro de predicciones y las evidencias de avance entre sesiones.

***Nota metodológica:** las métricas ICA, PR, LP y RAGAs deben reportarse con datos obtenidos de*\
*sesiones reales o de un conjunto de prueba documentado. Este documento describe la planificación*\
*y el backlog; no reemplaza los resultados experimentales.*

***Nota sobre los umbrales:** los umbrales que gobiernan la regla de adaptación (HU19), los*\
*indicadores conductuales (HU20), la cobertura por tema (HU21) y los márgenes de mejora (HU23) se*\
*fijaron por razonamiento, con la base de datos vacía. Deben recalibrarse con las sesiones piloto y*\
*reportarse en el informe los valores definitivos efectivamente utilizados.*
