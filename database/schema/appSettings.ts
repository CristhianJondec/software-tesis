import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Study-wide settings the admin changes from the panel, one row per key.
 * Values are stored as text and parsed by the code that owns each key.
 *
 * Keys in use:
 *  - `voice_minutes_limit`: global cap, in minutes, on the total voice-agent
 *    time of every account without a personal cap. Missing = no cap.
 *  - `thesis_upload_limit`: global cap on thesis uploads of every account
 *    without a personal cap. Missing = the default in lib/study/uploads.ts.
 */
export const appSettings = pgTable('app_settings', {
    key: text('key').primaryKey(),
    value: text('value').notNull(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
