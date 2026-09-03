'use client';

import { PLANS, PLAN_LIMITS } from '@/lib/subscription-constants';

// Phase 1: every signed-in user is FREE. Real plan resolution + minute balance arrives in Phase 3 (Culqi).
export const useSubscription = () => {
    return {
        plan: PLANS.FREE,
        limits: PLAN_LIMITS[PLANS.FREE],
        isLoaded: true,
    };
};
