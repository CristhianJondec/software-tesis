# Configuración del assistant de Vapi

> **Qué se aplica desde código y qué sigue en el dashboard.**
> El **system prompt y el modelo** del agente se envían desde el repositorio en cada llamada
> (`assistantOverrides` en `hooks/useVapi.ts`), así que no dependen del dashboard ni de la
> memoria de quien lo configuró: son código versionado y auditable. Lo que **sí** sigue
> viviendo en el dashboard de Vapi (https://dashboard.vapi.ai) es el **tool `searchBook`**
> —porque lleva la server URL del webhook— y el **transcriber**.
>
> Esa parte manual es la limitación de reproducibilidad que queda por declarar en la
> investigación, y es mucho más acotada que antes.
>
> **Regla de mantenimiento:** todo cambio en el dashboard se refleja aquí en el mismo
> commit. Si los dos divergen, la evidencia deja de valer.

El system prompt completo está en [`prompt-evaluador.md`](prompt-evaluador.md).

---

## Identidad

| Campo | Valor |
|---|---|
| Assistant ID | el de `NEXT_PUBLIC_ASSISTANT_ID` en `.env` (no se versiona) |
| Nombre | Docente evaluador — sustentación de investigación |
| First message mode | `assistant-speaks-first` |
| First message | **lo envía la aplicación** en cada `vapi.start()` (ver abajo) |

---

## Model

| Campo | Valor | Fuente en el repo |
|---|---|---|
| Provider | `openai` | `lib/constants.ts` → `EVALUATOR_MODEL` |
| Model | `gpt-4o` | `lib/constants.ts` → `EVALUATOR_MODEL` |
| Temperature | según el nivel: `0.3` / `0.4` / `0.5` / `0.6` | `lib/difficulty/levels.ts` → `DIFFICULTY_LEVELS[n].temperature` |
| Max tokens | `250` | `lib/constants.ts` → `EVALUATOR_MODEL` |
| System prompt | el de [`prompt-evaluador.md`](prompt-evaluador.md), íntegro | `lib/agent-prompt.ts` |
| Tools | `searchBook` (ver abajo) | **dashboard** |

Salvo el tool, **esta tabla ya no se configura en el dashboard**: la aplicación envía el
bloque `model` completo en cada `vapi.start()`. Lo que esté puesto en el dashboard en esos
campos no llega al agente.

El tool sí sigue en el dashboard, y por eso el override manda solo `model.messages` y los
parámetros: Vapi fusiona el override sobre el assistant, de modo que `searchBook` sobrevive.
**Verificación obligatoria en la primera sesión de prueba:** si el agente hace preguntas
genéricas y no aparece ninguna fila en `turn_retrievals`, el tool se perdió en la fusión y
hay que enviarlo desde código (`model.toolIds`).

**Justificación de la elección (ítem #13).** La investigación no especifica el LLM, así que se fija
aquí y se reporta como parte del stack:

- **`gpt-4o`** por tres razones concretas: function calling estable —la regla de anclaje del
  prompt depende por completo de que el modelo invoque `searchBook` antes de cada pregunta—,
  buen desempeño en español académico, y latencia baja, que importa porque la latencia del
  LLM entra directamente en la métrica **LP** del capítulo de resultados.
- La **temperatura la fija el nivel de exposición gradual** (doc `propuestas/01`), no
  `EVALUATOR_MODEL`: `0.3` en Ensayo seguro, `0.4` en Práctica guiada, `0.5` en Simulación
  realista y `0.6` en Simulación desafiante. El rango completo sigue siendo bajo porque se
  busca fidelidad al fragmento recuperado, no creatividad: un valor alto favorece exactamente
  lo que el prompt prohíbe (inventar contenido del documento). Los niveles altos suben apenas
  porque necesitan variar el ángulo de la repregunta sin dejar de estar anclados. El valor
  efectivo de cada sesión es reconstruible: `voice_sessions.difficulty_level` guarda el nivel.
- `EVALUATOR_MODEL.temperature` (`0.4`) queda como valor por defecto del override y coincide
  con el nivel 2.
- `maxTokens: 250` fuerza turnos cortos. Es la contención dura del "una pregunta a la vez";
  el prompt lo pide, este límite lo garantiza.

> **Verificar antes de reportar en la investigación:** confirma en el dashboard que el modelo
> configurado hoy coincide con lo anotado aquí, y corrige este archivo si difiere. El nombre
> y la versión exactos del modelo que aparezcan en el dashboard son los que van al capítulo
> de resultados, no los de este documento por sí solo.

---

## Transcriber (STT)

| Campo | Valor |
|---|---|
| Provider | `deepgram` |
| Model | `nova-2` |
| Language | **`es`** |
| Smart format | `true` |

El `language: "es"` explícito es un requisito de la investigación (ítem #11, restricción declarada:
el sistema opera solo en español). Dejarlo en autodetección degrada la transcripción en
español peruano y permite que una frase en inglés desvíe el idioma de toda la sesión.

---

## Voice (TTS)

| Campo | Valor | Fuente en el repo |
|---|---|---|
| Provider | `vapi` | `hooks/useVapi.ts` |
| Voice ID | `Emma` | `lib/constants.ts` → `VAPI_SPANISH_VOICE` |
| Versión | `2` | `lib/constants.ts` → `VAPI_SPANISH_VOICE` |
| Idioma | `es` | `lib/constants.ts` → `VAPI_SPANISH_VOICE` |
| Carácter declarado por Vapi | Natural y amigable | catálogo oficial de Vapi Voices |

La aplicación **sobrescribe la voz en cada llamada**, por lo que la voz guardada en el
dashboard no decide la voz efectiva. `Emma` es una voz propia de Vapi y no requiere una
cuenta, clave ni suscripción separada de ElevenLabs. Esto elimina el punto de falla de una
credencial externa, pero no vuelve gratuita la llamada: el hosting, STT, LLM y TTS siguen
consumiendo el saldo de Vapi.

### Si se decide usar ElevenLabs más adelante

1. Crear la cuenta y una API key en ElevenLabs. El plan gratuito sirve para probar, tiene
   créditos limitados y no incluye licencia comercial.
2. En Vapi abrir **Integrations → ElevenLabs**, conectar la API key y asignarle una cuota para
   limitar gasto. Vapi necesita acceso a los endpoints de texto a voz y listado de voces.
3. Elegir en ElevenLabs Voice Library una voz grabada originalmente en español; el texto
   determina el idioma, pero la muestra original determina en gran medida el acento.
4. Cambiar el override de `hooks/useVapi.ts` a `provider: '11labs'`, el `voiceId` elegido y un
   modelo multilingüe de baja latencia, y ejecutar una sesión completa de prueba.

No basta con pegar `ELEVENLABS_API_KEY` en el `.env` de esta aplicación: quien sintetiza el
audio es Vapi, así que la credencial debe conectarse en el dashboard de Vapi.

---

## Turn-taking y tiempos

Réplica exacta de `VAPI_DASHBOARD_CONFIG` en `lib/constants.ts`. Esa constante no se envía a
Vapi por código: es documentación del repo y **debe pegarse a mano aquí**.

```json
{
  "startSpeakingPlan": {
    "smartEndpointingEnabled": true,
    "waitSeconds": 0.4
  },
  "stopSpeakingPlan": {
    "numWords": 2,
    "voiceSeconds": 0.2,
    "backoffSeconds": 1.0
  },
  "silenceTimeoutSeconds": 30,
  "responseDelaySeconds": 0.4,
  "llmRequestDelaySeconds": 0.1,
  "backgroundDenoisingEnabled": true,
  "backchannelingEnabled": true,
  "fillerInjectionEnabled": false
}
```

Estos valores condicionan la métrica **LP** y la **latencia de respuesta verbal del
estudiante**: `responseDelaySeconds` y `waitSeconds` se suman a la latencia del sistema que
mide `hooks/useVapi.ts`. Si se cambian, hay que reportar el cambio junto con las mediciones.

---

## Tool `searchBook`

Tipo: **Function** · Server URL: la del webhook (ver abajo) · Async: **no**

JSON exacto a pegar en el dashboard:

```json
{
  "type": "function",
  "async": false,
  "function": {
    "name": "searchBook",
    "description": "Recupera fragmentos literales de la investigación del estudiante. Debe llamarse ANTES de formular cualquier pregunta sobre el contenido del documento. Devuelve los fragmentos más cercanos a la consulta, o un aviso de que el tema no aparece en el documento.",
    "parameters": {
      "type": "object",
      "properties": {
        "bookId": {
          "type": "string",
          "description": "Identificador del documento del estudiante. Usa siempre el valor de la variable bookId de la sesión."
        },
        "query": {
          "type": "string",
          "description": "Tema a recuperar, redactado en español como frase de búsqueda. Por ejemplo: 'diseño metodológico y tipo de investigación'."
        },
        "sessionId": {
          "type": "string",
          "description": "Identificador de la sesión de voz en curso. Usa siempre el valor de la variable sessionId de la sesión."
        }
      },
      "required": ["bookId", "query", "sessionId"]
    }
  },
  "server": {
    "url": "https://<TU-DOMINIO>/api/vapi/search-book"
  }
}
```

**`sessionId` es nuevo.** Lo consume `app/api/vapi/search-book/route.ts`, que lo usa para
escribir en `turn_retrievals` mediante `lib/retrievals.ts` (doc `01`). El webhook lo trata
como opcional a propósito, para no romperse si el dashboard aún no lo declara: **si falta,
la búsqueda funciona pero la recuperación no queda registrada**, y sin ese registro el doc
`04` no puede calcular RAGAs. Declararlo no es opcional para la investigación.

El prompt instruye al modelo a pasar `{{bookId}}` y `{{sessionId}}` literalmente; las tres
propiedades van en `required` para que el modelo no las omita.

---

## Webhook

| Entorno | URL |
|---|---|
| Producción | `https://<TU-DOMINIO>/api/vapi/search-book` |
| Desarrollo | túnel público (ngrok/cloudflared) apuntando a `http://localhost:3000/api/vapi/search-book` |

- Método: `POST`. La ruta también expone `GET` que devuelve `{ "status": "ok" }`, útil para
  comprobar desde el dashboard que la URL responde.
- La ruta acepta los dos formatos de Vapi: `message.functionCall` y `message.toolCallList`.
- Nunca lanza: ante cualquier error responde un `result` en texto, para que la conversación
  no se caiga a mitad de la sustentación.
- Existe `VAPI_SERVER_SECRET` en `.env`, pero **la ruta todavía no valida esa cabecera**.
  Es una deuda de seguridad conocida, fuera del alcance de este documento.

---

## Lo que NO se configura en el dashboard

| Cosa | Dónde vive | Por qué |
|---|---|---|
| System prompt | `lib/agent-prompt.ts` | Fuente de verdad versionada; se envía como override en cada llamada |
| Modelo y sus parámetros | `lib/constants.ts` (`EVALUATOR_MODEL`) | Se reportan en la investigación; viajan con el override |
| `firstMessage` | `lib/difficulty/levels.ts` | Depende del nivel; interpola el título real de la investigación |
| Nivel de exigencia | `lib/difficulty/levels.ts` | Bloque `{{levelDirectives}}` del prompt + temperatura; se guarda en `voice_sessions` |
| Voz efectiva | `hooks/useVapi.ts` + `lib/constants.ts` | `Emma` V2, voz nativa de Vapi fijada a español |
| `variableValues` | `hooks/useVapi.ts` | `title`, `author`, `bookId`, `sessionId` |
| Límite de duración | `hooks/useVapi.ts` (`maxDurationSeconds`) | Depende del plan del usuario |

---

## Checklist de aplicación en el dashboard

- [ ] ~~System prompt pegado íntegro~~ → ya no aplica: lo envía la aplicación desde `lib/agent-prompt.ts`
- [ ] ~~Model provider/model/temperature/maxTokens~~ → ya no aplica: los envía `EVALUATOR_MODEL`
- [ ] Transcriber con `language: "es"`
- [ ] La sesión de prueba usa `Emma` V2 y pronuncia el texto en español correctamente
- [ ] Bloque de turn-taking pegado tal cual
- [ ] Tool `searchBook` con los **tres** parámetros requeridos, `sessionId` incluido
- [ ] Server URL apuntando al entorno correcto y `GET` respondiendo `{"status":"ok"}`
- [ ] Sesión de prueba corrida y checklist de `prompt-evaluador.md` verificada
- [ ] Este archivo actualizado si algo quedó distinto de lo anotado
