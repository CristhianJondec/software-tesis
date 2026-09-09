

**UNIVERSIDAD NACIONAL DE TRUJILLO**

**FACULTAD DE INGENIERÍA**

**ESCUELA ACADÉMICO PROFESIONAL DE INGENIERÍA DE SISTEMAS**

**BREASTAI (ONCOMAMMO): SISTEMA WEB DE APOYO AL DIAGNÓSTICO**  
**DE CÁNCER DE MAMA MEDIANTE INTELIGENCIA ARTIFICIAL**

*METODOLOGÍA SCRUM — PRODUCT BACKLOG, HISTORIAS DE USUARIO Y SPRINTS*

**AUTORES:**

Gil Villa, Alex Fidel

Espinoza Dávalos, Sebastián Alberto

**DOCENTE:**

Mendoza Rivera, Ricardo Darío

**TRUJILLO – PERÚ**

03/09/2026

**INDICE**  
[1\. Product Vision Board	3](#1.-product-vision-board)

[2\. Actores del negocio	3](#2.-actores-del-negocio)

[3\. Roles de Scrum	3](#3.-roles-de-scrum)

[4\. Identificación de procesos	4](#4.-identificación-de-procesos)

[5\. Identificación de requerimientos	4](#5.-identificación-de-requerimientos)

[Requerimientos funcionales	4](#requerimientos-funcionales)

[Requerimientos no funcionales	5](#requerimientos-no-funcionales)

[6\. Historias de usuario	5](#6.-historias-de-usuario)

[7\. Product backlog priorizado	8](#7.-product-backlog-priorizado)

[8\. Estimación del product backlog	9](#8.-estimación-del-product-backlog)

# **1\. Product Vision Board**

El software propuesto es una plataforma web integral de apoyo al diagnóstico de cáncer de mama, dirigida a pacientes, médicos y administradores, que centraliza la gestión de citas, la carga de mamografías y su análisis mediante modelos de Deep Learning (clasificación benigno/maligno y segmentación de lesiones), complementado con recomendaciones clínicas generadas por modelos de lenguaje (Gemini y DeepSeek). El sistema agiliza la reserva de citas, la validación de la calidad de las imágenes cargadas, la generación de diagnósticos con reporte PDF y su envío al paciente, y ofrece paneles analíticos diferenciados por rol para facilitar la toma de decisiones clínicas y administrativas.

*Tabla 1\. Product Vision Board*

| BreastAI  | Usuarios | Necesidades | Producto | Valor |
| ----- | ----- | ----- | ----- | ----- |
| **Plataforma web de apoyo al diagnóstico de cáncer de mama mediante mamografía, IA y modelos de lenguaje** | Pacientes que requieren seguimiento mamográfico. Médicos que atienden y diagnostican. Administradores del sistema de salud. | Reserva y gestión ágil de citas. Carga y validación de mamografías. Análisis automatizado con IA. Recomendaciones clínicas de apoyo. Generación y envío de reportes de diagnóstico. Seguimiento de la evolución del paciente. Visibilidad analítica del uso del sistema. | Módulo de citas con recordatorios automáticos. Módulo de carga y pre-validación de imágenes. Motor de análisis con 3 modelos de clasificación y 3 de segmentación. Generación dual de recomendaciones (Gemini \+ DeepSeek). Generación de diagnóstico con reporte PDF y envío por correo. Dashboards por rol (paciente, doctor, administrador). | Apoyo a la detección temprana del cáncer de mama. Reducción del tiempo de análisis frente al proceso manual. Mejor seguimiento clínico del paciente. Decisiones más informadas para el médico. Trazabilidad y control administrativo del servicio. |

# **2\. Actores del negocio**

*Tabla 2\. Actores del negocio*

| Actor del Negocio | Descripción |
| :---: | ----- |
| **Paciente** | Se registra, reserva citas, carga sus mamografías asociadas a una cita, revisa sus resultados y el histórico de su diagnóstico, y gestiona su perfil. |
| **Doctor** | Administra a sus pacientes vinculados, gestiona su agenda de citas, ejecuta el análisis de IA sobre las mamografías cargadas, genera diagnósticos con reporte PDF y revisa estadísticas de su práctica. |
| **Administrador** | Gestiona usuarios, roles y permisos del sistema, supervisa el estado y desempeño de los modelos de IA, y tiene acceso a estadísticas y reportes globales de la plataforma. |

# **3\. Roles de Scrum**

En la Tabla 3 se presentan los roles de Scrum del equipo.

*Tabla 3\. Roles Scrum*

| Nombres y apellidos | Roles |
| ----- | ----- |
| **Gil Villa, Alex Fidel** | Scrum Master / Developer |
| **Espinoza Dávalos, Sebastián Alberto** | Product Owner / Developer |

*Nota: el reparto de roles Scrum es referencial; ajustar según el acuerdo real del equipo.*

# **4\. Identificación de procesos**

* Gestionar la autenticación, los usuarios, los roles y la seguridad del sistema.  
* Gestionar a los pacientes y su vinculación con los médicos tratantes.  
* Gestionar el proceso de citas médicas, incluyendo recordatorios y control de disponibilidad.  
* Gestionar la carga, validación y análisis de mamografías mediante inteligencia artificial.  
* Gestionar la generación de diagnósticos, reportes clínicos y su envío a los pacientes.  
* Gestionar los dashboards analíticos y las notificaciones del sistema.

# **5\. Identificación de requerimientos**

Se describen a continuación los requerimientos funcionales y no funcionales del sistema.

## **Requerimientos funcionales**

Según los hallazgos de la identificación de procesos, se estableció la siguiente funcionalidad del sistema:

* El sistema debe permitir el registro de usuarios con verificación por correo electrónico y el inicio de sesión mediante credenciales o Google OAuth.  
* El administrador debe poder gestionar usuarios y roles, asignando permisos según el tipo de actor.  
* El sistema debe permitir el registro de pacientes y su vinculación con un médico tratante, mediante un flujo de solicitud, aceptación o rechazo.  
* Los pacientes deben poder reservar citas médicas, respetando reglas de disponibilidad y un límite diario que evite el uso abusivo del servicio.  
* El sistema debe enviar recordatorios automáticos de citas próximas mediante notificaciones push.  
* Los pacientes deben poder cargar mamografías asociadas a una cita, y el sistema debe validar que la imagen corresponda efectivamente a una mamografía antes de procesarla.  
* El sistema debe analizar las mamografías cargadas mediante múltiples modelos de clasificación (benigno/maligno) y de segmentación de lesiones.  
* El sistema debe generar una recomendación clínica de apoyo combinando los resultados de dos modelos de lenguaje (Gemini y DeepSeek).  
* El médico debe poder generar un diagnóstico a partir del análisis realizado, con un reporte en PDF que pueda enviarse por correo al paciente.  
* El sistema debe ofrecer paneles de estadísticas diferenciados para paciente, doctor y administrador.  
* El sistema debe permitir visualizar la evolución del paciente a lo largo de sus controles.  
* El sistema debe proteger el acceso a la información clínica restringiendo cada operación al rol correspondiente (paciente, doctor o administrador).

## **Requerimientos no funcionales**

A continuación se detallan los requisitos no funcionales identificados para el sistema.

*Tabla 4\. Requerimientos no funcionales*

| Requerimiento | Descripción |
| ----- | ----- |
| **Seguridad de datos** | El sistema debe proteger la información clínica de pacientes, diagnósticos e imágenes mediante autenticación JWT, cifrado de contraseñas, control de acceso por rol en cada módulo clínico y restricción del origen de las peticiones (CORS) al dominio de producción. |
| **Rendimiento y escalabilidad** | El análisis de una mamografía (clasificación, segmentación y recomendación clínica) debe completarse en un tiempo acotado y medible, y el sistema debe soportar múltiples solicitudes concurrentes sin degradar el servicio. |
| **Usabilidad** | La interfaz debe ser intuitiva para pacientes y personal médico sin conocimientos técnicos avanzados, debe ser responsive (escritorio y móvil), y su nivel de usabilidad debe validarse mediante el cuestionario System Usability Scale (SUS). |
| **Mantenibilidad** | El sistema debe desarrollarse con arquitectura modular (NestJS/TypeORM/PostgreSQL en el backend, React/Vite en el frontend) que facilite la corrección de errores y la incorporación de nuevas funcionalidades. |
| **Adaptabilidad** | La aplicación debe poder desplegarse en distintos entornos mediante contenedores Docker y variables de entorno, incluyendo el despliegue actual en un VPS mediante Dokploy, y debe permitir incorporar el microservicio de IA como un servicio independiente y desacoplado. |

# **6\. Historias de usuario**

Las historias de usuario se presentan ordenadas por sprint: primero las funcionalidades ya implementadas y en producción (Sprints 1 a 6), y al final las funcionalidades pendientes (Sprints 7 y 8), cerrando con el entrenamiento, evaluación y despliegue del modelo de Deep Learning.

*Tabla 5\. Historias de usuario (verde \= ya implementado, naranja \= pendiente)*

| HU | Nombre |  | Descripción |
| ----- | :---: | :---- | ----- |
| **HU1** |  | Registro con verificación por correo | Permite a un nuevo usuario crear su cuenta y verificarla mediante un código enviado por correo electrónico, con bloqueo temporal ante intentos repetidos. |
| **HU2** |  | Inicio de sesión con email y contraseña | Permite a los usuarios autenticarse mediante credenciales válidas para acceder a las funcionalidades de su rol. |
| **HU3** |  | Inicio de sesión con Google OAuth | Permite a los usuarios autenticarse usando su cuenta de Google, tanto desde la web como desde dispositivos móviles. |
| **HU4** |  | Gestión de perfil de usuario | Permite a cualquier usuario ver y editar sus datos personales y su foto de perfil. |
| **HU5** |  | Registro de push token del dispositivo | Permite asociar el dispositivo del usuario para el envío posterior de notificaciones push. |
| **HU6** |  | Gestión de roles y asignación rol-usuario | Permite crear, editar y asignar roles (Paciente, Doctor, Administrador) a los usuarios del sistema. |
| **HU7** |  | Registro y administración de pacientes | Permite a un doctor o administrador registrar y administrar la información de los pacientes. |
| **HU8** |  | Vinculación médico-paciente | Permite a un paciente solicitar vinculación con un médico, y a este aceptar o rechazar la solicitud. |
| **HU9** |  | Búsqueda de pacientes no vinculados | Permite a un doctor buscar pacientes de la red que aún no tienen médico asignado, para iniciar una vinculación. |
| **HU10** |  | Historial clínico y tendencia del paciente | Muestra el historial de controles del paciente y la tendencia de sus resultados a lo largo del tiempo. |
| **HU11** |  | Reporte PDF de progreso del paciente | Genera un reporte en PDF con la evolución clínica de un paciente, descargable por el doctor o el propio paciente. |
| **HU12** |  | Reporte PDF de estadísticas del doctor | Genera un reporte en PDF con las estadísticas de atención de un doctor (citas, pacientes, diagnósticos). |
| **HU13** |  | Desvinculación y reseteo de asociación | Permite a un administrador desvincular o reiniciar la asociación entre un médico y un paciente. |
| **HU14** |  | Creación de citas médicas | Permite a un doctor, administrador o al propio paciente crear una cita, validando disponibilidad de horario. |
| **HU15** |  | Regla anti-spam en reserva de citas | Limita a un paciente a un máximo de citas por día, aplicando un bloqueo temporal ante el abuso de la reserva. |
| **HU16** |  | Detección de conflictos de horario | Evita la doble reserva de un mismo horario para un doctor o un paciente. |
| **HU17** |  | Bolsa de citas y horarios ocupados | Muestra las citas aún no asignadas a un doctor y consulta los horarios ya ocupados de una agenda. |
| **HU18** |  | Edición de observación de la cita | Permite al paciente editar la observación de su cita mientras esta se encuentre en estado Pendiente. |
| **HU19** |  | Aceptación de cita por el doctor | Permite a un doctor aceptar una cita de la bolsa, activando o creando el vínculo con el paciente. |
| **HU20** |  | Recordatorios automáticos de citas | Envía notificaciones push automáticas 24 horas y 2 horas antes de una cita programada. |
| **HU21** |  | Resumen diario de citas para doctores | Envía a cada doctor un resumen automático de sus citas del día. |
| **HU22** |  | Carga clínica de mamografía | Permite al paciente cargar la imagen de su mamografía asociada a una cita específica. |
| **HU23** |  | Pre-validación de autenticidad de la imagen | Valida mediante IA (Gemini Vision) que la imagen cargada corresponda efectivamente a una mamografía antes de aceptarla. |
| **HU24** |  | Análisis de clasificación con modelos de IA | Analiza la mamografía cargada con tres modelos de clasificación (benigno/maligno) en paralelo. |
| **HU25** |  | Análisis de segmentación de lesiones | Analiza la mamografía cargada con tres modelos de segmentación para localizar posibles lesiones. |
| **HU26** |  | Recomendación clínica con doble LLM | Genera una recomendación clínica de apoyo combinando los resultados de Gemini y DeepSeek en paralelo. |
| **HU27** |  | Consulta de salud y modelos del servicio ML | Permite verificar el estado y los modelos disponibles del servicio de inteligencia artificial. |
| **HU28** |  | Creación de diagnóstico | Permite al doctor generar un diagnóstico a partir del análisis de una mamografía, actualizando el estado de la cita. |
| **HU29** |  | Reporte PDF de diagnóstico | Genera un reporte clínico completo en PDF con los resultados del análisis y la recomendación generada. |
| **HU30** |  | Envío de diagnóstico por correo | Envía automáticamente el reporte de diagnóstico en PDF al correo del paciente. |
| **HU31** |  | Notificación push al doctor | Notifica al doctor mediante push cuando se genera un nuevo diagnóstico. |
| **HU32** |  | Almacenamiento en la nube de imágenes y documentos | Almacena de forma centralizada las mamografías y los reportes PDF generados en almacenamiento en la nube. |
| **HU33** |  | Dashboard de administrador | Muestra estadísticas globales del sistema: usuarios por rol, registros por mes y uso de los modelos de IA. |
| **HU34** |  | Dashboard de doctor | Muestra estadísticas del doctor: citas, pacientes, solicitudes pendientes y diagnósticos por mes. |
| **HU35** |  | Dashboard de paciente | Muestra la evolución del paciente: tendencia de resultados y distribución de sus controles. |
| **HU36** |  | Navegación y control de acceso por rol | Presenta la navegación y las pantallas correspondientes a cada rol, restringiendo el acceso a rutas no autorizadas. |
| **HU37** |  | Despliegue del sistema en producción | Publica el backend y el frontend en contenedores Docker sobre un VPS, con inyección de variables de entorno en tiempo de ejecución. |
| **HU38** |  | Control de acceso por rol en módulos clínicos | Restringe la creación, listado y edición de diagnósticos, radiografías y roles únicamente a los roles autorizados. |
| **HU39** |  | Restricción de CORS en producción | Limita el origen de las peticiones aceptadas por el backend al dominio real del frontend en producción. |
| **HU40** |  | Límite de peticiones en endpoints de IA | Aplica un límite de tasa (rate limiting) a los endpoints que consumen servicios de IA de pago, evitando abuso de costos. |
| **HU41** |  | Validación de identidad en foto de perfil | Restaura la validación por IA de que la foto de perfil corresponde efectivamente a una persona, actualmente desactivada. |
| **HU42** |  | Página de error 404 y manejo de errores | Muestra una pantalla adecuada ante rutas no encontradas y captura errores inesperados de la interfaz. |
| **HU43** |  | Medición del tiempo de análisis | Registra y muestra el tiempo que toma el análisis de una mamografía, para compararlo contra el proceso manual. |
| **HU44** |  | Visualización de mapas de calor (Grad-CAM) | Muestra sobre la mamografía un mapa de calor que resalta las zonas que más influyeron en la predicción del modelo de clasificación. |
| **HU45** |  | Cuestionario de usabilidad SUS | Aplica el cuestionario System Usability Scale a una muestra de 20 usuarios y calcula el puntaje de satisfacción del sistema. |
| **HU46** |  | Entrenamiento y evaluación del modelo con matriz de confusión | Entrena el modelo de Deep Learning para la clasificación y evalúa su precisión mediante la matriz de confusión y métricas derivadas. |
| **HU47** |  | Análisis de generalización del modelo | Compara la exactitud de entrenamiento y de prueba del modelo para analizar su capacidad de generalización. |
| **HU48** |  | Despliegue del modelo como microservicio de IA | Publica el modelo entrenado como un servicio independiente, consumido por el backend a través de ML\_SERVICE\_URL. |

# **7\. Product backlog priorizado**

*Tabla 6\. Product backlog priorizado*

| Historia de usuario | Descripción | Prioridad |
| :---: | ----- | :---: |
| **HU1** | Registro con verificación por correo | 1 |
| **HU2** | Inicio de sesión con email y contraseña | 1 |
| **HU3** | Inicio de sesión con Google OAuth | 1 |
| **HU4** | Gestión de perfil de usuario | 1 |
| **HU5** | Registro de push token del dispositivo | 2 |
| **HU6** | Gestión de roles y asignación rol-usuario | 1 |
| **HU7** | Registro y administración de pacientes | 1 |
| **HU8** | Vinculación médico-paciente | 1 |
| **HU9** | Búsqueda de pacientes no vinculados | 2 |
| **HU10** | Historial clínico y tendencia del paciente | 1 |
| **HU11** | Reporte PDF de progreso del paciente | 2 |
| **HU12** | Reporte PDF de estadísticas del doctor | 2 |
| **HU13** | Desvinculación y reseteo de asociación | 3 |
| **HU14** | Creación de citas médicas | 1 |
| **HU15** | Regla anti-spam en reserva de citas | 1 |
| **HU16** | Detección de conflictos de horario | 1 |
| **HU17** | Bolsa de citas y horarios ocupados | 2 |
| **HU18** | Edición de observación de la cita | 3 |
| **HU19** | Aceptación de cita por el doctor | 1 |
| **HU20** | Recordatorios automáticos de citas | 2 |
| **HU21** | Resumen diario de citas para doctores | 3 |
| **HU22** | Carga clínica de mamografía | 1 |
| **HU23** | Pre-validación de autenticidad de la imagen | 1 |
| **HU24** | Análisis de clasificación con modelos de IA | 1 |
| **HU25** | Análisis de segmentación de lesiones | 1 |
| **HU26** | Recomendación clínica con doble LLM | 1 |
| **HU27** | Consulta de salud y modelos del servicio ML | 3 |
| **HU28** | Creación de diagnóstico | 1 |
| **HU29** | Reporte PDF de diagnóstico | 1 |
| **HU30** | Envío de diagnóstico por correo | 2 |
| **HU31** | Notificación push al doctor | 2 |
| **HU32** | Almacenamiento en la nube de imágenes y documentos | 1 |
| **HU33** | Dashboard de administrador | 2 |
| **HU34** | Dashboard de doctor | 2 |
| **HU35** | Dashboard de paciente | 2 |
| **HU36** | Navegación y control de acceso por rol | 1 |
| **HU37** | Despliegue del sistema en producción | 1 |
| **HU38** | Control de acceso por rol en módulos clínicos | 1 |
| **HU39** | Restricción de CORS en producción | 1 |
| **HU40** | Límite de peticiones en endpoints de IA | 2 |
| **HU41** | Validación de identidad en foto de perfil | 2 |
| **HU42** | Página de error 404 y manejo de errores | 3 |
| **HU43** | Medición del tiempo de análisis | 1 |
| **HU44** | Visualización de mapas de calor (Grad-CAM) | 1 |
| **HU45** | Cuestionario de usabilidad SUS | 1 |
| **HU46** | Entrenamiento y evaluación del modelo con matriz de confusión | 1 |
| **HU47** | Análisis de generalización del modelo | 1 |
| **HU48** | Despliegue del modelo como microservicio de IA | 1 |

# **8\. Estimación del product backlog**

En las tablas 7 y 8 se presenta la estimación del product backlog.

*Tabla 7\. Asignación de puntos de historia*

| Tamaño | Puntos | Tiempo \[Días\] |
| :---: | :---: | :---: |
| **XtraSmall (XS)** | 1 | 0.5 |
| **Small (S)** | 2 | 1 |
| **Medium (M)** | 3 | 1.5 |
| **Large (L)** | 5 | 2 |
| **XtraLarge (XL)** | 8 | 3 |
| **XtraXtraLarge (XXL)** | 13 | 5 |

*Tabla 8\. Estimación del product backlog por sprint (verde \= completado, naranja \= pendiente, gris \= subtotal)*

| Sprint | HU | Descripción | Tamaño | Puntos de Historia | Tiempo \[Días\] |
| ----- | ----- | ----- | :---: | :---: | :---: |
| **Primer sprint(Autenticación, Roles y Usuarios)** | HU1 | Registro con verificación por correo | M | 3 | 1.5 |
|  | HU2 | Inicio de sesión con email y contraseña | S | 2 | 1 |
|  | HU3 | Inicio de sesión con Google OAuth | M | 3 | 1.5 |
|  | HU4 | Gestión de perfil de usuario | S | 2 | 1 |
|  | HU5 | Registro de push token del dispositivo | XS | 1 | 0.5 |
|  | HU6 | Gestión de roles y asignación rol-usuario | M | 3 | 1.5 |
| **Subtotal Primer sprint** |  |  |  | 14 | 7.0 |
| **Segundo sprint(Pacientes y Vinculación Médico-Paciente)** | HU7 | Registro y administración de pacientes | L | 5 | 2 |
|  | HU8 | Vinculación médico-paciente | L | 5 | 2 |
|  | HU9 | Búsqueda de pacientes no vinculados | M | 3 | 1.5 |
|  | HU10 | Historial clínico y tendencia del paciente | M | 3 | 1.5 |
|  | HU11 | Reporte PDF de progreso del paciente | M | 3 | 1.5 |
|  | HU12 | Reporte PDF de estadísticas del doctor | S | 2 | 1 |
|  | HU13 | Desvinculación y reseteo de asociación | S | 2 | 1 |
| **Subtotal Segundo sprint** |  |  |  | 23 | 10.5 |
| **Tercer sprint(Gestión de Citas Médicas)** | HU14 | Creación de citas médicas | L | 5 | 2 |
|  | HU15 | Regla anti-spam en reserva de citas | M | 3 | 1.5 |
|  | HU16 | Detección de conflictos de horario | M | 3 | 1.5 |
|  | HU17 | Bolsa de citas y horarios ocupados | S | 2 | 1 |
|  | HU18 | Edición de observación de la cita | XS | 1 | 0.5 |
|  | HU19 | Aceptación de cita por el doctor | S | 2 | 1 |
|  | HU20 | Recordatorios automáticos de citas | M | 3 | 1.5 |
|  | HU21 | Resumen diario de citas para doctores | S | 2 | 1 |
| **Subtotal Tercer sprint** |  |  |  | 21 | 10.0 |
| **Cuarto sprint(Carga y Análisis de Mamografías con IA)** | HU22 | Carga clínica de mamografía | M | 3 | 1.5 |
|  | HU23 | Pre-validación de autenticidad de la imagen | M | 3 | 1.5 |
|  | HU24 | Análisis de clasificación con modelos de IA | L | 5 | 2 |
|  | HU25 | Análisis de segmentación de lesiones | L | 5 | 2 |
|  | HU26 | Recomendación clínica con doble LLM | L | 5 | 2 |
|  | HU27 | Consulta de salud y modelos del servicio ML | XS | 1 | 0.5 |
| **Subtotal Cuarto sprint** |  |  |  | 22 | 9.5 |
| **Quinto sprint(Diagnósticos, Reportes y Notificaciones)** | HU28 | Creación de diagnóstico | M | 3 | 1.5 |
|  | HU29 | Reporte PDF de diagnóstico | L | 5 | 2 |
|  | HU30 | Envío de diagnóstico por correo | S | 2 | 1 |
|  | HU31 | Notificación push al doctor | XS | 1 | 0.5 |
|  | HU32 | Almacenamiento en la nube de imágenes y documentos | M | 3 | 1.5 |
| **Subtotal Quinto sprint** |  |  |  | 14 | 6.5 |
| **Sexto sprint(Dashboards, Frontend y Despliegue)** | HU33 | Dashboard de administrador | M | 3 | 1.5 |
|  | HU34 | Dashboard de doctor | M | 3 | 1.5 |
|  | HU35 | Dashboard de paciente | M | 3 | 1.5 |
|  | HU36 | Navegación y control de acceso por rol | L | 5 | 2 |
|  | HU37 | Despliegue del sistema en producción | M | 3 | 1.5 |
| **Subtotal Sexto sprint** |  |  |  | 17 | 8.0 |
| **Séptimo sprint(Seguridad y Calidad (pendiente))** | HU38 | Control de acceso por rol en módulos clínicos | M | 3 | 1.5 |
|  | HU39 | Restricción de CORS en producción | XS | 1 | 0.5 |
|  | HU40 | Límite de peticiones en endpoints de IA | S | 2 | 1 |
|  | HU41 | Validación de identidad en foto de perfil | S | 2 | 1 |
|  | HU42 | Página de error 404 y manejo de errores | XS | 1 | 0.5 |
| **Subtotal Séptimo sprint** |  |  |  | 9 | 4.5 |
| **Octavo sprint(Evaluación del Sistema y Modelo de IA (pendiente))** | HU43 | Medición del tiempo de análisis | S | 2 | 1 |
|  | HU44 | Visualización de mapas de calor (Grad-CAM) | L | 5 | 2 |
|  | HU45 | Cuestionario de usabilidad SUS | M | 3 | 1.5 |
|  | HU46 | Entrenamiento y evaluación del modelo con matriz de confusión | XXL | 13 | 5 |
|  | HU47 | Análisis de generalización del modelo | M | 3 | 1.5 |
|  | HU48 | Despliegue del modelo como microservicio de IA | XL | 8 | 3 |
| **Subtotal Octavo sprint** |  |  |  | 34 | 14.0 |
| **TOTAL GENERAL** |  |  |  | 154 | 70.0 |

**Puntos de historia totales: 154 | Tiempo estimado total (Time Boxing): 70.0 días**

De este total, 51.5 días corresponden a funcionalidad ya implementada y desplegada en producción (Sprints 1 a 6), y 18.5 días corresponden al trabajo pendiente (Sprints 7 y 8), el cual cierra con el entrenamiento, evaluación y despliegue del modelo de Deep Learning.