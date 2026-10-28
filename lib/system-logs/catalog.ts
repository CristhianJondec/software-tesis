/**
 * Catalog of the system log (database/schema/systemLogs.ts): levels, sources and
 * events, with the Spanish labels the admin views show.
 *
 * Events are a closed list on purpose. The browser can report events too, and a
 * free-form name would let any client fill the table with noise; the server
 * action drops anything not listed here.
 *
 * Pure module: no imports.
 */

export const LOG_LEVELS = ['info', 'warn', 'error'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export const LOG_SOURCES = ['client', 'server', 'webhook'] as const;
export type LogSource = (typeof LOG_SOURCES)[number];

export const LOG_LEVEL_LABELS: Record<LogLevel, string> = {
    info: 'Info',
    warn: 'Advertencia',
    error: 'Error',
};

export const LOG_SOURCE_LABELS: Record<LogSource, string> = {
    client: 'Navegador',
    server: 'Servidor',
    webhook: 'Webhook Vapi',
};

export const LOG_EVENTS = {
    // Session lifecycle (server actions)
    'session.started': 'Sesión creada',
    'session.start_rejected': 'Inicio de sesión rechazado',
    'session.ended': 'Sesión cerrada',
    'session.post_anxiety_saved': 'Autoevaluación final guardada',
    'vapi.call_linked': 'Llamada de Vapi vinculada',
    // Voice call, as the student's browser saw it
    'vapi.call_started': 'Llamada conectada',
    'vapi.call_ended': 'Llamada terminada',
    'vapi.start_failed': 'No se pudo iniciar la llamada',
    'vapi.error': 'Error de Vapi',
    'vapi.user_interrupted': 'El estudiante interrumpió al agente',
    'session.limit_reached': 'Límite de tiempo alcanzado',
    'session.wrap_up_sent': 'Aviso de cierre enviado al agente',
    'turn.save_failed': 'No se pudo guardar un turno',
    // Retriever webhook
    'retriever.search': 'Búsqueda en el documento',
    'retriever.no_results': 'Búsqueda sin fragmentos relevantes',
    'retriever.unlinked': 'Búsqueda sin sesión vinculada',
    'webhook.error': 'Error del webhook',
    // Post-session report
    'feedback.evaluated': 'Juez del informe ejecutado',
    // Thesis upload
    'upload.completed': 'Investigación subida',
    'upload.failed': 'Falló la subida de una investigación',
    'upload.limit_reached': 'Límite de investigaciones alcanzado',
    // Catch-all: any console.error on the server, any uncaught error in the browser
    'server.error': 'Error del servidor',
    'client.error': 'Error en el navegador',
    // Admin
    'admin.impersonation_started': 'El admin entró como el participante',
    'admin.impersonation_ended': 'El admin salió de la cuenta del participante',
    'admin.env_revealed': 'El admin mostró una variable de entorno',
} as const;

export type LogEvent = keyof typeof LOG_EVENTS;

/** Events the browser is allowed to report through `logClientEvent`. */
export const CLIENT_LOG_EVENTS = [
    'vapi.call_started',
    'vapi.call_ended',
    'vapi.start_failed',
    'vapi.error',
    'vapi.user_interrupted',
    'session.limit_reached',
    'session.wrap_up_sent',
    'turn.save_failed',
    'client.error',
] as const satisfies readonly LogEvent[];

export function isLogLevel(value: unknown): value is LogLevel {
    return LOG_LEVELS.includes(value as LogLevel);
}

export function isLogSource(value: unknown): value is LogSource {
    return LOG_SOURCES.includes(value as LogSource);
}

export function isLogEvent(value: unknown): value is LogEvent {
    return typeof value === 'string' && Object.hasOwn(LOG_EVENTS, value);
}

export function isClientLogEvent(value: unknown): value is (typeof CLIENT_LOG_EVENTS)[number] {
    return CLIENT_LOG_EVENTS.includes(value as (typeof CLIENT_LOG_EVENTS)[number]);
}

export function describeLogEvent(event: string): string {
    return isLogEvent(event) ? LOG_EVENTS[event] : event;
}

/** Upper bounds for what a single row may carry, so a log can never bloat the table. */
export const MAX_LOG_MESSAGE_LENGTH = 1000;
export const MAX_LOG_METADATA_LENGTH = 4000;

/** Caps a message and a metadata object to the limits above. */
export function clampLogPayload(
    message: string,
    metadata: Record<string, unknown> | null | undefined,
): { message: string; metadata: Record<string, unknown> | null } {
    const clampedMessage = message.length > MAX_LOG_MESSAGE_LENGTH
        ? `${message.slice(0, MAX_LOG_MESSAGE_LENGTH)}…`
        : message;

    if (!metadata || typeof metadata !== 'object') return { message: clampedMessage, metadata: null };

    let serialized: string;
    try {
        serialized = JSON.stringify(metadata);
    } catch {
        return { message: clampedMessage, metadata: { note: 'metadata no serializable' } };
    }
    if (serialized.length <= MAX_LOG_METADATA_LENGTH) {
        return { message: clampedMessage, metadata: JSON.parse(serialized) as Record<string, unknown> };
    }
    return {
        message: clampedMessage,
        metadata: { truncated: true, preview: serialized.slice(0, MAX_LOG_METADATA_LENGTH) },
    };
}
