/**
 * LP — Latencia Promedio = Σti / n
 *
 * Two clocks are reported, and they must never be averaged together:
 *
 *  - System latency (`systemLatencyMs`, agent turns): end of the student's
 *    speech → start of the agent's reply. This is LP, a property of the system.
 *  - Student verbal-response latency (`studentLatencyMs`, student turns): end of
 *    the agent's question → the student's first word. This is a dimension of the
 *    thesis's dependent variable, so it is grouped by participant and by session
 *    number: what matters is whether it drops with practice.
 *
 * Pure module: no database, no imports. Everything here is testable in isolation.
 */

export interface LatencySummary {
    /** n — number of measurements that actually contributed. */
    n: number;
    /** Σti / n, in milliseconds. Null when n = 0: there is no average of nothing. */
    meanMs: number | null;
    medianMs: number | null;
    minMs: number | null;
    maxMs: number | null;
    /** 95th percentile, nearest-rank. Reported to expose the tail LP hides. */
    p95Ms: number | null;
}

export const EMPTY_LATENCY_SUMMARY: LatencySummary = {
    n: 0,
    meanMs: null,
    medianMs: null,
    minMs: null,
    maxMs: null,
    p95Ms: null,
};

/** Keeps only finite, non-negative measurements. A negative latency is a clock bug, not data. */
function usableValues(values: ReadonlyArray<number | null | undefined>): number[] {
    return values
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0)
        .sort((a, b) => a - b);
}

function round(value: number): number {
    return Math.round(value * 100) / 100;
}

export function summarizeLatency(values: ReadonlyArray<number | null | undefined>): LatencySummary {
    const sorted = usableValues(values);
    const n = sorted.length;
    if (n === 0) return EMPTY_LATENCY_SUMMARY;

    const sum = sorted.reduce((acc, v) => acc + v, 0);
    const middle = Math.floor(n / 2);
    const median = n % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
    // Nearest-rank percentile: with the small n of a thesis pilot, interpolation
    // would invent a value that was never measured.
    const p95Index = Math.min(n - 1, Math.ceil(0.95 * n) - 1);

    return {
        n,
        meanMs: round(sum / n),
        medianMs: round(median),
        minMs: sorted[0],
        maxMs: sorted[n - 1],
        p95Ms: sorted[p95Index],
    };
}

export interface SessionRef {
    sessionId: string;
    userId: string;
    /** Epoch milliseconds. */
    startedAt: number;
}

/**
 * Numbers each participant's sessions in chronological order, starting at 1.
 * The session number — not the date — is what the thesis plots the student
 * latency against, because participants start on different days.
 */
export function numberSessionsByParticipant(sessions: ReadonlyArray<SessionRef>): Map<string, number> {
    const byUser = new Map<string, SessionRef[]>();
    for (const session of sessions) {
        const list = byUser.get(session.userId);
        if (list) list.push(session);
        else byUser.set(session.userId, [session]);
    }

    const numbers = new Map<string, number>();
    for (const list of byUser.values()) {
        // Tie-break by id so the numbering is deterministic across recalculations.
        list.sort((a, b) => a.startedAt - b.startedAt || a.sessionId.localeCompare(b.sessionId));
        list.forEach((session, index) => numbers.set(session.sessionId, index + 1));
    }
    return numbers;
}

export interface LatencySample {
    sessionId: string;
    userId: string;
    /** Thesis participant code; null while the account has not been assigned one. */
    participantCode: string | null;
    studyGroup: string | null;
    latencyMs: number | null;
}

export interface ParticipantSessionLatency {
    userId: string;
    participantCode: string | null;
    studyGroup: string | null;
    sessionId: string;
    sessionNumber: number;
    summary: LatencySummary;
}

/** One summary per (participant, session), ordered by participant and session number. */
export function summarizeByParticipantSession(
    samples: ReadonlyArray<LatencySample>,
    sessionNumbers: ReadonlyMap<string, number>,
): ParticipantSessionLatency[] {
    const groups = new Map<string, { meta: LatencySample; values: (number | null)[] }>();

    for (const sample of samples) {
        const group = groups.get(sample.sessionId);
        if (group) group.values.push(sample.latencyMs);
        else groups.set(sample.sessionId, { meta: sample, values: [sample.latencyMs] });
    }

    return [...groups.entries()]
        .map(([sessionId, { meta, values }]) => ({
            userId: meta.userId,
            participantCode: meta.participantCode,
            studyGroup: meta.studyGroup,
            sessionId,
            sessionNumber: sessionNumbers.get(sessionId) ?? 0,
            summary: summarizeLatency(values),
        }))
        .sort(
            (a, b) =>
                (a.participantCode ?? a.userId).localeCompare(b.participantCode ?? b.userId) ||
                a.sessionNumber - b.sessionNumber,
        );
}

export interface ParticipantTrend {
    userId: string;
    participantCode: string | null;
    studyGroup: string | null;
    sessions: number;
    firstSessionMeanMs: number | null;
    lastSessionMeanMs: number | null;
    /** last − first. Negative means the student answered faster with practice. */
    deltaMs: number | null;
    overall: LatencySummary;
}

/**
 * First vs last session per participant. Deliberately not a regression: with a
 * handful of sessions per participant a slope would look more precise than the
 * data warrants. The per-session table above is the real evidence; this is a
 * reading aid.
 */
export function studentLatencyTrend(
    rows: ReadonlyArray<ParticipantSessionLatency>,
    allSamples: ReadonlyArray<LatencySample>,
): ParticipantTrend[] {
    const byUser = new Map<string, ParticipantSessionLatency[]>();
    for (const row of rows) {
        // A session with no usable measurement cannot anchor a trend.
        if (row.summary.n === 0) continue;
        const list = byUser.get(row.userId);
        if (list) list.push(row);
        else byUser.set(row.userId, [row]);
    }

    const samplesByUser = new Map<string, (number | null)[]>();
    for (const sample of allSamples) {
        const list = samplesByUser.get(sample.userId);
        if (list) list.push(sample.latencyMs);
        else samplesByUser.set(sample.userId, [sample.latencyMs]);
    }

    return [...byUser.entries()]
        .map(([userId, list]) => {
            list.sort((a, b) => a.sessionNumber - b.sessionNumber);
            const first = list[0].summary.meanMs;
            const last = list[list.length - 1].summary.meanMs;
            const hasBoth = list.length > 1 && first !== null && last !== null;

            return {
                userId,
                participantCode: list[0].participantCode,
                studyGroup: list[0].studyGroup,
                sessions: list.length,
                firstSessionMeanMs: first,
                lastSessionMeanMs: last,
                deltaMs: hasBoth ? round(last - first) : null,
                overall: summarizeLatency(samplesByUser.get(userId) ?? []),
            };
        })
        .sort((a, b) => (a.participantCode ?? a.userId).localeCompare(b.participantCode ?? b.userId));
}
