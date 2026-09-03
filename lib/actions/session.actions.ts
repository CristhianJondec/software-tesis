'use server';

import { and, count, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { revalidatePath } from 'next/cache';

import { db } from '@/database/db';
import { books, voiceSessions } from '@/database/schema';
import { requireUser } from '@/lib/session';
import { PLAN_LIMITS, getCurrentBillingPeriodStart } from '@/lib/subscription-constants';
import { getUserPlan } from '@/lib/subscription.server';
import type { EndSessionResult, StartSessionResult } from '@/types';

export const startVoiceSession = async (bookId: string): Promise<StartSessionResult> => {
    try {
        const user = await requireUser();
        const userId = user.id;

        const ownerCheck = await db
            .select({ id: books.id })
            .from(books)
            .where(and(eq(books.id, bookId), eq(books.userId, userId)))
            .limit(1);

        if (ownerCheck.length === 0) {
            return { success: false, error: 'Book not found or unauthorized' };
        }

        const plan = await getUserPlan();
        const limits = PLAN_LIMITS[plan];
        const billingPeriodStart = getCurrentBillingPeriodStart();

        const [{ value: sessionCount }] = await db
            .select({ value: count() })
            .from(voiceSessions)
            .where(
                and(
                    eq(voiceSessions.userId, userId),
                    eq(voiceSessions.billingPeriodStart, billingPeriodStart),
                ),
            );

        if (sessionCount >= limits.maxSessionsPerMonth) {
            revalidatePath('/');
            return {
                success: false,
                error: `You have reached the monthly session limit for your ${plan} plan (${limits.maxSessionsPerMonth}). Please upgrade for more sessions.`,
                isBillingError: true,
            };
        }

        const [session] = await db
            .insert(voiceSessions)
            .values({
                id: nanoid(),
                userId,
                bookId,
                startedAt: new Date(),
                billingPeriodStart,
                durationSeconds: 0,
            })
            .returning();

        return {
            success: true,
            sessionId: session.id,
            maxDurationMinutes: limits.maxDurationPerSession,
        };
    } catch (e) {
        console.error('Error starting voice session', e);
        return { success: false, error: 'Failed to start voice session. Please try again later.' };
    }
};

export const endVoiceSession = async (
    sessionId: string,
    durationSeconds: number,
): Promise<EndSessionResult> => {
    try {
        const result = await db
            .update(voiceSessions)
            .set({ endedAt: new Date(), durationSeconds, updatedAt: new Date() })
            .where(eq(voiceSessions.id, sessionId))
            .returning({ id: voiceSessions.id });

        if (result.length === 0) {
            return { success: false, error: 'Voice session not found.' };
        }

        return { success: true };
    } catch (e) {
        console.error('Error ending voice session', e);
        return { success: false, error: 'Failed to end voice session. Please try again later.' };
    }
};
