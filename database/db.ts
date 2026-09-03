import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const globalForDb = globalThis as unknown as { sql: ReturnType<typeof postgres> | undefined };

const sql =
    globalForDb.sql ??
    postgres(process.env.DATABASE_URL!, {
        max: process.env.NODE_ENV === 'production' ? 10 : 1,
    });

if (process.env.NODE_ENV !== 'production') globalForDb.sql = sql;

export const db = drizzle(sql, { schema });
