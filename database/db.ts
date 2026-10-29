import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const globalForDb = globalThis as unknown as { sql: ReturnType<typeof postgres> | undefined };

const sql =
    globalForDb.sql ??
    postgres(process.env.DATABASE_URL!, {
        // Each Vercel instance holds its own pool, and instances from previous
        // deploys linger for a while. Small pools that close idle connections
        // keep the total under Supabase's client limit; without that, a few
        // deploys in a row exhaust it and every query waits forever.
        max: process.env.NODE_ENV === 'production' ? 4 : 1,
        idle_timeout: 20,
        max_lifetime: 60 * 10,
        // Fail fast with an error instead of an endless spinner.
        connect_timeout: 10,
        // Required by Supabase's transaction pooler (port 6543), harmless otherwise.
        prepare: false,
    });

if (process.env.NODE_ENV !== 'production') globalForDb.sql = sql;

export const db = drizzle(sql, { schema });
