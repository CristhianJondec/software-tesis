import { eq } from 'drizzle-orm';
import { db } from '@/database/db';
import { subscriptions } from '@/database/schema';
import { PLANS, PLAN_LIMITS, type PlanType } from '@/lib/subscription-constants';
import { getSession } from '@/lib/session';

export const getUserPlan = async (): Promise<PlanType> => {
    const session = await getSession();
    if (!session?.user) return PLANS.FREE;

    const rows = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, session.user.id))
        .limit(1);

    if (rows.length === 0) {
        await db
            .insert(subscriptions)
            .values({ userId: session.user.id })
            .onConflictDoNothing();
        return PLANS.FREE;
    }

    return rows[0].plan as PlanType;
};

export const getPlanLimits = async () => {
    const plan = await getUserPlan();
    return PLAN_LIMITS[plan];
};
