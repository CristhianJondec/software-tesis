/**
 * Display formatting for the metrics screens.
 *
 * Everything here is deterministic and locale-free on purpose: `toLocaleString`
 * resolves differently on the server and in the browser, which would produce a
 * hydration mismatch on exactly the numbers the thesis quotes. Spanish decimal
 * commas are applied by hand instead.
 *
 * A missing value renders as an em dash, never as 0.
 *
 * Pure module: no imports.
 */

export const EMPTY_VALUE = '—';

function withSpanishDecimals(value: string): string {
    return value.replace('.', ',');
}

/** Narrow no-break space (U+202F): groups thousands without letting a number wrap mid-figure. */
export const THOUSANDS_SEPARATOR = ' ';

/** Thousands separator, the convention used in the thesis tables. */
function groupThousands(integerPart: string): string {
    return integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, THOUSANDS_SEPARATOR);
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY_VALUE;

    const fixed = Math.abs(value).toFixed(decimals);
    const [integerPart, decimalPart] = fixed.split('.');
    const grouped = groupThousands(integerPart);
    const sign = value < 0 ? '-' : '';

    return sign + withSpanishDecimals(decimalPart ? `${grouped}.${decimalPart}` : grouped);
}

export function formatMs(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY_VALUE;
    return `${formatNumber(value, 0)} ms`;
}

/** Signed, so a latency that dropped with practice reads as −420 ms. */
export function formatDeltaMs(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY_VALUE;
    const sign = value > 0 ? '+' : value < 0 ? '−' : '';
    return `${sign}${formatNumber(Math.abs(value), 0)} ms`;
}

export function formatPercent(value: number | null | undefined, decimals = 2): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY_VALUE;
    return `${formatNumber(value, decimals)} %`;
}

/** RAGAs scores live in [0, 1] and are reported with three decimals. */
export function formatScore(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY_VALUE;
    return formatNumber(value, 3);
}

export function formatDuration(seconds: number | null | undefined): string {
    if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return EMPTY_VALUE;
    const minutes = Math.floor(seconds / 60);
    const rest = Math.round(seconds % 60);
    return `${minutes}:${String(rest).padStart(2, '0')}`;
}

/** "2026-09-03 14:05 UTC" — same string on the server and in the browser. */
export function formatDateTime(date: Date | string | null | undefined): string {
    if (!date) return EMPTY_VALUE;
    const parsed = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(parsed.getTime())) return EMPTY_VALUE;

    const iso = parsed.toISOString();
    return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

/** Trims a transcript for a table cell without cutting a word in half. */
export function truncate(text: string, maxLength = 160): string {
    if (text.length <= maxLength) return text;
    const cut = text.slice(0, maxLength);
    const lastSpace = cut.lastIndexOf(' ');
    return `${cut.slice(0, lastSpace > maxLength * 0.6 ? lastSpace : maxLength)}…`;
}
