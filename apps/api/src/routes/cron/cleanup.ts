/**
 * Cron: Stale Data Cleanup
 *
 * Deletes expired sessions, rate limits, password reset tokens, magic links,
 * publishes overdue scheduled pages, recovers stuck sagas, cleans up expired
 * idempotency keys, and purges old log rows past the retention window.
 * Piggybacks on the daily cron dispatcher.
 *
 * Protected by X-Cron-Secret header (defense-in-depth  -  also validated in dispatch.ts).
 */

import { timingSafeEqual } from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db';
import { cleanupOldLogs, cleanupStaleTokens } from '@revealui/db/cleanup';
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

    // Log retention purge: app_logs + error_events past the configured window.
    // Non-fatal — logged and reported but does not fail the cron if it errors.
    let logsPurged = { appLogs: 0, errorEvents: 0, retentionDays: 0 };
    try {
      const logsResult = await cleanupOldLogs();
      logsPurged = {
        appLogs: logsResult.appLogs,
        errorEvents: logsResult.errorEvents,
        retentionDays: logsResult.retentionDays,
      };
      if (logsResult.appLogs > 0 || logsResult.errorEvents > 0) {
        logger.info('[cron-cleanup] Purged logs past retention window', {
          appLogs: logsResult.appLogs,
          errorEvents: logsResult.errorEvents,
          retentionDays: logsResult.retentionDays,
          cutoff: logsResult.cutoff.toISOString(),
        });
      }
    } catch (logErr) {
      const message = logErr instanceof Error ? logErr.message : String(logErr);
      logger.error(`[cron-cleanup] Log retention purge failed: ${message}`);
    }

    return c.json({
      success: true,
      ...result,
      total,
      recoveredSagas,
      expiredIdempotencyKeys: expiredKeys,
      logsPurged,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[cron-cleanup] Failed: ${message}`);
    return c.json({ success: false, error: 'Stale token cleanup failed' }, 500);
  }
});

export default app;
