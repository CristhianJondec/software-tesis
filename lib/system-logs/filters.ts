import { GROUP_FILTER_OPTIONS, type GroupFilter } from '@/lib/admin/filters';
import { LOG_EVENTS, LOG_LEVEL_LABELS, LOG_LEVELS, LOG_SOURCE_LABELS, LOG_SOURCES, type LogEvent, type LogLevel, type LogSource } from '@/lib/system-logs/catalog';

/**
 * Filters of /admin/logs. Like the participant list, they live in the URL
 * (?q=&grupo=&nivel=&fuente=&evento=&desde=&hasta=&pagina=) so a filtered view
 * survives a reload.
 */

export interface SystemLogFilters {
    q: string;
    grupo: GroupFilter;
    nivel: LogLevel | 'todos';
    fuente: LogSource | 'todos';
    evento: LogEvent | 'todos';
    /** YYYY-MM-DD, inclusive, in Lima time. Empty = no bound. */
    desde: string;
    hasta: string;
    pagina: number;
}

export const LOGS_PAGE_SIZE = 100;
export const SESSIONS_LIST_LIMIT = 50;

export const LOG_GROUP_OPTIONS = GROUP_FILTER_OPTIONS;

export const LOG_LEVEL_OPTIONS: readonly { value: SystemLogFilters['nivel']; label: string }[] = [
    { value: 'todos', label: 'Todos los niveles' },
    ...LOG_LEVELS.map((value) => ({ value, label: LOG_LEVEL_LABELS[value] })),
];

export const LOG_SOURCE_OPTIONS: readonly { value: SystemLogFilters['fuente']; label: string }[] = [
    { value: 'todos', label: 'Todas las fuentes' },
    ...LOG_SOURCES.map((value) => ({ value, label: LOG_SOURCE_LABELS[value] })),
];

export const LOG_EVENT_OPTIONS: readonly { value: SystemLogFilters['evento']; label: string }[] = [
    { value: 'todos', label: 'Todos los eventos' },
    ...(Object.entries(LOG_EVENTS) as [LogEvent, string][]).map(([value, label]) => ({ value, label })),
];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function pick<T extends string>(value: unknown, options: readonly { value: T }[], fallback: T): T {
    return options.find((option) => option.value === value)?.value ?? fallback;
}

function parseDate(value: string | undefined): string {
    if (!value || !DATE_PATTERN.test(value)) return '';
    return Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) ? '' : value;
}

export function parseSystemLogFilters(params: Record<string, string | string[] | undefined>): SystemLogFilters {
    const first = (key: string) => {
        const value = params[key];
        return Array.isArray(value) ? value[0] : value;
    };
    const page = Number.parseInt(first('pagina') ?? '', 10);
    return {
        q: (first('q') ?? '').trim(),
        grupo: pick(first('grupo'), LOG_GROUP_OPTIONS, 'todos'),
        nivel: pick(first('nivel'), LOG_LEVEL_OPTIONS, 'todos'),
        fuente: pick(first('fuente'), LOG_SOURCE_OPTIONS, 'todos'),
        evento: pick(first('evento'), LOG_EVENT_OPTIONS, 'todos'),
        desde: parseDate(first('desde')),
        hasta: parseDate(first('hasta')),
        pagina: Number.isFinite(page) && page > 0 ? page : 1,
    };
}

export function serializeSystemLogFilters(filters: SystemLogFilters): string {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.grupo !== 'todos') params.set('grupo', filters.grupo);
    if (filters.nivel !== 'todos') params.set('nivel', filters.nivel);
    if (filters.fuente !== 'todos') params.set('fuente', filters.fuente);
    if (filters.evento !== 'todos') params.set('evento', filters.evento);
    if (filters.desde) params.set('desde', filters.desde);
    if (filters.hasta) params.set('hasta', filters.hasta);
    if (filters.pagina > 1) params.set('pagina', String(filters.pagina));
    return params.toString();
}

export function hasActiveLogFilters(filters: SystemLogFilters): boolean {
    return serializeSystemLogFilters({ ...filters, pagina: 1 }) !== '';
}

// Lima has no daylight saving time, so a fixed offset is exact.
const LIMA_OFFSET = '-05:00';
const DAY_MS = 24 * 60 * 60 * 1000;

/** Bounds of the date filters as instants: [from, to). Either may be null. */
export function logDateRange(filters: Pick<SystemLogFilters, 'desde' | 'hasta'>): { from: Date | null; to: Date | null } {
    const from = filters.desde ? new Date(`${filters.desde}T00:00:00${LIMA_OFFSET}`) : null;
    const to = filters.hasta ? new Date(new Date(`${filters.hasta}T00:00:00${LIMA_OFFSET}`).getTime() + DAY_MS) : null;
    return { from, to };
}
