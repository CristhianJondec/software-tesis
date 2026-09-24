# Guía de flujos de prueba — las tres cuentas

Recorrido manual para ver funcionar **todas** las funcionalidades de Investfied con tres
usuarios: **Admin (investigador)**, **Estudiante experimental** y **Estudiante control**.
Cada paso dice qué hacer y qué deberías ver. Marca `[x]` a medida que avanzas.

---

## 0. Preparación (una sola vez)

### Cuentas

| Rol | Correo sugerido | Cómo obtiene su rol |
|---|---|---|
| Admin / investigador | el correo de `ADMIN_EMAIL` (y también en `METRICS_OWNER_EMAILS`) | Por variable de entorno. No necesita grupo. |
| Experimental | `exp1@prueba.com` | El admin le asigna **Experimental** en `/admin` |
| Control | `ctrl1@prueba.com` | El admin le asigna **Control** en `/admin` |

- `ADMIN_EMAIL` abre `/admin`. `METRICS_OWNER_EMAILS` abre `/metrics` y `/metrics/revision`.
  Si quieres que una sola cuenta vea las dos cosas, pon el mismo correo en ambas variables.
- Usa **tres navegadores o ventanas de incógnito distintas** para tener las tres sesiones
  abiertas a la vez sin cerrar sesión cada vez.

### Material que necesitas

- [ ] Un PDF de avance de investigación **con texto seleccionable** (no escaneado), idealmente
      con secciones reconocibles: problema, objetivos, metodología, muestra, instrumentos, etc.
- [ ] Un segundo PDF cualquiera (para probar materiales del admin).
- [ ] Opcional: una imagen JPG/PNG/WEBP para portada.
- [ ] Micrófono y parlantes funcionando; conexión estable.
- [ ] `npm run dev` corriendo y la base migrada (`npm run db:migrate`).

---

## Flujo 1 — Registro y cuenta "sin asignar" (las dos cuentas de estudiante)

1. [ ] En la ventana del experimental, ve a `/sign-up` y regístrate con `exp1@prueba.com`.
2. [ ] **Esperado:** te lleva a `/sin-asignar` → "Tu cuenta está en revisión", con tu correo.
       No aparece ningún enlace de Biblioteca, Materiales ni Encuestas en la barra.
3. [ ] Intenta entrar a mano a `/`, `/books/new`, `/surveys`, `/materiales`, `/history`.
       **Esperado:** todas redirigen a `/sin-asignar`.
4. [ ] Repite el registro en la ventana del control con `ctrl1@prueba.com`. Mismo resultado.
5. [ ] Cierra sesión desde el menú del avatar (arriba a la derecha) y vuelve a entrar por
       `/sign-in`. **Esperado:** sigue en `/sin-asignar`.

---

## Flujos del ADMIN (investigador)

### A1 — Acceso al panel

1. [ ] Regístrate / inicia sesión con el correo de `ADMIN_EMAIL`.
2. [ ] Abre el menú del avatar. **Esperado:** ves *Historial*, *Mapa de preparación*,
       *Mi progreso*, *Métricas y revisión PR* y *Usuarios y encuestas*.
       (El investigador salta el control de grupos: ve todo sin tener grupo.)
3. [ ] Entra a **Usuarios y encuestas** (`/admin`).
4. [ ] **Esperado:** tarjetas con *Usuarios registrados*, *Instrumentos completados*,
       *Usuarios con flujo completo*, y la fila *Grupo experimental / Grupo control /
       Sin asignar (sin acceso)*. Los dos estudiantes aparecen como **Sin asignar**.

### A2 — Asignar grupos

1. [ ] En la tabla *Resumen para análisis*, columna **Grupo**, elige **Experimental** para
       `exp1@prueba.com` y **Control** para `ctrl1@prueba.com`.
2. [ ] **Esperado:** toast de confirmación y los contadores de grupos se actualizan.
3. [ ] Recarga las ventanas de los estudiantes:
   - Experimental → pasa a la **Biblioteca** (`/`).
   - Control → pasa a **Materiales** (`/materiales`).
