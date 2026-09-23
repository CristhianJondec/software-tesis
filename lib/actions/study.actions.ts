'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { db } from '@/database/db';
import { users } from '@/database/schema';
import { requireAdmin } from '@/lib/admin/access';
import { normalizeStudyGroup } from '@/lib/study/groups';

/**
 * Assigns a participant to an arm of the experiment.
 *
 * Admin-only on purpose: the protocol forbids letting participants know — let
 * alone choose — their group, so this never runs from a participant-facing
 * screen. Reassignment stays possible because a mistyped assignment during
 * recruitment has to be fixable; changing it after the participant has produced
 * data is a decision for the researcher, not something the code can judge.
 */
export const setParticipantStudyGroup = async (
    userId: string,
    group: string | null,
): Promise<{ success: boolean; error?: string }> => {
    try {
        await requireAdmin();

        if (!userId?.trim()) return { success: false, error: 'Falta el participante.' };

        // An empty value means "unassign", which locks the account again.
        const normalized = group === null || group === '' ? null : normalizeStudyGroup(group);
        if (group !== null && group !== '' && normalized === null) {
            return { success: false, error: 'El grupo indicado no es válido.' };
        }

        const updated = await db
            .update(users)
            .set({ studyGroup: normalized, updatedAt: new Date() })
            .where(eq(users.id, userId))
            .returning({ id: users.id });

        if (updated.length === 0) return { success: false, error: 'El participante no existe.' };

        revalidatePath('/admin');
        return { success: true };
    } catch (error) {
        console.error('Error setting study group', error);
        return { success: false, error: error instanceof Error ? error.message : 'No se pudo asignar el grupo.' };
    }
};

/** Sets or clears the participant code used to de-identify the exported data. */
export const setParticipantCode = async (
    userId: string,
    code: string,
): Promise<{ success: boolean; error?: string }> => {
    try {
        await requireAdmin();

        const trimmed = code.trim().toUpperCase();
        if (trimmed.length > 32) return { success: false, error: 'El código es demasiado largo.' };

        await db
            .update(users)
            .set({ participantCode: trimmed || null, updatedAt: new Date() })
            .where(eq(users.id, userId));

        revalidatePath('/admin');
        return { success: true };
    } catch (error) {
        console.error('Error setting participant code', error);
        const duplicated = error instanceof Error && error.message.includes('unique');
        return {
            success: false,
            error: duplicated ? 'Ese código ya está asignado a otro participante.' : 'No se pudo guardar el código.',
        };
    }
};
