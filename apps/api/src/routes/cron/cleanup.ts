/**
 * Cron: Stale Data Cleanup
 *
 * Deletes expired sessions, rate limits, password reset tokens, magic links,
 * publishes overdue scheduled pages, recovers stuck sagas, and cleans up
 * expired idempotency keys. Piggybacks on the daily cron dispatcher.
 *
 * Protected by X-Cron-Secret header (defense-in-depth  -  also validated in dispatch.ts).
 */

import { timingSafeEqual } from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db';
import { cleanupStaleTokens } from '@revealui/db/cleanup';
import { cleanupExpiredIdempotencyKeys, recoverStaleSagas } from '@revealui/db/saga';
import { Hono } from 'hono';

const app = new Hono();

app.post('/cleanup', async (c) => {
  // Defense-in-depth: validate cron secret even though dispatch.ts also checks.
  // Prevents unauthorized access if the route is called directly.
  const cronSecret = process.env.REVEALUI_CRON_SECRET;
  const provided = c.req.header('X-Cron-Secret') || c.req.header('x-cron-secret');

  if (!(cronSecret && provided)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(cronSecret);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
  } catch {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const result = await cleanupStaleTokens();

    const total =
      result.sessions +
      result.rateLimits +
      result.passwordResetTokens +
      result.magicLinks +
      result.scheduledPages;

    logger.info('[cron-cleanup] Stale token cleanup completed', {
      sessions: result.sessions,
      rateLimits: result.rateLimits,
      passwordResetTokens: result.passwordResetTokens,
      magicLinks: result.magicLinks,
      scheduledPages: result.scheduledPages,
      total,
    });

    // Saga recovery: find stuck sagas and mark them as failed
    let recoveredSagas = 0;
    let expiredKeys = 0;
    try {
      const db = getClient();
      const recovered = await recoverStaleSagas(db);
      recoveredSagas = recovered.length;
      if (recoveredSagas > 0) {
        logger.warn('[cron-cleanup] Recovered stuck sagas', {
          count: recoveredSagas,
          sagas: recovered.map((s) => ({
            sagaId: s.sagaId,
            sagaName: s.sagaName,
            completedSteps: s.completedSteps,
          })),
        });
      }

      // Clean up expired idempotency keys to prevent table growth
      expiredKeys = await cleanupExpiredIdempotencyKeys(db);
      if (expiredKeys > 0) {
        logger.info('[cron-cleanup] Cleaned up expired idempotency keys', {
          count: expiredKeys,
        });
      }
    } catch (sagaErr) {
      // Non-fatal  -  token cleanup already succeeded
      const message = sagaErr instanceof Error ? sagaErr.message : String(sagaErr);
      logger.error(`[cron-cleanup] Saga recovery/cleanup failed: ${message}`);
    }

    return c.json({
      success: true,
      ...result,
      total,
      recoveredSagas,
      expiredIdempotencyKeys: expiredKeys,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[cron-cleanup] Failed: ${message}`);
    return c.json({ success: false, error: 'Stale token cleanup failed' }, 500);
  }
});

export default app;
