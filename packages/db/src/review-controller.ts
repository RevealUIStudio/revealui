import { drizzle } from 'drizzle-orm/node-postgres';
import { createPool } from './pool.js';
import { reviewControllerSchema } from './schema/internal/review-controller.js';

export {
  reviewControllerShadowObservations,
  reviewControllerSignedReceipts,
  reviewControllerWebhookInbox,
} from './schema/internal/review-controller.js';
export { reviewControllerSchema } from './schema/internal/review-controller.js';

export type ReviewControllerDatabase = ReturnType<typeof createReviewControllerDatabase>['db'];

/** A dedicated pool and Drizzle client for the isolated review controller store. */
export function createReviewControllerDatabase(connectionString: string) {
  if (!connectionString.trim()) throw new Error('review_controller_database_url_required');
  const pool = createPool({ connectionString, max: 5 });
  const db = drizzle(pool, { schema: reviewControllerSchema });
  return { db, close: () => pool.end() };
}
