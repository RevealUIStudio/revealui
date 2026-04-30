/**
 * Contact Routes — Public Inquiry Endpoint
 *
 * POST /api/contact         — Submit a contact-form inquiry
 * POST /api/v1/contact      — Same, versioned alias
 *
 * Public (unauthenticated). Rate-limited at the app level
 * (5 req / 15 min / IP, applied in index.ts via rateLimitMiddleware).
 *
 * Used by:
 *   - revealuistudio.com  — agency-site contact form (RevealUIStudio/agency)
 *   - revealui.com         — marketing-site contact form (apps/marketing)
 *
 * Honeypot: a hidden `website` field. Submissions with a non-empty
 * value are silently 200'd (no email sent) so bots don't learn.
 *
 * Email delivery uses lib/email.ts (Gmail REST API + domain-wide
 * delegation via service account). When env vars are missing in
 * non-prod, sendEmail logs and returns; in production it throws,
 * which we map to a 500 with a helpful message.
 */

import { logger } from '@revealui/core/observability/logger';
import { zValidator } from '@revealui/openapi';
import { Hono } from 'hono';
import { z } from 'zod';
import { sendEmail } from '../lib/email.js';

// Permissive enum — accommodates both marketing and agency form topics
// without coupling them. The full set is validated downstream by length cap
// rather than a closed enum so either form can add topics without an API
// change. We log the raw topic in the email subject; misuse is caught by
// rate limiting + honeypot, not topic validation.
const ContactInquirySchema = z.object({
  source: z.enum(['agency', 'marketing']).default('marketing'),
  topic: z.string().min(1).max(40),
  name: z.string().min(2).max(120).trim(),
  email: z.string().email().max(254),
  company: z.string().max(120).trim().optional(),
  message: z.string().min(20).max(5000).trim(),
  // Honeypot — hidden via CSS in the form. Bots fill it; humans don't.
  website: z.string().max(0).optional(),
});

type ContactInquiry = z.infer<typeof ContactInquirySchema>;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildEmailSubject(body: ContactInquiry): string {
  const tag = body.source === 'agency' ? '[agency]' : '[marketing]';
  return `${tag} ${body.topic} — ${body.name}`;
}

function buildEmailHtml(body: ContactInquiry): string {
  const lines = [
    `<h2>New ${escapeHtml(body.source)} inquiry</h2>`,
    `<p><strong>From:</strong> ${escapeHtml(body.name)} &lt;${escapeHtml(body.email)}&gt;</p>`,
  ];
  if (body.company) {
    lines.push(`<p><strong>Company:</strong> ${escapeHtml(body.company)}</p>`);
  }
  lines.push(`<p><strong>Topic:</strong> ${escapeHtml(body.topic)}</p>`);
  lines.push('<hr/>');
  lines.push(`<div>${escapeHtml(body.message).replace(/\n/g, '<br/>')}</div>`);
  return lines.join('\n');
}

function buildEmailText(body: ContactInquiry): string {
  const lines = [`New ${body.source} inquiry`, `From: ${body.name} <${body.email}>`];
  if (body.company) lines.push(`Company: ${body.company}`);
  lines.push(`Topic: ${body.topic}`);
  lines.push('');
  lines.push(body.message);
  return lines.join('\n');
}

const app = new Hono();

/**
 * POST /
 * Submits a contact inquiry — sends a notification email to the founder
 * inbox with the user's email set as Reply-To.
 */
app.post('/', zValidator('json', ContactInquirySchema), async (c) => {
  const body = c.req.valid('json') as ContactInquiry;
  const ip = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip');

  // Honeypot trip — silently 200 to deny bots a signal
  if (body.website !== undefined && body.website.length > 0) {
    logger.warn('Contact form honeypot triggered', { ip, source: body.source });
    return c.json({ success: true }, 200);
  }

  try {
    await sendEmail({
      to: 'founder@revealui.com',
      subject: buildEmailSubject(body),
      html: buildEmailHtml(body),
      text: buildEmailText(body),
      replyTo: body.email,
    });

    logger.info('Contact form submitted', {
      source: body.source,
      topic: body.topic,
      from: body.email,
      ip,
    });

    return c.json({ success: true }, 200);
  } catch (err) {
    logger.error('Contact form email send failed', {
      err: err instanceof Error ? err.message : String(err),
      source: body.source,
    });
    return c.json(
      {
        success: false,
        error:
          'Could not deliver your message. Please email founder@revealui.com directly and reference your request.',
      },
      500,
    );
  }
});

export default app;
