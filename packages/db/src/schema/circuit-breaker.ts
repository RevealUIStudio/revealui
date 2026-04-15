/**
 * Circuit Breaker State Table
 *
 * Stores shared circuit breaker state across API instances so that a tripped
 * circuit (e.g., Stripe unreachable) is visible to all nodes immediately
 * rather than being isolated per-process.
 *
 * Write path: only on state transitions (closed→open, open→half-open, etc.)
 * Read path: local 5-second cache; DB only on cache miss.
 */

import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const circuitBreakerState = pgTable(
  'circuit_breaker_state',
  {
    /** Service identifier (e.g. 'stripe', 'supabase') */
    serviceName: text('service_name').primaryKey(),

    /** Current circuit state */
    state: text('state').notNull().default('closed'), // 'closed' | 'open' | 'half-open'

    /** Consecutive failures since last reset */
    failureCount: integer('failure_count').notNull().default(0),

    /** Consecutive successes in half-open state */
    successCount: integer('success_count').notNull().default(0),

    /** When the most recent failure occurred */
    lastFailureAt: timestamp('last_failure_at', { withTimezone: true }),

    /** When the current state was entered */
    stateChangedAt: timestamp('state_changed_at', { withTimezone: true }).defaultNow().notNull(),

    /** Row last-written timestamp */
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .$onUpdateFn(() => new Date())
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('circuit_breaker_state_at_idx').on(table.stateChangedAt),
    check('circuit_breaker_state_check', sql`state IN ('closed', 'open', 'half-open')`),
  ],
);

export type CircuitBreakerStateRow = typeof circuitBreakerState.$inferSelect;
export type NewCircuitBreakerState = typeof circuitBreakerState.$inferInsert;
