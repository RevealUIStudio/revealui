/**
 * Idempotency Keys Table
 *
 * Generic deduplication table for saga executions and other idempotent operations.
 * Mirrors the pattern in packages/mcp/src/stores/postgres-idempotency.ts but as
 * a proper Drizzle schema for use with the saga executor.
 */

import { index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    /** Unique idempotency key (e.g., 'checkout-license:evt_abc123') */
    key: text('key').primaryKey(),

    /** Operation type for categorization (e.g., 'saga', 'webhook', 'mutation') */
    operationType: text('operation_type').notNull(),

    /** Cached result from the operation (optional) */
    result: jsonb('result').$type<Record<string, unknown>>(),

    /** When this key was created */
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),

    /** When this key expires (for TTL cleanup) */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => [
    index('idempotency_keys_operation_type_idx').on(table.operationType),
    index('idempotency_keys_expires_at_idx').on(table.expiresAt),
  ],
);

export type IdempotencyKey = typeof idempotencyKeys.$inferSelect;
export type NewIdempotencyKey = typeof idempotencyKeys.$inferInsert;
