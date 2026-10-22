'use server';

import { eq, sum } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { db } from '@/database/db';
import { appSettings, users, voiceSessions } from '@/database/schema';
import { requireAdmin } from '@/lib/admin/access';
import { normalizeStudyGroup } from '@/lib/study/groups';
import { GLOBAL_VOICE_LIMIT_KEY, parseVoiceLimitInput } from '@/lib/study/usage';
import { readGlobalVoiceLimit } from '@/lib/study/usage.server';
import { readThesisUploadEnabled, THESIS_UPLOAD_ENABLED_KEY } from '@/lib/study/upload.server';

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

// ============================================================================
// Voice-agent time caps (rules in lib/study/usage.ts)
// ============================================================================

export interface VoiceUsageOverview {
    /** Global cap in minutes. Null = unlimited. */
    globalLimitMinutes: number | null;
    /** Per account: personal cap (null = uses the global) and seconds used. */
    users: Record<string, { personalLimitMinutes: number | null; usedSeconds: number }>;
}

export const getVoiceUsageOverview = async (): Promise<{
    success: boolean;
    data?: VoiceUsageOverview;
    error?: string;
}> => {
    try {
        await requireAdmin();

        const [globalLimitMinutes, limits, usage] = await Promise.all([
            readGlobalVoiceLimit(),
            db.select({ id: users.id, limit: users.voiceMinutesLimit }).from(users),
            db
                .select({ userId: voiceSessions.userId, usedSeconds: sum(voiceSessions.durationSeconds) })
                .from(voiceSessions)
                .groupBy(voiceSessions.userId),
        ]);

        const usedByUser = new Map(usage.map((row) => [row.userId, Number(row.usedSeconds ?? 0)]));
        const overview: VoiceUsageOverview['users'] = {};
        for (const row of limits) {
            overview[row.id] = { personalLimitMinutes: row.limit, usedSeconds: usedByUser.get(row.id) ?? 0 };
        }

        return { success: true, data: { globalLimitMinutes, users: overview } };
    } catch (error) {
        console.error('Error loading voice usage', error);
        return { success: false, error: 'No se pudo cargar el uso del agente.' };
    }
};

/** Sets the global cap every account starts with. Empty = no cap. */
export const setGlobalVoiceLimit = async (
    minutes: string | number | null,
): Promise<{ success: boolean; error?: string }> => {
    try {
        await requireAdmin();

        const parsed = parseVoiceLimitInput(minutes);
        if (parsed === undefined) return { success: false, error: 'Indica un número entero de minutos.' };

        if (parsed === null) {
            await db.delete(appSettings).where(eq(appSettings.key, GLOBAL_VOICE_LIMIT_KEY));
        } else {
            await db
                .insert(appSettings)
                .values({ key: GLOBAL_VOICE_LIMIT_KEY, value: String(parsed), updatedAt: new Date() })
                .onConflictDoUpdate({
                    target: appSettings.key,
                    set: { value: String(parsed), updatedAt: new Date() },
                });
        }

        revalidatePath('/admin');
        return { success: true };
    } catch (error) {
        console.error('Error setting global voice limit', error);
        return { success: false, error: 'No se pudo guardar el límite general.' };
    }
};

/** Sets a personal cap that overrides the global one. Empty = back to the global. */
export const setUserVoiceLimit = async (
    userId: string,
    minutes: string | number | null,
): Promise<{ success: boolean; error?: string }> => {
    try {
        await requireAdmin();

        if (!userId?.trim()) return { success: false, error: 'Falta el participante.' };
        const parsed = parseVoiceLimitInput(minutes);
        if (parsed === undefined) return { success: false, error: 'Indica un número entero de minutos.' };

        const updated = await db
            .update(users)
            .set({ voiceMinutesLimit: parsed, updatedAt: new Date() })
            .where(eq(users.id, userId))
            .returning({ id: users.id });

        if (updated.length === 0) return { success: false, error: 'El participante no existe.' };

        revalidatePath('/admin');
        return { success: true };
    } catch (error) {
        console.error('Error setting user voice limit', error);
        return { success: false, error: 'No se pudo guardar el límite del participante.' };
    }
};

// ============================================================================
// Thesis upload flag (lib/study/upload.server.ts)
// ============================================================================

/** Opens or closes thesis upload for the experimental arm. */
export const setThesisUploadEnabled = async (
    enabled: boolean,
): Promise<{ success: boolean; error?: string }> => {
    try {
        await requireAdmin();

        const value = enabled ? 'true' : 'false';
        await db
            .insert(appSettings)
            .values({ key: THESIS_UPLOAD_ENABLED_KEY, value, updatedAt: new Date() })
            .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });

        revalidatePath('/admin');
        revalidatePath('/books/new');
        return { success: true };
    } catch (error) {
        console.error('Error setting thesis upload flag', error);
        return { success: false, error: 'No se pudo cambiar el estado de la subida de tesis.' };
    }
};

export const getThesisUploadEnabled = async (): Promise<{ success: boolean; data?: boolean; error?: string }> => {
    try {
        await requireAdmin();
        return { success: true, data: await readThesisUploadEnabled() };
    } catch (error) {
        console.error('Error reading thesis upload flag', error);
        return { success: false, error: 'No se pudo leer el estado de la subida de tesis.' };
    }
};
