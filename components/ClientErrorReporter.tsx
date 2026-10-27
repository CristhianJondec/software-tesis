'use client';

import { useEffect } from 'react';

import { logClientEvent } from '@/lib/actions/system-log.actions';

/** Reports per page load, so a render loop cannot flood the log. */
const MAX_REPORTS = 10;
const MAX_STACK_LENGTH = 1500;

/**
 * Sends uncaught browser errors and unhandled promise rejections to the system
 * log as `client.error`. Mounted once in the root layout; renders nothing.
 * Anonymous visitors are dropped by `logClientEvent` itself.
 */
export default function ClientErrorReporter() {
    useEffect(() => {
        const seen = new Set<string>();
        let reports = 0;

        const report = (message: string, error: unknown) => {
            if (reports >= MAX_REPORTS || seen.has(message)) return;
            seen.add(message);
            reports++;
            const stack = error instanceof Error ? error.stack?.slice(0, MAX_STACK_LENGTH) : undefined;
            void logClientEvent({
                event: 'client.error',
                level: 'error',
                message,
                metadata: { path: window.location.pathname, ...(stack ? { stack } : {}) },
            }).catch(() => undefined);
        };

        const onError = (event: ErrorEvent) => {
            report(event.message || 'Error de JavaScript sin mensaje', event.error);
        };
        const onRejection = (event: PromiseRejectionEvent) => {
            const reason = event.reason;
            const message = reason instanceof Error ? reason.message : String(reason);
            report(`Promesa rechazada sin manejar: ${message}`, reason);
        };

        window.addEventListener('error', onError);
        window.addEventListener('unhandledrejection', onRejection);
        return () => {
            window.removeEventListener('error', onError);
            window.removeEventListener('unhandledrejection', onRejection);
        };
    }, []);

    return null;
}
