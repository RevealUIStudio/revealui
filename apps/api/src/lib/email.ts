/**
 * Edge-compatible email sender for the API service.
 *
 * Uses Gmail REST API with domain-wide delegation.
 * No Node.js-only dependencies — fully edge-compatible (fetch + jose).
 *
 * Required env vars:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL — GCP service account email
 *   GOOGLE_PRIVATE_KEY           — RSA private key (PKCS8 PEM)
 *   EMAIL_FROM                   — sender address (e.g. noreply@revealui.com)
 *   EMAIL_REPLY_TO               — default reply-to (e.g. support@revealui.com)
 */

import { logger } from '@revealui/core/observability/logger';
import { importPKCS8, SignJWT } from 'jose';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export function sanitizeEmailHeader(value: string): string {
  return value.replace(/[\r\n]/g, '');
}

// ---------------------------------------------------------------------------
// Gmail REST API provider (edge-compatible)
// ---------------------------------------------------------------------------

interface GmailConfig {
  serviceAccountEmail: string;
  privateKey: string;
  /** The Workspace user to impersonate (must have Gmail enabled). */
  delegateEmail: string;
}

function getGmailConfig(): GmailConfig | null {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const delegateEmail = process.env.EMAIL_FROM ?? 'noreply@revealui.com';

  if (!(serviceAccountEmail && privateKey)) return null;
  return { serviceAccountEmail, privateKey, delegateEmail };
}

async function getGmailAccessToken(cfg: GmailConfig): Promise<string> {
  const key = await importPKCS8(cfg.privateKey.replace(/\\n/g, '\n'), 'RS256');

  const now = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({
    scope: 'https://www.googleapis.com/auth/gmail.send',
    sub: cfg.delegateEmail,
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(cfg.serviceAccountEmail)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    throw new Error(`Google OAuth2 token exchange failed (${tokenRes.status}): ${body}`);
  }

  const { access_token } = (await tokenRes.json()) as { access_token: string };
  return access_token;
}

function buildRawMessage(
  from: string,
  to: string,
  subject: string,
  html: string,
  text?: string,
  replyTo?: string,
): string {
  const boundary = `boundary_${Date.now().toString(36)}`;
  const effectiveReplyTo = replyTo ?? process.env.EMAIL_REPLY_TO;

  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  if (effectiveReplyTo) {
    lines.push(`Reply-To: ${sanitizeEmailHeader(effectiveReplyTo)}`);
  }

  lines.push('');

  if (text) {
    lines.push(`--${boundary}`, 'Content-Type: text/plain; charset="UTF-8"', '', text, '');
  }

  lines.push(`--${boundary}`, 'Content-Type: text/html; charset="UTF-8"', '', html, '');
  lines.push(`--${boundary}--`);

  const raw = lines.join('\r\n');
  const bytes = new TextEncoder().encode(raw);
  let b64 = '';
  for (let i = 0; i < bytes.length; i += 4096) {
    b64 += String.fromCharCode(...bytes.subarray(i, i + 4096));
  }
  return btoa(b64).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sendViaGmail(cfg: GmailConfig, options: EmailOptions): Promise<void> {
  const accessToken = await getGmailAccessToken(cfg);

  const raw = buildRawMessage(
    cfg.delegateEmail,
    sanitizeEmailHeader(options.to),
    sanitizeEmailHeader(options.subject),
    options.html,
    options.text,
    options.replyTo,
  );

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gmail API error (${res.status}): ${body}`);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function sendEmail(options: EmailOptions): Promise<void> {
  // Gmail REST API (edge-compatible, free with Workspace)
  const gmailConfig = getGmailConfig();
  if (gmailConfig) {
    await sendViaGmail(gmailConfig, options);
    return;
  }

  // No provider — in production, throw so callers (e.g. OTP flows) can
  // surface the delivery failure instead of silently succeeding.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('No email provider configured');
  }

  // Development: log and continue
  logger.warn('Email not sent — no provider configured', {
    to: options.to,
    subject: options.subject,
  });
}
