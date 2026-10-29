import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { eq } from 'drizzle-orm';
import { db } from '@/database/db';
import * as schema from '@/database/schema';

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: 'pg',
        schema: {
            user: schema.users,
            session: schema.sessions,
            account: schema.accounts,
            verification: schema.verifications,
        },
    }),
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
    },
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
    },
    databaseHooks: {
        user: {
            create: {
                // Every new account joins the experimental group right away
                // instead of waiting in /sin-asignar for the admin. The admin
                // can still move it to control from /admin.
                after: async (user) => {
                    await db
                        .update(schema.users)
                        .set({ studyGroup: 'experimental', updatedAt: new Date() })
                        .where(eq(schema.users.id, user.id));
                },
            },
        },
    },
});

export type Session = typeof auth.$Infer.Session;
