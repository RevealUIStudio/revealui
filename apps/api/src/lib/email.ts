/**
 * Edge-compatible email sender for the API service.
 *
 * Provider priority:
 *   1. Gmail REST API  (GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY)
 *   2. Resend API      (RESEND_API_KEY)
 *   3. Mock / throw    (development logs, production throws)
 *
 * Gmail uses a Google Workspace service account with domain-wide delegation
 * to send as EMAIL_FROM (e.g. noreply@revealui.com) via the Gmail REST API.
 * No Node.js-only dependencies — fully edge-compatible (fetch + jose).
 */

import { logger } from '@revealui/core/observability/logger';
import { importPKCS8, SignJWT } from 'jose';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
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
  const delegateEmail =
    process.env.EMAIL_FROM ?? process.env.RESEND_FROM_EMAIL ?? 'noreply@revealui.com';

  if (!(serviceAccountEmail && privateKey)) return null;
  return { serviceAccountEmail, privateKey, delegateEmail };
}

async function getGmailAccessToken(config: GmailConfig): Promise<string> {
  const key = await importPKCS8(config.privateKey.replace(/\\n/g, '\n'), 'RS256');

  const now = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({
    scope: 'https://www.googleapis.com/auth/gmail.send',
    sub: config.delegateEmail,
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(config.serviceAccountEmail)
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
): string {
  const boundary = `boundary_${Date.now().toString(36)}`;

  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
  ];

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

async function sendViaGmail(config: GmailConfig, options: EmailOptions): Promise<void> {
  const accessToken = await getGmailAccessToken(config);

  const raw = buildRawMessage(
    config.delegateEmail,
    sanitizeEmailHeader(options.to),
    sanitizeEmailHeader(options.subject),
    options.html,
    options.text,
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
// Resend API provider
// ---------------------------------------------------------------------------

async function sendViaResend(options: EmailOptions): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail =
    process.env.RESEND_FROM_EMAIL ?? process.env.EMAIL_FROM ?? 'noreply@revealui.com';

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: sanitizeEmailHeader(options.to),
      subject: sanitizeEmailHeader(options.subject),
      html: options.html,
      text: options.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend API error (${response.status}): ${body}`);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function sendEmail(options: EmailOptions): Promise<void> {
  // 1. Gmail REST API (preferred — edge-compatible, free with Workspace)
  const gmailConfig = getGmailConfig();
  if (gmailConfig) {
    await sendViaGmail(gmailConfig, options);
    return;
  }

  // 2. Resend API (fallback)
  if (process.env.RESEND_API_KEY) {
    await sendViaResend(options);
    return;
  }

  // 3. Mock in development, throw in production
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Mock email sent (no email provider configured)', {
      to: options.to,
      subject: options.subject,
    });
    return;
  }

  throw new Error(
    'No email provider configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY, or RESEND_API_KEY.',
  );
}
