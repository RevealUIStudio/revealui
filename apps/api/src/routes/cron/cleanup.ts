/**
 * Cron: Stale Token Cleanup
 *
 * Deletes expired sessions, rate limits, password reset tokens, magic links,
 * and publishes overdue scheduled pages. Piggybacks on the daily cron dispatcher.
 *
 * Protected by X-Cron-Secret (validated in dispatch.ts).
 */

import { logger } from '@revealui/core/observability/logger';
import { cleanupStaleTokens } from '@revealui/db/cleanup';
import { Hono } from 'hono';

const app = new Hono();

app.post('/cleanup', async (c) => {
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

    return c.json({ success: true, ...result, total });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[cron-cleanup] Failed: ${message}`);
    return c.json({ success: false, error: 'Stale token cleanup failed' }, 500);
  }
});

export default app;
