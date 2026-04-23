/**
 * Error Events Table - Persistent storage for application errors.
 *
 * Captures unhandled errors from admin (client + server) and API.
 * Queryable via the admin dashboard /admin/errors page. Retention:
 * rows older than REVEALUI_LOG_RETENTION_DAYS (default 90) are purged
 * by the daily cron — see packages/db/src/cleanup/log-retention.ts.
 */

import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

// =============================================================================
// Error Events Table
// =============================================================================

export const errorEvents = pgTable(
  'error_events',
  {
    /** Unique event ID (UUID) */
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    /** When the error occurred */
    timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),

    /** Severity level */
    level: text('level').notNull().default('error'), // 'error' | 'fatal' | 'warn'

    /** Error message */
    message: text('message').notNull(),

    /** Stack trace (optional  -  not available for client-side errors without source maps) */
    stack: text('stack'),

    /** Which app generated the error */
    app: text('app').notNull(), // 'admin' | 'api' | 'marketing'

    /** Runtime context within the app */
    context: text('context'), // 'server' | 'client' | 'edge'

    /** Deployment environment */
    environment: text('environment').notNull().default('production'),

    /** URL where the error occurred */
    url: text('url'),

    /** User ID if authenticated (plain text  -  no FK, errors outlive users) */
    userId: text('user_id'),

    /** Request ID for cross-service correlation */
    requestId: text('request_id'),

    /** Additional structured metadata (status codes, headers, etc.) */
    metadata: jsonb('metadata'),
  },
  (table) => [
    index('error_events_timestamp_idx').on(table.timestamp),
    index('error_events_app_env_idx').on(table.app, table.environment),
    index('error_events_level_idx').on(table.level),
    check('error_events_level_check', sql`level IN ('error', 'fatal', 'warn')`),
    check('error_events_app_check', sql`app IN ('admin', 'api', 'marketing')`),
    check(
      'error_events_context_check',
      sql`context IS NULL OR context IN ('server', 'client', 'edge')`,
    ),
  ],
);

/** Row type for select queries */
export type ErrorEventRow = typeof errorEvents.$inferSelect;

/** Insert type for new records */
export type ErrorEventInsert = typeof errorEvents.$inferInsert;
