import { getSession } from '@/lib/session';

/**
 * Access control for /metrics and /metrics/revision.
 *
 * These screens read every participant's sessions and transcripts, so they are
 * NOT ownership-scoped like the rest of the app: they are the researcher's view
 * of the whole study. That makes an explicit allowlist mandatory.
 *
 * Set METRICS_OWNER_EMAILS in .env (comma-separated). It FAILS CLOSED: with the
 * variable unset nobody gets in, including in development. An empty allowlist
 * that let everyone through would expose other participants' transcripts the
 * first time the app is deployed without the variable.
 */

export function researchOwnerEmails(): string[] {
    return (process.env.METRICS_OWNER_EMAILS ?? '')
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);
}

export type MetricsAccess =
    | { allowed: true; userId: string; email: string }
    | { allowed: false; reason: string };

export async function checkMetricsAccess(): Promise<MetricsAccess> {
    const allowlist = researchOwnerEmails();
    if (allowlist.length === 0) {
        return {
            allowed: false,
            reason:
                'No hay ningún responsable de métricas configurado. Define METRICS_OWNER_EMAILS en .env con el correo del investigador.',
        };
    }

    const session = await getSession();
    const email = session?.user?.email?.toLowerCase();

    if (!session?.user || !email) {
        return { allowed: false, reason: 'Inicia sesión para ver las métricas.' };
    }

    if (!allowlist.includes(email)) {
        return { allowed: false, reason: 'Esta sección es solo para el responsable de la investigación.' };
    }

    return { allowed: true, userId: session.user.id, email };
}

/** Throws instead of returning a verdict. For server actions, which must not leak data on failure. */
export async function requireResearchOwner(): Promise<{ userId: string; email: string }> {
    const access = await checkMetricsAccess();
    if (!access.allowed) throw new Error(access.reason);
    return { userId: access.userId, email: access.email };
}
