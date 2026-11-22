import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { createPool } from './pool.js';
import { reviewControllerSchema } from './schema/internal/review-controller.js';

export {
  reviewControllerReceiptAuthorizations,
  reviewControllerSchema,
  reviewControllerShadowObservations,
  reviewControllerSignedReceipts,
  reviewControllerWebhookInbox,
} from './schema/internal/review-controller.js';

export type ReviewControllerDatabase = ReturnType<typeof createReviewControllerDatabase>['db'];

/** A dedicated pool and Drizzle client for the isolated review controller store. */
export function createReviewControllerDatabase(connectionString: string) {
  if (!connectionString.trim()) throw new Error('review_controller_database_url_required');
  const pool = createPool({ connectionString, max: 5 });
  const db = drizzle(pool, { schema: reviewControllerSchema });
  return { db, close: () => pool.end() };
}

/** Dedicated physical session pool for full-operation advisory locks.
 * Never use transaction pooling: losing a session releases its lock.
 * Kept separate from evidence queries so lock waiters cannot starve them.
 */
export function createReviewControllerPublicationPool(connectionString: string) {
  if (!connectionString.trim()) throw new Error('review_controller_database_url_required');
  return new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 10_000,
    query_timeout: 60_000,
  });
}

export type ReviewControllerPublicationPool = Pick<Pool, 'connect'>;

export {
  reviewControllerMergeIntents,
  reviewControllerMergeReconciliationObservations,
} from './schema/internal/review-controller-merge.js';
