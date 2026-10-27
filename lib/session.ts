import { eq } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';

import { db } from '@/database/db';
import { users } from '@/database/schema';
import { auth } from '@/lib/auth';

/** Cookie set by the admin to act as another account (lib/actions/impersonation.actions.ts). */
export const IMPERSONATION_COOKIE = 'admin_impersonate';

export function configuredAdminEmail(): string | null {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    return email || null;
}

/** The session of whoever is really signed in, ignoring any impersonation. */
export const getRealSession = async () => {
    return auth.api.getSession({ headers: await headers() });
};

/**
 * The session every page and action acts on. When the real user is the admin
 * and the impersonation cookie is set, the user is swapped for the target
 * account, so the whole app (reads and writes) behaves as that participant.
 * The cookie is ignored for anyone else.
 */
export const getSession = async () => {
    const session = await getRealSession();
    if (!session?.user) return session;

    const targetId = (await cookies()).get(IMPERSONATION_COOKIE)?.value;
    if (!targetId || targetId === session.user.id) return session;

    const adminEmail = configuredAdminEmail();
    if (!adminEmail || session.user.email?.trim().toLowerCase() !== adminEmail) return session;

    const [target] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
    if (!target) return session;

    return { ...session, user: { ...session.user, ...target } };
};

/** Who the admin is acting as, or null when not impersonating. */
export const getImpersonation = async (): Promise<{ userId: string; name: string; email: string; participantCode: string | null } | null> => {
    const [real, effective] = await Promise.all([getRealSession(), getSession()]);
    if (!real?.user || !effective?.user || real.user.id === effective.user.id) return null;
    const user = effective.user as typeof effective.user & { participantCode?: string | null };
    return { userId: user.id, name: user.name, email: user.email, participantCode: user.participantCode ?? null };
};

export const requireUser = async () => {
    const session = await getSession();
    if (!session?.user) {
        throw new Error('Unauthorized');
    }
    return session.user;
};
