/**
 * Waitlist Routes — Public Email-Capture Endpoint
 *
 * POST /api/waitlist        — Capture an email against a named source
 * POST /api/v1/waitlist     — Same, versioned alias
 *
 * Public (unauthenticated). Rate-limited at the app level
 * (5 req / 15 min / IP, applied in index.ts via rateLimitMiddleware).
 *
 * Backed by the `waitlist` table (packages/db/src/schema/waitlist.ts):
 * email (unique), source, referrer, user_agent, ip_address, created_at,
 * notified_at. The `source` column is the segmentation key — signups are
 * queryable per source (e.g. `WHERE source = 'managed-cloud'`).
 *
 * Used by:
 *   - revealui.com /for-operators/managed — RevealUI Cloud waitlist
 *     (source: 'managed-cloud')
 *   - revealui.com footer + GetStarted     — newsletter capture
 *     (source: 'newsletter')
 *
 * Email uniqueness is on `email` alone (not composite with source), so a
 * repeat signup with a different source updates the row to the latest
 * intent (ON CONFLICT (email) DO UPDATE). For pre-revenue volume this is
 * the right default; a composite (email, source) unique is a future
 * migration if multi-list membership per email becomes load-bearing.
 *
 * Honeypot: a hidden `website` field. Submissions with a non-empty value
 * are silently 200'd (no DB write) so bots don't learn.
 */

import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db';
import type { DatabaseClient } from '@revealui/db/client';
import { waitlist } from '@revealui/db/schema';
import { zValidator } from '@revealui/openapi';
import { Hono } from 'hono';
import { z } from 'zod';

// Closed enum keeps the segmentation column clean + queryable. Add a source
// here when a new capture surface ships — a one-line API change, deliberate
// so the `source` dimension never accumulates free-text drift.
const WAITLIST_SOURCES = ['managed-cloud', 'newsletter', 'landing-page', 'blog'] as const;

const WaitlistSchema = z.object({
  // Normalize before validation so '  OP@Example.COM ' → 'op@example.com'.
  email: z.string().trim().toLowerCase().email().max(254),
  source: z.enum(WAITLIST_SOURCES).default('landing-page'),
  // Honeypot — hidden via CSS in the form. Bots fill it; humans don't.
  // Left unconstrained so a filled value reaches the handler and is silently
  // 200'd (a max(0) reject would 400, handing bots a signal).
  website: z.string().optional(),
});

type WaitlistInput = z.infer<typeof WaitlistSchema>;

// `db` is injected by middleware in some contexts; fall back to getClient().
type WaitlistVariables = { db?: DatabaseClient };

const app = new Hono<{ Variables: WaitlistVariables }>();

/**
 * POST /
 * Captures an email against a source. Idempotent on email: a repeat signup
 * refreshes source + request metadata to the latest submission.
 */
app.post('/', zValidator('json', WaitlistSchema), async (c) => {
  const body = c.req.valid('json') as WaitlistInput;
  const ip = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? null;
  const referrer = c.req.header('referer') ?? c.req.header('referrer') ?? null;
  const userAgent = c.req.header('user-agent') ?? null;

  // Honeypot trip — silently 200 to deny bots a signal
  if (body.website !== undefined && body.website.length > 0) {
    logger.warn('Waitlist honeypot triggered', { ip, source: body.source });
    return c.json({ success: true }, 200);
  }

  // email is already trimmed + lowercased by the schema transform.
  const email = body.email;

  try {
    const db = c.get('db') ?? getClient();
    await db
      .insert(waitlist)
      .values({
        email,
        source: body.source,
        referrer,
        userAgent,
        ipAddress: ip,
      })
      .onConflictDoUpdate({
        target: waitlist.email,
        set: {
          source: body.source,
          referrer,
          userAgent,
          ipAddress: ip,
        },
      });

    logger.info('Waitlist signup captured', { source: body.source });

    return c.json({ success: true }, 200);
  } catch (err) {
    logger.error('Waitlist signup failed', {
      err: err instanceof Error ? err.message : String(err),
      source: body.source,
    });
    return c.json(
      {
        success: false,
        error: 'Could not record your signup. Please try again in a few minutes.',
      },
      500,
    );
  }
});

export default app;
