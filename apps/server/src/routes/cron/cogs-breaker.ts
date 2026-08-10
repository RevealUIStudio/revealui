import { timingSafeEqual } from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db';
import { Hono } from 'hono';
import { runCogsBreakerSweep } from '../../lib/cogs-breaker-run.js';

const app = new Hono();

function authorizeCron(c: { req: { header: (n: string) => string | undefined } }): boolean {
  const cronSecret = process.env.REVEALUI_CRON_SECRET;
  const provided = c.req.header('X-Cron-Secret') || c.req.header('x-cron-secret');
  if (!(cronSecret && provided)) return false;
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(cronSecret);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

app.post('/cogs-breaker', async (c) => {
  if (!authorizeCron(c)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await runCogsBreakerSweep(getClient());
    if (result.skipped) {
      logger.info('[cron-cogs-breaker] skipped', { reason: result.reason });
      return c.json({ ok: true, skipped: true, reason: result.reason });
    }
    return c.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[cron-cogs-breaker] failed: ${message}`);
    return c.json({ ok: false, error: message }, 500);
  }
});

export default app;