4. [ ] Prueba en caliente: cambia al experimental a *Sin asignar* y recarga su ventana →
       vuelve a `/sin-asignar`. Devuélvelo a *Experimental* antes de seguir.

> Nota: el *código de participante* (columna "Sin código") no tiene todavía un control en la
> UI; existe la acción `setParticipantCode` pero no está conectada a ninguna pantalla.

### A3 — Materiales compartidos

1. [ ] En `/admin`, sección **Materiales compartidos**, prueba primero los errores:
   - Publicar sin archivo → "Elige un archivo PDF."
   - Subir una imagen → "El archivo debe ser un PDF."
   - Subir PDF sin título → "Escribe un título para el material."
2. [ ] Sube un PDF con **Título** y **Descripción (opcional)**. **Esperado:** "Material publicado."
3. [ ] Comprueba que aparece en la lista del panel.
4. [ ] (Se verifica desde las cuentas de estudiante en E-Materiales y C1.)
5. [ ] Al final de todas las pruebas, elimina un material y confirma "Material eliminado." y que
       desaparece también de `/materiales` de los estudiantes.

### A4 — Seguimiento de encuestas (después de que los estudiantes respondan)

1. [ ] En `/admin`, revisa la tabla: **AE T1, AE T2, Δ AE, AC T1, AC T2, Δ AC, SUS** y los
       iconos de etapas.
2. [ ] Para el control, la etapa SUS debe verse como **No aplica**.
3. [ ] Abre **Detalle por usuario → Ver respuestas y fechas** y despliega un instrumento:
       ves cada pregunta con su **respuesta cruda** y el puntaje calculado.
4. [ ] Pulsa el botón de **exportar CSV** del encabezado. **Esperado:** se descarga
       `encuestas-resumen-AAAA-MM-DD.csv` (UTF-8, ábrelo en Excel/SPSS para verificar tildes).

### A5 — Métricas de la investigación (`/metrics`)

Hazlo **después** de que el experimental haya tenido al menos una sesión de voz.

1. [ ] Menú → **Métricas y revisión PR**.
2. [ ] **ICA**: porcentaje con `Ci = 5 · Ct = 5` y la tabla de componentes
       (STT, LLM, base vectorial, retriever, TTS) con su evidencia.
3. [ ] **LP — Latencia Promedio del sistema**: media, mediana, mínimo, máximo, p95 y `n`.
4. [ ] **Latencia de respuesta verbal del estudiante**: mismas estadísticas, reportadas aparte.
5. [ ] **PR — Precisión de Respuestas**: correctas, incorrectas, pendientes de revisión.
       (Se llena con A6.)
6. [ ] **Exposición gradual adaptativa**: por sesión, nivel, origen (auto/manual) y
       autoevaluaciones previa y posterior. Una autoevaluación sin responder sale vacía, no 0.
7. [ ] **Retroalimentación en tres dimensiones**: promedios de contenido y claridad por sesión.
8. [ ] **RAGAs**: pulsa **Calcular ternas pendientes (N)**. **Esperado:** toast con las ternas
       evaluadas; aparecen fidelidad, pertinencia, precisión y cobertura del contexto.
       Vuelve a pulsar → "No quedan ternas pendientes."
9. [ ] Prueba **Borrar puntajes y recalcular desde cero** → "Puntajes borrados." y luego vuelve a
       calcular.
10. [ ] **Exportación**: descarga los tres CSV → `metricas-sesiones.csv`,
        `metricas-participantes.csv`, `metricas-turnos.csv`.

### A6 — Revisión humana de respuestas (PR) (`/metrics/revision`)

1. [ ] Desde `/metrics` entra a la revisión.
2. [ ] Filtros **Pendientes / Revisados / Todos**.
3. [ ] En cada turno ves: sesión, turno, latencia del sistema, lo que dijo el estudiante y la
       respuesta del agente (con los fragmentos recuperados).
