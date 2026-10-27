import { eq } from 'drizzle-orm';

import { db } from '@/database/db';
import { appSettings, users } from '@/database/schema';
import {
    effectiveThesisUploadLimit,
    GLOBAL_THESIS_UPLOAD_LIMIT_KEY,
    parseThesisUploadLimitInput,
    remainingThesisUploads,
} from '@/lib/study/uploads';

/**
 * Database side of the thesis upload caps (rules in `uploads.ts`). Server-only
 * and deliberately not a server action: callers authorize first.
 */

export interface ThesisUploadAllowance {
    /** Cap that applies. */
    limit: number;
    /** Where the cap comes from. */
    source: 'personal' | 'global' | 'default';
    /** Successful uploads so far, deleted theses included. */
    used: number;
    remaining: number;
}

/** Global cap, or null when the admin has not set one. */
export async function readGlobalThesisUploadLimit(): Promise<number | null> {
    const [row] = await db
        .select({ value: appSettings.value })
        .from(appSettings)
        .where(eq(appSettings.key, GLOBAL_THESIS_UPLOAD_LIMIT_KEY))
        .limit(1);
    return parseThesisUploadLimitInput(row?.value) ?? null;
}

export async function getThesisUploadAllowance(userId: string): Promise<ThesisUploadAllowance> {
    const [[user], globalLimit] = await Promise.all([
        db
            .select({ personalLimit: users.thesisUploadLimit, used: users.thesisUploads })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1),
        readGlobalThesisUploadLimit(),
    ]);

    const personalLimit = user?.personalLimit ?? null;
    const limit = effectiveThesisUploadLimit(personalLimit, globalLimit);
    const used = user?.used ?? 0;

    return {
        limit,
        source: personalLimit !== null ? 'personal' : globalLimit !== null ? 'global' : 'default',
        used,
        remaining: remainingThesisUploads(limit, used),
    };
}
