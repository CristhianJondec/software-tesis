/**
 * How many theses an account may upload over the whole study.
 *
 * Same shape as the voice-time caps (`usage.ts`):
 *  - a GLOBAL cap set by the admin from /admin;
 *  - an optional PERSONAL cap per account, which takes priority over the
 *    global one whenever it is set.
 * Unlike voice time there is always a cap: an empty global falls back to
 * DEFAULT_THESIS_UPLOAD_LIMIT, because every upload is billed (embeddings).
 *
 * What counts is every SUCCESSFUL upload (`users.thesis_uploads`). Deleting a
 * thesis does not give the slot back; a failed upload never takes one.
 *
 * Pure module: the database reads live in `uploads.server.ts`.
 */

/** Settings key of the global cap in `app_settings`. */
export const GLOBAL_THESIS_UPLOAD_LIMIT_KEY = 'thesis_upload_limit';

/** Cap used while the admin has not set a global one. */
export const DEFAULT_THESIS_UPLOAD_LIMIT = 1;

/** Upper bound accepted from the admin form, to catch typos. */
export const MAX_THESIS_UPLOAD_LIMIT = 100;

/** The cap that applies to an account. */
export function effectiveThesisUploadLimit(personalLimit: number | null, globalLimit: number | null): number {
    return personalLimit ?? globalLimit ?? DEFAULT_THESIS_UPLOAD_LIMIT;
}

/** Uploads left under a cap, never negative. */
export function remainingThesisUploads(limit: number, used: number): number {
    return Math.max(0, limit - Math.max(0, used));
}

/**
 * Parses a cap typed by the admin. Empty means "no value" (null). Returns
 * `undefined` for anything that is not a whole number in range.
 */
export function parseThesisUploadLimitInput(value: number | string | null | undefined): number | null | undefined {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    if (text === '') return null;
    if (!/^\d+$/.test(text)) return undefined;
    const limit = Number(text);
    if (!Number.isSafeInteger(limit) || limit > MAX_THESIS_UPLOAD_LIMIT) return undefined;
    return limit;
}
