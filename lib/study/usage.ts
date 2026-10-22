/**
 * Total voice-agent time an account may use across all its sessions.
 *
 * Two caps, both set by the admin from /admin:
 *  - a GLOBAL cap that every account has from the start;
 *  - an optional PERSONAL cap per account, which takes priority over the
 *    global one whenever it is set (higher or lower).
 * No cap at all (both null) means unlimited use.
 *
 * Pure module: the database reads live in `usage.server.ts`.
 */

/** Settings key of the global cap in `app_settings`. */
export const GLOBAL_VOICE_LIMIT_KEY = 'voice_minutes_limit';

/** Upper bound accepted from the admin form, to catch typos (10 000 h). */
export const MAX_VOICE_LIMIT_MINUTES = 600_000;

/**
 * A session is not started with less than this left: it would be cut before
 * the agent finishes its opening.
 */
export const MIN_SECONDS_TO_START_SESSION = 60;

const SECONDS_PER_MINUTE = 60;

/** The cap that applies to an account, in minutes. Null = unlimited. */
export function effectiveVoiceLimitMinutes(
    personalLimitMinutes: number | null,
    globalLimitMinutes: number | null,
): number | null {
    return personalLimitMinutes ?? globalLimitMinutes;
}

/** Seconds left under a cap, never negative. Null = unlimited. */
export function remainingVoiceSeconds(limitMinutes: number | null, usedSeconds: number): number | null {
    if (limitMinutes === null) return null;
    return Math.max(0, limitMinutes * SECONDS_PER_MINUTE - Math.max(0, usedSeconds));
}

/**
 * Parses a cap typed by the admin. Empty means "no cap" (null). Returns
 * `undefined` for anything that is not a whole number of minutes in range.
 */
export function parseVoiceLimitInput(value: number | string | null | undefined): number | null | undefined {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    if (text === '') return null;
    if (!/^\d+$/.test(text)) return undefined;
    const minutes = Number(text);
    if (!Number.isSafeInteger(minutes) || minutes > MAX_VOICE_LIMIT_MINUTES) return undefined;
    return minutes;
}
