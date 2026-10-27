/**
 * Display helpers of the system log views. Fixed locale and time zone, like
 * lib/metrics/format.ts, so server and browser render the same text.
 *
 * Pure module: no imports.
 */

const timestampFormatter = new Intl.DateTimeFormat('es-PE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZone: 'America/Lima',
});

/** dd/mm/aaaa, hh:mm:ss in Lima time. */
export function formatLogTimestamp(date: Date | string): string {
    const parsed = date instanceof Date ? date : new Date(date);
    return Number.isNaN(parsed.getTime()) ? '—' : timestampFormatter.format(parsed);
}

/** Offset from the start of the session, as +m:ss. Negative offsets read as before the start. */
export function formatSessionOffset(at: Date | string, sessionStart: Date | string): string {
    const ms = new Date(at).getTime() - new Date(sessionStart).getTime();
    if (!Number.isFinite(ms)) return '—';
    const sign = ms < 0 ? '−' : '+';
    const totalSeconds = Math.floor(Math.abs(ms) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${sign}${minutes}:${seconds}`;
}

export function formatLogDuration(ms: number | null): string {
    if (ms === null) return '—';
    return ms >= 1000 ? `${(ms / 1000).toFixed(2).replace('.', ',')} s` : `${ms} ms`;
}