4. [ ] Marca varios como **Correcta** y al menos uno como **Incorrecta** con una **Nota**.
5. [ ] Quita una evaluación y confirma que vuelve a *Pendientes*.
6. [ ] Vuelve a `/metrics` → el PR ya muestra `Rc / Rt` con porcentaje.

### A7 — El admin como usuario de la intervención (opcional)

El investigador puede usar la biblioteca, subir investigaciones y hacer sesiones de voz igual
que un experimental. Útil para una prueba de humo antes de pedírselo a un estudiante.

### A8 — Accesos negativos del admin

1. [ ] Con la cuenta experimental, abre `/admin` → "No tienes permiso para acceder al panel de
       administración."
2. [ ] Con la cuenta experimental, abre `/metrics` → "Esta sección es solo para el responsable
       de la investigación."

---

## Flujos del ESTUDIANTE EXPERIMENTAL

### E1 — Primer ingreso y navegación

1. [ ] Inicia sesión con `exp1@prueba.com`. **Esperado:** aterriza en la **Biblioteca** (`/`).
2. [ ] Barra: *Biblioteca*, *Agregar*, *Materiales*, *Encuestas*.
3. [ ] Menú del avatar: *Historial*, *Mapa de preparación*, *Mi progreso*, *Cerrar sesión*.
       **No** debe ver *Métricas* ni *Usuarios y encuestas*.

### E2 — Encuestas basales (T1)

1. [ ] Ve a **Encuestas** (`/surveys`). Ves 5 etapas: STAI T1, PRCS-12 T1, SUS, STAI T2,
       PRCS-12 T2, y la barra de *Progreso general*.
2. [ ] **Esperado:** STAI T1 y PRCS-12 T1 **Disponibles**; SUS con el aviso "Completa las dos
       mediciones basales…"; T2 **Pendientes**.
3. [ ] Intenta abrir a mano `/surveys/sus` → "Etapa no disponible" con el motivo.
4. [ ] Responde **PRCS-12 T1** primero (las dos basales admiten cualquier orden) y luego
       **STAI T1**.
5. [ ] **Esperado:** ambas quedan **Completadas** con fecha. SUS ahora dice "Realiza al menos
       una conversación con el agente…".
6. [ ] Intenta reabrir `/surveys/stai-t1` → "Esta etapa ya fue enviada y no admite
       modificaciones."

### E3 — Materiales

1. [ ] Ve a **Materiales**. Ves la introducción, **Documentos** (el PDF que subió el admin, con
       tamaño), **Las doce secciones que evalúa el jurado** (con "El jurado presiona en…" y
       preguntas típicas) y **Recomendaciones**.
2. [ ] Descarga el PDF del admin. **Esperado:** se abre en otra pestaña.

### E4 — Subir la investigación (ingesta RAG)

1. [ ] Pulsa **Agregar** (`/books/new`).
2. [ ] Errores de validación: envía vacío; sube un archivo que no sea PDF; sube una portada no
       válida. Deben mostrarse los mensajes del formulario.
3. [ ] Sube tu PDF con **título** y **autor**. Deja la portada vacía (se genera de la primera
       página) — o súbela, para probar esa rama.
4. [ ] **Esperado:** overlay de carga → redirige a `/books/<slug>` con la pantalla previa a la
       sesión. En la Biblioteca aparece la tarjeta con su portada.
5. [ ] **Duplicado:** vuelve a subir con el **mismo título**. **Esperado:** "Ya existe una
       investigación con el mismo título." y te lleva a la existente.
6. [ ] **Límite (opcional):** sube hasta 4 investigaciones; la quinta debe decir "Alcanzaste tu
       límite de 4 investigaciones."
7. [ ] **Búsqueda:** en la Biblioteca, escribe parte del título en el buscador y verifica el
       filtrado.

### E5 — Primera sesión de voz (flujo completo STT → RAG → LLM → TTS)

**Pantalla previa (`SessionSetup`):**

1. [ ] Abre tu investigación. Ves la escala **"Del 0 al 10, ¿qué tan nervioso te sientes
       ahora mismo por sustentar?"**.
