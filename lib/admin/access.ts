import { getSession } from '@/lib/session';

export type AdminAccess =
    | { allowed: true; userId: string; email: string }
    | { allowed: false; reason: string };

export function configuredAdminEmail(): string | null {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    return email || null;
}

/** Email allowlist with exactly one owner. It fails closed when unconfigured. */
export async function checkAdminAccess(): Promise<AdminAccess> {
    const adminEmail = configuredAdminEmail();
    if (!adminEmail) {
        return { allowed: false, reason: 'El panel no tiene un administrador configurado.' };
    }

    const session = await getSession();
    const email = session?.user?.email?.trim().toLowerCase();
    if (!session?.user || !email) {
        return { allowed: false, reason: 'Inicia sesión para acceder al panel.' };
    }

    if (email !== adminEmail) {
        return { allowed: false, reason: 'No tienes permiso para acceder al panel de administración.' };
    }

    return { allowed: true, userId: session.user.id, email };
}

export async function requireAdmin(): Promise<{ userId: string; email: string }> {
    const access = await checkAdminAccess();
    if (!access.allowed) throw new Error(access.reason);
    return { userId: access.userId, email: access.email };
}
