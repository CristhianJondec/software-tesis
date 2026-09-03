import { headers } from 'next/headers';
import { auth } from '@/lib/auth';

export const getSession = async () => {
    return auth.api.getSession({ headers: await headers() });
};

export const requireUser = async () => {
    const session = await getSession();
    if (!session?.user) {
        throw new Error('Unauthorized');
    }
    return session.user;
};