2. [ ] Sin tocar la escala, lee el aviso "Puedes empezar sin responder la escala…".
3. [ ] Marca **7**. **Esperado:** "Nivel sugerido: …" con la razón ("Es tu primera sesión…").
       Marca **2** y comprueba que la sugerencia cambia (con ansiedad baja sugiere *Práctica
       guiada*).
4. [ ] Revisa los 4 niveles: *Ensayo seguro, Práctica guiada, Simulación realista,
       Simulación desafiante*, cada uno con nº de preguntas, límite de tiempo y si reformula.
5. [ ] **Sobrescritura:** elige un nivel distinto al sugerido. **Esperado:** "Elegiste un nivel
       distinto al sugerido. Queda registrado así en tu sesión." (Para esta primera sesión,
       te recomiendo quedarte en el sugerido y probar la sobrescritura en E8.)
6. [ ] **Predicción (opcional):** llena las tres preguntas: *¿Qué crees que te van a preguntar?*,
       *¿Qué parte te da más temor?*, *¿Qué crees que pasaría si no recuerdas una respuesta?*
7. [ ] Pulsa **Iniciar <nivel>** y concede permiso al micrófono.

**Durante la llamada:**

8. [ ] El agente abre con el **primer mensaje del nivel** (p. ej. "Vamos a ensayar juntos su
       sustentación sobre …").
9. [ ] Responde en voz alta. **Esperado:** la **transcripción en vivo** muestra tu texto y el
       del agente; el indicador cambia entre hablando / escuchando.
10. [ ] Verifica el **anclaje RAG**: el agente pregunta por cosas concretas de *tu* documento
        (metodología, muestra, etc.), no genéricas.
11. [ ] Deja un **silencio largo** (8–10 s) antes de responder una pregunta y, en otra, pide
        "¿me puede reformular la pregunta?". Esto alimenta las señales de adaptación.
12. [ ] Prueba **Silenciar micrófono** / **Activar micrófono**.
13. [ ] Observa el contador de duración (tope 60 min).
14. [ ] Pulsa **Finalizar conversación**. **Esperado:** el agente dice un **cierre hablado**
        con evidencia concreta (en la primera sesión dirá lo que se pudo medir).

**Encuesta de cierre (`PostSessionSurvey`):**

15. [ ] Aparece "Terminaste la sesión". Marca la ansiedad **posterior** (0–10) y escribe qué
        vas a hacer distinto la próxima vez.
16. [ ] Pulsa **Guardar respuestas** → "Respuesta registrada. Gracias."
        (Prueba también, en otra sesión, **Prefiero no responder**.)
17. [ ] Pulsa **Ver el informe de esta sesión**.

### E6 — Informe y detalle de la sesión (`/history/<id>`)

1. [ ] **Informe de la sesión / Retroalimentación en tres dimensiones**: pulsa el botón de
       evaluar. **Esperado:** toast "N respuestas evaluadas… Quedan M." Aparecen *contenido* y
       *claridad* con nivel y **cita del documento**, y la *conducta comunicativa* como hechos
       (latencias, silencios), sin nota global. Vuelve a pulsar → "No quedan respuestas
       pendientes de evaluar." Abre **Detalle por pregunta**.
2. [ ] **Predicción y resultado**: lo que escribiste antes vs. lo que quedó registrado.
3. [ ] **Evidencias de avance**: en la primera sesión habrá pocas o ninguna comparación.
4. [ ] **Exposición gradual**: nivel, *Quién eligió el nivel*, autoevaluación previa y posterior,
       silencios largos, respuestas incompletas, pedidos de reformulación, turnos del estudiante.
5. [ ] **Rendimiento de la sesión**: latencias medidas (sistema y estudiante).
6. [ ] **Evaluación de respuestas / RAGAs**: si el admin ya calculó RAGAs, aparecen los puntajes;
       si no, se ven como pendientes (no como cero).
7. [ ] **Recuperaciones del documento**: consultas que hizo el agente a `searchBook` y los
       fragmentos devueltos con su distancia.
8. [ ] **Conversación**: transcripción completa, solo lectura.
9. [ ] **Datos técnicos de Vapi**: estado, motivo de finalización, duración, costo, tokens.

### E7 — Historial

1. [ ] Menú → **Historial**. Tarjetas con portada, fecha, duración, nº de mensajes, nivel y
       "Autoevaluación X → Y".
2. [ ] Desde el mapa o el progreso, entra al historial filtrado de una investigación
       (`/history?bookId=…`) y usa "Ver historial general".

### E8 — Mapa de preparación y sesión enfocada

1. [ ] Menú → **Mapa de preparación**. Si tienes varias investigaciones, elige una.
2. [ ] Pulsa el botón de **analizar el documento**. **Esperado:** "Documento analizado: X temas
       cubiertos y Y huecos."
3. [ ] Revisa los 12 temas agrupados en los **4 estados**: *Domina*, *Parcial*, *No practicado*,
       *Hueco en el documento*. Cada tema muestra preguntas recibidas, respuestas dadas, nivel
       medio y enlaces a las sesiones donde salió.
4. [ ] Selecciona temas para practicar. Intenta marcar un **5.º** → "Puedes enfocar hasta 4
       temas en una sesión."
5. [ ] Pulsa **Practicar solo estos temas**. **Esperado:** va a `/books/<slug>?focus=…` y la
       pantalla previa muestra "Sesión enfocada. El jurado te preguntará solo sobre …".

### E9 — Segunda sesión (adaptación + estrategia + evidencias)

1. [ ] En la sesión enfocada (o una normal), la pantalla previa ahora muestra:
   - "Al terminar tu sesión anterior escribiste que ibas a probar esto: …"
   - "Tu sesión anterior con esta investigación fue el …"
   - Una sugerencia de nivel **basada en la sesión anterior** (sube, baja o se mantiene como
     máximo un paso). Prueba ansiedad **9** → debe bajar; ansiedad **2** → puede subir.
2. [ ] Esta vez **sobrescribe** el nivel sugerido (p. ej. elige *Simulación realista*) y verifica
       que el agente se comporta distinto (tono formal, repreguntas, control de tiempo).
3. [ ] Haz la sesión, finaliza y escucha el **cierre hablado**: ahora debe citar avances con
       números respecto a la sesión anterior.
4. [ ] Responde la encuesta de cierre.
5. [ ] En el informe, **Evidencias de avance** ya compara con la sesión 1.
6. [ ] Vuelve al **Mapa de preparación** → sección *Cómo cambió tu mapa*.

### E10 — Mi progreso

1. [ ] Menú → **Mi progreso** → elige la investigación.
2. [ ] **Esperado:** "Lo que lograste en tu última sesión", gráficos por sesión (latencia,
       niveles de rúbrica, autoevaluación 0–10) y la lista de evidencias.
3. [ ] Comprueba que **no** aparecen puntajes STAI ni PRCS-12 (están ocultos a propósito para
       no contaminar T2).
4. [ ] Con una investigación sin sesiones → "Todavía no hay sesiones que comparar" y botón
       *Practicar ahora*.

### E11 — Encuestas de cierre (SUS y T2)

1. [ ] Vuelve a **Encuestas**. SUS ya está **Disponible** → respóndela.
2. [ ] Se desbloquea **STAI T2** → respóndela. Luego **PRCS-12 T2**.
3. [ ] **Esperado:** progreso 5 de 5 · 100 %. En `/admin` el experimental cuenta como
       *Usuario con flujo completo* y aparecen sus Δ AE y Δ AC.

### E12 — Eliminar una investigación

1. [ ] En la Biblioteca, pulsa el icono de eliminar de una investigación **de prueba** (no la
       principal).
2. [ ] **Esperado:** confirmación "¿Eliminar … ? También se eliminarán sus sesiones e
       historial." → desaparece de la Biblioteca, del historial, del mapa y del progreso.

---

## Flujos del ESTUDIANTE CONTROL

### C1 — Ingreso y materiales

1. [ ] Inicia sesión con `ctrl1@prueba.com`. **Esperado:** aterriza en **Materiales**.
2. [ ] Barra: solo **Materiales** y **Encuestas**. Sin *Biblioteca* ni *Agregar*.
3. [ ] Menú del avatar: solo *Cerrar sesión* (sin Historial, Mapa ni Progreso).
4. [ ] El logo lleva a `/materiales`, no a la Biblioteca.
5. [ ] Lee la guía y descarga el PDF publicado por el admin.

### C2 — Encuestas del control

1. [ ] Ve a **Encuestas**. **Esperado:** la etapa **SUS** aparece como **No aplica** y el
       total es 4 etapas, no 5.
2. [ ] Responde **STAI T1** y **PRCS-12 T1**.
3. [ ] **Esperado:** **STAI T2** se desbloquea directamente (sin SUS y sin necesitar
       conversación). Respóndela; luego **PRCS-12 T2**.
4. [ ] Abre `/surveys/sus` a mano → "Esta etapa no corresponde a tu grupo de estudio."
5. [ ] En `/admin`, el control aparece con SUS "No aplica" y flujo completo.

### C3 — Bloqueo de la intervención (lo más importante del diseño experimental)

Con la cuenta control, escribe a mano cada URL. **Todas deben redirigir a `/materiales`**:

- [ ] `/`
- [ ] `/books/new`
- [ ] `/books/<slug-de-una-investigación-del-experimental>`
- [ ] `/history` y `/history/<id-de-una-sesión>`
- [ ] `/preparacion`
- [ ] `/progreso`

Y estas deben mostrar el mensaje de acceso denegado:

- [ ] `/admin` → "No tienes permiso…"
- [ ] `/metrics` → "Esta sección es solo para el responsable de la investigación."

---

## Pruebas cruzadas finales

- [ ] **Aislamiento de datos:** el experimental no puede abrir `/history/<id>` de una sesión de
      otra cuenta (ni del admin).
- [ ] **Cambio de grupo:** el admin pasa al control a *Experimental* → el control ahora ve la
      Biblioteca. Devuélvelo a *Control*.
- [ ] **Sin sesión:** cerrado sesión, abre `/history`, `/surveys`, `/admin` → redirige a
      `/sign-in`. La landing `/` sí se ve (pantalla pública).
- [ ] **`/subscriptions`** → redirige (la facturación está fuera del flujo).

---

## Qué evidencia de la investigación queda demostrada

| Requisito | Dónde lo compruebas |
|---|---|
| ICA (5 componentes) | A5 paso 2 |
| Flujo STT → RAG → LLM → TTS, síncrono y repetido | E5 pasos 8–14, E6 paso 7 |
| PR | A6 + A5 paso 5 |
| LP | A5 paso 3, E6 paso 5 |
| Latencia verbal del estudiante | A5 paso 4, E6 paso 5 |
| RAGAs | A5 paso 8, E6 paso 6 |
| Exposición gradual adaptativa | E5 pasos 1–5, E9 paso 1–2, A5 paso 6 |
| Retroalimentación en 3 dimensiones | E6 paso 1, A5 paso 7 |
| Predicción vs. realidad | E5 paso 6, E6 paso 2 |
| Mapa de preparación | E8 |
| Evidencias de avance y cierre hablado | E9 pasos 3–6, E10 |
| Grupo experimental vs. control | A2, C1–C3 |
| Instrumentos STAI, PRCS-12, SUS y exportación | E2, E11, C2, A4 |
| Exportación para SPSS/R | A4 paso 4, A5 paso 10 |

## Orden recomendado para hacerlo en una sola tarde

1. Flujo 1 (registros) → A1, A2, A3 (admin prepara todo).
2. C1, C2, C3 (el control es rápido: ~15 min).
3. E1 → E4 (experimental hasta subir la investigación).
4. E5, E6, E7 (primera sesión y su informe).
5. A5 (RAGAs) y A6 (revisión PR) sobre esa primera sesión.
6. E8, E9, E10 (mapa, segunda sesión, progreso).
7. E11, luego A4 (encuestas completas y exportaciones), E12 y las pruebas cruzadas.
