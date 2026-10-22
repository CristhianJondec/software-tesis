import { eq, sum } from 'drizzle-orm';

import { db } from '@/database/db';
import { appSettings, users, voiceSessions } from '@/database/schema';
import {
    effectiveVoiceLimitMinutes,
    GLOBAL_VOICE_LIMIT_KEY,
    parseVoiceLimitInput,
    remainingVoiceSeconds,
} from '@/lib/study/usage';

/**
 * Database side of the voice-time caps (rules in `usage.ts`). Server-only and
 * deliberately not a server action: callers authorize first.
 */

export interface VoiceAllowance {
    /** Cap that applies, in minutes. Null = unlimited. */
    limitMinutes: number | null;
    /** Where the cap comes from. */
    source: 'personal' | 'global' | 'none';
    /** Voice time already used, summed over every finished session. */
    usedSeconds: number;
    /** Seconds left. Null = unlimited. */
    remainingSeconds: number | null;
}

/** Global cap in minutes, or null when none is configured. */
export async function readGlobalVoiceLimit(): Promise<number | null> {
    const [row] = await db
        .select({ value: appSettings.value })
        .from(appSettings)
        .where(eq(appSettings.key, GLOBAL_VOICE_LIMIT_KEY))
        .limit(1);
    return parseVoiceLimitInput(row?.value) ?? null;
}

export async function getVoiceAllowance(userId: string): Promise<VoiceAllowance> {
    const [[user], [usage], globalLimit] = await Promise.all([
        db
            .select({ voiceMinutesLimit: users.voiceMinutesLimit })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1),
        db
            .select({ usedSeconds: sum(voiceSessions.durationSeconds) })
            .from(voiceSessions)
            .where(eq(voiceSessions.userId, userId)),
        readGlobalVoiceLimit(),
    ]);

    const personalLimit = user?.voiceMinutesLimit ?? null;
    const limitMinutes = effectiveVoiceLimitMinutes(personalLimit, globalLimit);
    const usedSeconds = Number(usage?.usedSeconds ?? 0);

    return {
        limitMinutes,
        source: personalLimit !== null ? 'personal' : globalLimit !== null ? 'global' : 'none',
        usedSeconds,
        remainingSeconds: remainingVoiceSeconds(limitMinutes, usedSeconds),
    };
}
