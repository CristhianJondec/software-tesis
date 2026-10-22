import { eq } from 'drizzle-orm';

import { db } from '@/database/db';
import { appSettings } from '@/database/schema';
import type { StudyContext } from '@/lib/study/access';

/**
 * Flag in `app_settings` that opens thesis upload to the experimental arm.
 * Missing or anything other than 'true' = closed: upload stays off until the
 * admin turns it on from /admin. Researchers can always upload.
 *
 * Server-only and not a server action: callers authorize first.
 */
export const THESIS_UPLOAD_ENABLED_KEY = 'thesis_upload_enabled';

export async function readThesisUploadEnabled(): Promise<boolean> {
    const [row] = await db
        .select({ value: appSettings.value })
        .from(appSettings)
        .where(eq(appSettings.key, THESIS_UPLOAD_ENABLED_KEY))
        .limit(1);
    return row?.value === 'true';
}

/** Why a participant cannot upload right now, or null when they can. */
export type ThesisUploadBlock = 'baseline' | 'disabled';

export async function getThesisUploadBlock(context: StudyContext): Promise<ThesisUploadBlock | null> {
    if (context.isResearcher) return null;
    if (!context.baselineComplete) return 'baseline';
    if (!(await readThesisUploadEnabled())) return 'disabled';
    return null;
}

/** Spanish message for each block, shared by the modal and the server actions. */
export const THESIS_UPLOAD_BLOCK_MESSAGES: Record<ThesisUploadBlock, string> = {
    baseline: 'Aún no has respondido las dos encuestas iniciales (STAI T1 y PRCS-12 T1). Complétalas para poder subir tu investigación.',
    disabled: 'En breve estará disponible la función para subir tu investigación.',
};
