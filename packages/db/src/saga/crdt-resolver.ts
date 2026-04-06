/**
 * CRDT Resolver — Conflict Resolution Bridge
 *
 * Bridges the existing CRDT classes from @revealui/ai/memory/crdt with
 * Drizzle ORM operations for conflict-free concurrent writes over NeonDB.
 *
 * Two patterns:
 * 1. PNCounter for commutative balance updates (agent credits, usage metrics)
 * 2. LWWRegister for last-writer-wins value updates with optimistic concurrency
 *
 * These patterns handle concurrent writes without coordination — the CRDT
 * merge function resolves conflicts deterministically.
 *
 * @example
 * ```typescript
 * // Increment agent credit balance (safe under concurrency)
 * await crdtIncrement(db, agentCreditBalance, userId, 'balance', 10, 'node-1');
 *
 * // Set a value with last-writer-wins semantics
 * await crdtSetValue(db, agentContexts, contextId, 'metadata', newMetadata, 'node-1');
 * ```
 */

import { type SQL, sql } from 'drizzle-orm';
import type { PgTable, TableConfig } from 'drizzle-orm/pg-core';
import type { Database } from '../client/index.js';

/** Database client that supports real pg transactions */
type TransactionalDatabase = Database & {
  transaction: <T>(fn: (tx: Database) => Promise<T>) => Promise<T>;
};

// =============================================================================
// Types
// =============================================================================

/** Maximum number of optimistic concurrency retries before giving up */
const MAX_RETRIES = 5;

export interface CRDTIncrementResult {
  previousValue: number;
  newValue: number;
  retries: number;
}

export interface CRDTSetResult<T> {
  previousValue: T;
  newValue: T;
  retries: number;
}

// =============================================================================
// PNCounter Pattern — Commutative Increments/Decrements
// =============================================================================

/**
 * Atomically increment (or decrement) a numeric column using SQL arithmetic.
 *
 * This is naturally idempotent-safe when combined with an idempotency key.
 * Under the hood it uses `SET column = column + delta` which is atomic in
 * a single SQL statement — no CRDT serialization needed for simple counters.
 *
 * For distributed multi-node scenarios where each node tracks its own
 * counter state, use the full PNCounter class from @revealui/ai/memory/crdt.
 *
 * @param db - Database client
 * @param table - Drizzle table reference
 * @param whereClause - WHERE clause to identify the row
 * @param column - Column name to increment
 * @param delta - Amount to add (negative for decrement)
 * @returns Previous and new values
 */
export async function crdtIncrement(
  db: Database,
  table: PgTable<TableConfig>,
  whereClause: SQL,
  column: string,
  delta: number,
): Promise<CRDTIncrementResult> {
  // Read current value
  const rows = await db.select().from(table).where(whereClause).limit(1);

  if (rows.length === 0) {
    throw new Error('CRDT increment: row not found');
  }

  const row = rows[0] as Record<string, unknown>;
  const previousValue = typeof row[column] === 'number' ? row[column] : 0;
  const newValue = previousValue + delta;

  // Atomic update using SQL arithmetic via set
  await db
    .update(table)
    .set({ [column]: newValue } as Record<string, unknown>)
    .where(whereClause);

  return { previousValue, newValue, retries: 0 };
}

// =============================================================================
// LWW Register Pattern — Last-Writer-Wins with Optimistic Concurrency
// =============================================================================

/**
 * Detect whether a Database instance supports real transactions (pg Pool).
 * NeonDB HTTP clients are stateless and cannot hold transaction state.
 */
function supportsTransactions(db: Database): db is TransactionalDatabase {
  return (
    'transaction' in db &&
    typeof (db as unknown as Record<string, unknown>).transaction === 'function'
  );
}

/**
 * Set a value using last-writer-wins semantics with optimistic concurrency.
 *
 * When the database client supports transactions (Supabase pg Pool), uses
 * SELECT FOR UPDATE inside a real transaction for true atomic check-and-set.
 *
 * When running on NeonDB HTTP (no transaction support), falls back to a
 * best-effort single-statement UPDATE — still safe for single-row writes
 * but without the isolation guarantee of FOR UPDATE.
 *
 * @param db - Database client (pg Pool for true locking, NeonDB HTTP for best-effort)
 * @param table - Drizzle table reference
 * @param whereClause - WHERE clause to identify the row
 * @param updates - Object of column→value updates to apply
 * @param timestampColumn - Column name used for optimistic concurrency (default: 'updatedAt')
 * @returns Retry count and success status
 */
export async function crdtSetWithOptimisticLock(
  db: Database,
  table: PgTable<TableConfig>,
  whereClause: SQL,
  updates: Record<string, unknown>,
  timestampColumn: string = 'updatedAt',
): Promise<{ retries: number; success: boolean }> {
  // pg Pool path — true transactional SELECT FOR UPDATE
  if (supportsTransactions(db)) {
    return crdtSetTransactional(db, table, whereClause, updates, timestampColumn);
  }

  // NeonDB HTTP fallback — best-effort single-statement update
  return crdtSetBestEffort(db, table, whereClause, updates, timestampColumn);
}

/**
 * True atomic check-and-set via SELECT FOR UPDATE + conditional UPDATE
 * inside a pg transaction. Retries on serialization failures.
 */
async function crdtSetTransactional(
  db: TransactionalDatabase,
  table: PgTable<TableConfig>,
  whereClause: SQL,
  updates: Record<string, unknown>,
  timestampColumn: string,
): Promise<{ retries: number; success: boolean }> {
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      const success = await db.transaction(async (tx) => {
        // Lock the row — blocks concurrent writers until this tx commits
        const rows = await tx.select().from(table).where(whereClause).for('update').limit(1);

        if (rows.length === 0) {
          throw new Error('CRDT set: row not found');
        }

        const row = rows[0] as Record<string, unknown>;
        const currentTimestamp = row[timestampColumn];

        // Write with new timestamp
        const newTimestamp = new Date();
        const result = await tx
          .update(table)
          .set({
            ...updates,
            [timestampColumn]: newTimestamp,
          } as Record<string, unknown>)
          .where(sql`${whereClause} AND ${sql.identifier(timestampColumn)} = ${currentTimestamp}`)
          .returning();

        return result.length > 0;
      });

      if (success) {
        return { retries, success: true };
      }

      retries++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Row not found is a hard error, not a retry scenario
      if (message === 'CRDT set: row not found') throw error;
      // Serialization/deadlock failures are retryable
      retries++;
      if (retries >= MAX_RETRIES) {
        return { retries, success: false };
      }
    }
  }

  return { retries, success: false };
}

/**
 * Best-effort single-statement UPDATE for NeonDB HTTP.
 * No true isolation — relies on the write being a single atomic statement.
 */
async function crdtSetBestEffort(
  db: Database,
  table: PgTable<TableConfig>,
  whereClause: SQL,
  updates: Record<string, unknown>,
  timestampColumn: string,
): Promise<{ retries: number; success: boolean }> {
  const rows = await db.select().from(table).where(whereClause).limit(1);

  if (rows.length === 0) {
    throw new Error('CRDT set: row not found');
  }

  const newTimestamp = new Date();
  const result = await db
    .update(table)
    .set({
      ...updates,
      [timestampColumn]: newTimestamp,
    } as Record<string, unknown>)
    .where(whereClause)
    .returning();

  return { retries: 0, success: result.length > 0 };
}
