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
 * `notified_at` is reserved for the launch broadcast (when the whole waitlist
 * is emailed that access has opened); it is deliberately NOT set on signup.
 *
 * Used by:
 *   - revealui.com /for-operators/managed — RevealUI Cloud waitlist
 *     (source: 'managed-cloud')
 *   - revealui.com footer + GetStarted     — newsletter capture
 *     (source: 'newsletter')
 *
 * Notifications (LEAD sources only — 'managed-cloud', 'landing-page'):
 *   - the operator team gets an alert email (Reply-To the lead) so a
 *     high-intent signup is acted on immediately, not left sitting in a table;
 *   - the lead gets a confirmation email closing the loop.
 *   Both are best-effort: the row has already been written, so an email
 *   failure is logged and swallowed, never turning a successful capture into a
 *   500. Newsletter / blog signups are list subscriptions (a separate
 *   double-opt-in concern) and are intentionally not emailed here.
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
import { sanitizeEmailHeader, sendEmail } from '../lib/email.js';
import { escapeHtml } from '../lib/html.js';

// Closed enum keeps the segmentation column clean + queryable. Add a source
// here when a new capture surface ships — a one-line API change, deliberate
// so the `source` dimension never accumulates free-text drift.
const WAITLIST_SOURCES = ['managed-cloud', 'newsletter', 'landing-page', 'blog'] as const;

// Sources that represent a product LEAD (vs. a newsletter subscription). Only
// these trigger a team alert + subscriber confirmation; newsletter/blog are
// list subscriptions handled separately.
const LEAD_SOURCES = new Set<string>(['managed-cloud', 'landing-page']);

// Operator inbox for new-lead alerts. Validated at startup
// (lib/validate-startup.ts); the founder fallback matches the other server
// alert paths (cron-alerts, webhooks, billing-readiness).
const ALERT_EMAIL = process.env.REVEALUI_ALERT_EMAIL ?? 'founder@revealui.com';

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

interface LeadNotifyContext {
  email: string;
  source: string;
  referrer: string | null;
  ipAddress: string | null;
}

interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

/** Builds the subscriber-facing confirmation email content for a new lead. */
function buildConfirmationEmail(): EmailContent {
  return {
    subject: 'You are on the RevealUI waitlist',
    html: [
      '<h2>You are on the list</h2>',
      '<p>Thanks for your interest in RevealUI. We will email you the moment access opens.</p>',
      '<p>The RevealUI team</p>',
    ].join('\n'),
    text: [
      'You are on the list',
      '',
      'Thanks for your interest in RevealUI. We will email you the moment access opens.',
      '',
      'The RevealUI team',
    ].join('\n'),
  };
}

/**
 * Send the operator alert + the subscriber confirmation for a new lead.
 * Best-effort: every failure is logged and swallowed so a capture that has
 * already been written to the DB still returns success.
 */
async function sendLeadNotifications(ctx: LeadNotifyContext): Promise<void> {
  const { email, source } = ctx;
  const safeEmail = escapeHtml(email);
  const safeSource = escapeHtml(source);
  const safeReferrer = escapeHtml(ctx.referrer ?? '(none)');
  const safeIp = escapeHtml(ctx.ipAddress ?? '(none)');

  const teamAlert = sendEmail({
    to: ALERT_EMAIL,
    replyTo: email,
    subject: sanitizeEmailHeader(`[waitlist:${source}] new signup`),
    html: [
      '<h2>New waitlist signup</h2>',
      `<p><strong>Email:</strong> ${safeEmail}</p>`,
      `<p><strong>Source:</strong> ${safeSource}</p>`,
      `<p><strong>Referrer:</strong> ${safeReferrer}</p>`,
      `<p><strong>IP:</strong> ${safeIp}</p>`,
    ].join('\n'),
    text: [
      'New waitlist signup',
      `Email: ${email}`,
      `Source: ${source}`,
      `Referrer: ${ctx.referrer ?? '(none)'}`,
      `IP: ${ctx.ipAddress ?? '(none)'}`,
    ].join('\n'),
  });

  const confirmationContent = buildConfirmationEmail();
  const confirmation = sendEmail({
    to: email,
    subject: confirmationContent.subject,
    html: confirmationContent.html,
    text: confirmationContent.text,
  });

  const results = await Promise.allSettled([teamAlert, confirmation]);
  for (const r of results) {
    if (r.status === 'rejected') {
      logger.warn('Waitlist notification email failed', {
        source,
        err: r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    }
  }
}

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

    // Lead sources get an operator alert + a subscriber confirmation. The
    // capture has already persisted, so sendLeadNotifications swallows its own
    // failures — it can never turn a successful signup into a 500.
    if (LEAD_SOURCES.has(body.source)) {
      await sendLeadNotifications({ email, source: body.source, referrer, ipAddress: ip });
    }

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
