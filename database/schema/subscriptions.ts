import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './auth';

export const subscriptions = pgTable('subscriptions', {
    userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
    plan: text('plan').notNull().default('free'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
