import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const globalForDb = globalThis as unknown as { sql: ReturnType<typeof postgres> | undefined };

const sql =
    globalForDb.sql ??
    postgres(process.env.DATABASE_URL!, {
        // Production goes through Supabase's transaction pooler (port 6543).
        // When every connection of the pool is busy, postgres.js pipelines the
        // next queries on an open one, and the pooler leaves those pipelined
        // queries hanging (seen on pg_stat_activity as `active` / `ClientRead`):
        // /admin and the export, which fire ~20 queries at once, never finished.
        // A pool larger than any page's concurrency avoids pipelining; client
        // connections to the transaction pooler are cheap. Idle ones close fast
        // so instances from previous deploys do not hold them.
        max: process.env.NODE_ENV === 'production' ? 30 : 1,
        idle_timeout: 20,
        max_lifetime: 60 * 10,
        // Fail fast with an error instead of an endless spinner.
        connect_timeout: 10,
        // Required by Supabase's transaction pooler (port 6543), harmless otherwise.
        prepare: false,
    });

if (process.env.NODE_ENV !== 'production') globalForDb.sql = sql;

export const db = drizzle(sql, { schema });
