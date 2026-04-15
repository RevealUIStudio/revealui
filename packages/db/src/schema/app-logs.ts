import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Structured application logs  -  warn and above, all apps.
 *
 * Append-only. No FK constraints (logs outlive users/requests).
 * Written via the DB log transport (packages/db/src/log-transport.ts).
 * Only populated in production; dev logs stay on stdout.
 */
export const appLogs = pgTable(
  'app_logs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
    level: text('level').notNull(), // 'warn' | 'error' | 'fatal'
    message: text('message').notNull(),
    app: text('app').notNull(), // 'admin' | 'api' | 'marketing' | 'mainframe'
    environment: text('environment').notNull().default('production'),
    requestId: text('request_id'),
    userId: text('user_id'),
    data: jsonb('data'), // full LogEntry context + error object
  },
  (table) => [
    index('app_logs_timestamp_idx').on(table.timestamp),
    index('app_logs_app_level_idx').on(table.app, table.level),
    check('app_logs_level_check', sql`level IN ('warn', 'error', 'fatal')`),
    check('app_logs_app_check', sql`app IN ('admin', 'api', 'marketing', 'mainframe')`),
  ],
);
