/**
 * Cron: Margin snapshot (GAP-256 PR-2)
 *
 * Computes daily free/paid COGS from usage_meters + paid MRR attribution,
 * writes margin_snapshots (and account_margin_daily). Schedule is via the
 * consolidated Hobby dispatcher (`/api/cron/dispatch` daily 06:00 UTC) —
 * not a second vercel.json cron entry (platform one-cron limit).
 *
 * Flag: MARGIN_SNAPSHOT_CRON_ENABLED=true required to write; otherwise no-op 200.
 *
 * Protected by X-Cron-Secret (also validated in dispatch.ts).
 */

import { timingSafeEqual } from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db';
import { Hono } from 'hono';
import { runMarginSnapshot } from '../../lib/margin-snapshot-run.js';

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

app.post('/margin-snapshot', async (c) => {
  if (!authorizeCron(c)) {
    return unauthorized();
  }

  try {
    const db = getClient();
    const result = await runMarginSnapshot(db);
    if (result.skipped) {
      logger.info('[cron-margin-snapshot] skipped', { reason: result.reason });
      return c.json({ ok: true, skipped: true, reason: result.reason });
    }
    return c.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[cron-margin-snapshot] failed: ${message}`);
    return c.json({ ok: false, error: message }, 500);
  }
});

export default app;
