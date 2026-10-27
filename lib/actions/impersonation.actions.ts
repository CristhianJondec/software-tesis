'use server';

import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';

import { db } from '@/database/db';
import { users } from '@/database/schema';
import { requireAdmin } from '@/lib/admin/access';
import { IMPERSONATION_COOKIE, getImpersonation } from '@/lib/session';
import { landingPathFor, normalizeStudyGroup } from '@/lib/study/groups';
import { writeSystemLog } from '@/lib/system-logs/write.server';

const IMPERSONATION_MAX_AGE_SECONDS = 2 * 60 * 60;

/**
 * Lets the admin act as a participant: every page and action then reads and
 * writes as that account (see `getSession` in lib/session.ts). Both ends are
 * written to the system log under the participant.
 */
export const startImpersonation = async (
    userId: string,
): Promise<{ success: boolean; data?: { redirectTo: string }; error?: string }> => {
    try {
        const admin = await requireAdmin();
        if (userId === admin.userId) {
            return { success: false, error: 'Ya estás en tu propia cuenta.' };
        }

        const [target] = await db
            .select({ id: users.id, name: users.name, participantCode: users.participantCode, studyGroup: users.studyGroup })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);
        if (!target) return { success: false, error: 'Usuario no encontrado.' };

        (await cookies()).set(IMPERSONATION_COOKIE, target.id, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            maxAge: IMPERSONATION_MAX_AGE_SECONDS,
        });

        await writeSystemLog({
            level: 'warn',
            source: 'server',
            event: 'admin.impersonation_started',
            message: `${admin.email} entró como ${target.participantCode ?? target.name}.`,
            userId: target.id,
        });

        return { success: true, data: { redirectTo: landingPathFor(normalizeStudyGroup(target.studyGroup)) } };
    } catch (e) {
        console.error('Error starting impersonation', e);
        return { success: false, error: (e as Error).message || 'No se pudo entrar como el usuario.' };
    }
};

export const stopImpersonation = async (): Promise<{ success: boolean }> => {
    try {
        const current = await getImpersonation();
        (await cookies()).delete(IMPERSONATION_COOKIE);

        if (current) {
            await writeSystemLog({
                level: 'info',
                source: 'server',
                event: 'admin.impersonation_ended',
                message: `El admin salió de la cuenta de ${current.participantCode ?? current.name}.`,
                userId: current.userId,
            });
        }
        return { success: true };
    } catch (e) {
        console.error('Error stopping impersonation', e);
        return { success: false };
    }
};
