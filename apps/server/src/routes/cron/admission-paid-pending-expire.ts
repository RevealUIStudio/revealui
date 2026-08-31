/**
 * Cron: paid-pending expire (GAP-256 PR-8 optional reclaim)
 *
 * Suspends unpaid paid_signup accounts after TTL (default 48h). Schedule is
 * via the consolidated Hobby dispatcher — not a second vercel.json cron.
 *
 * Flag: ADMISSION_PAID_PENDING_EXPIRE_ENABLED=true required; otherwise no-op 200.
 *
 * Protected by X-Cron-Secret (also validated in dispatch.ts).
 */

import { timingSafeEqual } from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db';
import { Hono } from 'hono';
import { runAdmissionPaidPendingExpire } from '../../lib/admission-paid-pending-expire-run.js';

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

app.post('/admission-paid-pending-expire', async (c) => {
  if (!authorizeCron(c)) {
    return unauthorized();
  }

  try {
    const result = await runAdmissionPaidPendingExpire(getClient());
    if (result.skipped) {
      logger.info('[cron-admission-paid-pending-expire] skipped', { reason: result.reason });
      return c.json({ ok: true, skipped: true, reason: result.reason });
    }
    return c.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[cron-admission-paid-pending-expire] failed: ${message}`);
    return c.json({ ok: false, error: message }, 500);
  }
});

export default app;
