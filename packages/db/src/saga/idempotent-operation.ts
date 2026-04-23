/**
 * Idempotent Operation Wrapper
 *
 * Generalizes the processedWebhookEvents dedup pattern into a reusable
 * utility. Checks an idempotency key before executing, skips if already
 * processed, and records the key after success.
 *
 * @example
 * ```typescript
 * const { result, alreadyProcessed } = await idempotentWrite(
 *   db,
 *   `send-welcome-email:${userId}`,
 *   'email',
 *   async () => {
 *     await sendWelcomeEmail(userId);
 *     return { sent: true };
 *   },
 * );
 *
 * if (alreadyProcessed) {
 *   // Email was already sent  -  skip
 * }
 * ```
 */

import { eq } from 'drizzle-orm';
import type { Database } from '../client/index.js';
import { idempotencyKeys } from '../schema/idempotency.js';

// Default TTL: 24 hours
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export interface IdempotentWriteResult<T> {
  /**
   * The operation's return value. Populated in two cases:
   *   1. Fresh execution: the function ran and returned this value.
   *   2. Replay after a prior run that stored `cacheResult: true`: this
   *      is the memoized value from the original run.
   * Undefined only when the key already exists but no result was cached
   * (e.g. operations that don't opt into `cacheResult`).
   */
  result?: T;
  /** True if the operation was skipped because the key already existed */
  alreadyProcessed: boolean;
}

export interface IdempotentWriteOptions {
  /** TTL for the idempotency key in ms (default: 24 hours) */
  ttlMs?: number;
  /** Cache the result in the idempotency record for retrieval on replay */
  cacheResult?: boolean;
}

/**
 * Execute an operation idempotently.
 *
 * 1. Check if the key exists in idempotency_keys (skip if so)
 * 2. Execute the operation
 * 3. Record the key (ON CONFLICT DO NOTHING for race-condition safety)
 *
 * @param db - Database client
 * @param key - Unique idempotency key for this operation
 * @param operationType - Category string (e.g., 'saga', 'email', 'webhook')
 * @param operation - The function to execute idempotently
 * @param options - TTL and caching options
 */
export async function idempotentWrite<T>(
  db: Database,
  key: string,
  operationType: string,
  operation: () => Promise<T>,
  options?: IdempotentWriteOptions,
): Promise<IdempotentWriteResult<T>> {
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;

  // Step 1: Check if already processed
  const existing = await db
    .select({
      key: idempotencyKeys.key,
      expiresAt: idempotencyKeys.expiresAt,
      result: idempotencyKeys.result,
    })
    .from(idempotencyKeys)
    .where(eq(idempotencyKeys.key, key))
    .limit(1);

  const row = existing[0];
  if (row) {
    // Check if expired
    if (!row.expiresAt || row.expiresAt >= new Date()) {
      // Replay — surface the cached result when the original write opted
      // in via `cacheResult: true`. Callers that didn't opt in get
      // `alreadyProcessed: true` and `result: undefined` as before.
      return {
        alreadyProcessed: true,
        result: (row.result ?? undefined) as T | undefined,
      };
    }
    // Expired  -  clean up and proceed
    await db.delete(idempotencyKeys).where(eq(idempotencyKeys.key, key));
  }

  // Step 2: Execute the operation
  const result = await operation();

  // Step 3: Record the idempotency key
  const expiresAt = new Date(Date.now() + ttlMs);
  const resultData =
    options?.cacheResult && result !== null && typeof result === 'object'
      ? (result as Record<string, unknown>)
      : undefined;

  await db
    .insert(idempotencyKeys)
    .values({
      key,
      operationType,
      result: resultData,
      createdAt: new Date(),
      expiresAt,
    })
    .onConflictDoNothing();

  return { result, alreadyProcessed: false };
}
