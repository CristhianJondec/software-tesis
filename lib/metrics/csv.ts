/**
 * CSV serialisation for the thesis exports (RFC 4180).
 *
 * Decisions that matter for the files landing in SPSS or R:
 *  - comma delimiter and dot decimals, the format both tools read by default;
 *  - CRLF line endings, as RFC 4180 requires;
 *  - empty cell for a missing value, never 0 and never "NA" — a latency that was
 *    not measured must not become a measured zero once it reaches the analysis;
 *  - a UTF-8 BOM prefix so Excel opens "sustentación" without mangling it.
 *
 * Pure module: no database, no imports.
 */

export type CsvValue = string | number | boolean | null | undefined;

/** Excel needs this to detect UTF-8; SPSS and R ignore it. */
export const CSV_BOM = '﻿';

function escapeCell(value: CsvValue): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') return value ? '1' : '0';
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';

    // A cell is quoted when it contains a delimiter, a quote or a line break;
    // inner quotes are doubled.
    return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(headers: ReadonlyArray<string>, rows: ReadonlyArray<ReadonlyArray<CsvValue>>): string {
    const lines = [headers.map(escapeCell).join(',')];
    for (const row of rows) {
        lines.push(row.map(escapeCell).join(','));
    }
    return lines.join('\r\n') + '\r\n';
}

/** ISO-8601 in UTC, or empty. Timestamps go out unformatted so the analysis tool decides. */
export function isoOrEmpty(date: Date | string | null | undefined): string {
    if (!date) return '';
    const parsed = date instanceof Date ? date : new Date(date);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}
