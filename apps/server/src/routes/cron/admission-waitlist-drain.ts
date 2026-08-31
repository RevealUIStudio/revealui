/**
 * Cron: admission waitlist drain (GAP-256 PR-8)
 *
 * Marks stale pending/invited claim rows expired. Schedule is via the
 * consolidated Hobby dispatcher (`/api/cron/dispatch` daily 06:00 UTC) —
 * not a second vercel.json cron entry (platform one-cron limit).
 *
 * Flag: ADMISSION_WAITLIST_DRAIN_ENABLED=true required; otherwise no-op 200.
 *
 * Protected by X-Cron-Secret (also validated in dispatch.ts).
 */

import { timingSafeEqual } from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import { Hono } from 'hono';
import { runAdmissionWaitlistDrain } from '../../lib/admission-waitlist-drain-run.js';

const app = new Hono();

function unauthorized(): Response {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}

function authorizeCron(c: { req: { header: (n: string) => string | undefined } }): boolean {
  const cronSecret = process.env.REVEALUI_CRON_SECRET;
  const provided = c.req.header('X-Cron-Secret') || c.req.header('x-cron-secret');
  if (!(cronSecret && provided)) {
    return false;
  }
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(cronSecret);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

app.post('/admission-waitlist-drain', async (c) => {
  if (!authorizeCron(c)) {
    return unauthorized();
  }

  try {
    const result = await runAdmissionWaitlistDrain();
    if (result.skipped) {
      logger.info('[cron-admission-waitlist-drain] skipped', { reason: result.reason });
      return c.json({ ok: true, skipped: true, reason: result.reason });
    }
    return c.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[cron-admission-waitlist-drain] failed: ${message}`);
    return c.json({ ok: false, error: message }, 500);
  }
});

export default app;
