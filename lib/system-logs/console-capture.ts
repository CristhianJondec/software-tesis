import { nanoid } from 'nanoid';

import { db } from '@/database/db';
import { systemLogs } from '@/database/schema';
import { clampLogPayload } from '@/lib/system-logs/catalog';

/**
 * Mirrors every server-side `console.error` into the system log as a
 * `server.error` row, so an error that only a catch block saw (a Gemini quota,
 * a failed query) still reaches /admin/logs without wiring each call site.
 *
 * Installed once from `instrumentation.ts`. The original console keeps
 * working; the copy to the database is best effort and can never throw back.
 * No `server-only` import: instrumentation runs outside the React server graph.
 */

/** The same message is stored at most once per window, so a loop cannot flood the table. */
const DEDUPE_WINDOW_MS = 30_000;
/** Hard cap on rows per minute, whatever the messages are. */
const MAX_ROWS_PER_MINUTE = 60;
const MAX_STACK_LENGTH = 1500;

const INSTALLED = Symbol.for('investfied.consoleCapture');

function describeArg(arg: unknown): string {
    if (arg instanceof Error) return arg.message || arg.name;
    if (typeof arg === 'string') return arg;
    try {
        return JSON.stringify(arg);
    } catch {
        return String(arg);
    }
}

function buildRow(args: unknown[]): { message: string; metadata: Record<string, unknown> } {
    const message = args.map(describeArg).join(' ').trim() || 'console.error sin mensaje';
    const error = args.find((arg): arg is Error => arg instanceof Error);
    const metadata: Record<string, unknown> = {};
    if (error) {
        metadata.name = error.name;
        const status = (error as { status?: unknown }).status;
        if (typeof status === 'number') metadata.status = status;
        if (error.stack) metadata.stack = error.stack.slice(0, MAX_STACK_LENGTH);
        const digest = (error as { digest?: unknown }).digest;
        if (typeof digest === 'string') metadata.digest = digest;
    }
    return { message, metadata };
}

export function installConsoleErrorCapture(): void {
    const globalState = globalThis as Record<symbol, unknown>;
    if (globalState[INSTALLED]) return;
    globalState[INSTALLED] = true;

    const original = console.error.bind(console);
    const lastSeen = new Map<string, number>();
    let windowStart = 0;
    let rowsInWindow = 0;
    let writing = false;

    console.error = (...args: unknown[]) => {
        original(...args);
        // Guards against re-entry while the row is being built and sent.
        if (writing) return;
        writing = true;
        try {
            mirror(args);
        } finally {
            writing = false;
        }
    };

    function mirror(args: unknown[]) {
        const now = Date.now();
        if (now - windowStart > 60_000) {
            windowStart = now;
            rowsInWindow = 0;
        }
        if (rowsInWindow >= MAX_ROWS_PER_MINUTE) return;

        const row = buildRow(args);
        const key = row.message.slice(0, 200);
        const previous = lastSeen.get(key);
        if (previous !== undefined && now - previous < DEDUPE_WINDOW_MS) return;
        lastSeen.set(key, now);
        if (lastSeen.size > 500) lastSeen.clear();
        rowsInWindow++;

        const { message, metadata } = clampLogPayload(row.message, row.metadata);
        // Failures go to the original console, never back through this hook.
        void db
            .insert(systemLogs)
            .values({ id: nanoid(), level: 'error', source: 'server', event: 'server.error', message, metadata })
            .catch((error: unknown) => original('Failed to mirror console.error into the system log', error));
    }
}
