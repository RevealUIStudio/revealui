/**
 * Cron: Publish Scheduled Content
 *
 * Finds pages with scheduledAt <= now and transitions them to published status.
 * Protected by X-Cron-Secret header.
 *
 * Schedule: every 5 minutes (configured in vercel.json)
 */

import { timingSafeEqual } from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db/client';
import { pages } from '@revealui/db/schema';
import { and, eq, isNotNull, lte } from 'drizzle-orm';
import { Hono } from 'hono';

const app = new Hono();

app.post('/publish-scheduled', async (c) => {
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
    const db = getClient();
    const now = new Date();

    const scheduledPages = await db
      .select({ id: pages.id, title: pages.title })
      .from(pages)
      .where(
        and(
          eq(pages.status, 'scheduled'),
          isNotNull(pages.scheduledAt),
          lte(pages.scheduledAt, now),
        ),
      );

    if (scheduledPages.length === 0) {
      return c.json({ published: 0, ids: [] }, 200);
    }

    const publishedIds: string[] = [];
    for (const page of scheduledPages) {
      await db
        .update(pages)
        .set({ status: 'published', publishedAt: now, updatedAt: now })
        .where(eq(pages.id, page.id));
      publishedIds.push(page.id);
    }

    return c.json({ published: publishedIds.length, ids: publishedIds }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Scheduled publish failed', undefined, { error: message });
    return c.json({ error: 'Internal error during scheduled publish' }, 500);
  }
});

export default app;
