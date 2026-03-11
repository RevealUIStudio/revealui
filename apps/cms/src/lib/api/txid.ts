/**
 * Transaction ID Generation Utility
 *
 * Generates PostgreSQL transaction IDs for matching optimistic writes
 * with sync updates from ElectricSQL.
 *
 * Transaction IDs are used by TanStack DB to match local optimistic mutations
 * with server-side sync updates.
 */

import { getClient } from '@revealui/db/client';
import { sql } from 'drizzle-orm';

/**
 * Generates a PostgreSQL transaction ID for the current transaction.
 *
 * The transaction ID is used to match optimistic writes on the client
 * with sync updates from ElectricSQL. This allows TanStack DB to:
 * - Match optimistic state with server state
 * - Handle rollbacks for rejected writes
 * - Support concurrent writes from multiple users
 *
 * @param db - Drizzle database client (optional, uses default if not provided)
 * @returns Transaction ID as a number
 * @throws Error if transaction ID cannot be generated
 *
 * @example
 * ```typescript
 * const txid = await generateTxId()
 * // Use txid in mutation response
 * return { item: updatedItem, txid }
 * ```
 */
export async function generateTxId(db?: ReturnType<typeof getClient>): Promise<number> {
  const database = db || getClient();

  // The ::xid cast strips off the epoch, giving you the raw 32-bit value
  // that matches what PostgreSQL sends in logical replication streams
  // (and then exposed through ElectricSQL which we'll match against in the client).
  const result = await database.execute(sql`SELECT pg_current_xact_id()::xid::text as txid`);

  const txid = result.rows[0]?.txid;

  if (txid === undefined) {
    throw new Error('Failed to get transaction ID');
  }

  return parseInt(txid as string, 10);
}

/**
 * Generates a transaction ID within a database transaction.
 *
 * Use this when you're already inside a transaction block.
 *
 * @param tx - Drizzle transaction object
 * @returns Transaction ID as a number
 * @throws Error if transaction ID cannot be generated
 *
 * @example
 * ```typescript
 * const result = await db.transaction(async (tx) => {
 *   const txid = await generateTxIdInTransaction(tx)
 *   const [updated] = await tx.update(table).set(data).where(eq(table.id, id)).returning()
 *   return { item: updated, txid }
 * })
 * ```
 */
export async function generateTxIdInTransaction(
  tx: Parameters<Parameters<ReturnType<typeof getClient>['transaction']>[0]>[0],
): Promise<number> {
  const result = await tx.execute(sql`SELECT pg_current_xact_id()::xid::text as txid`);

  const txid = result.rows[0]?.txid;

  if (txid === undefined) {
    throw new Error('Failed to get transaction ID');
  }

  return parseInt(txid as string, 10);
}
