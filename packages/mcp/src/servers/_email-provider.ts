/**
 * Email provider for MCP servers.
 *
 * Provider priority:
 *   1. Gmail REST API  (GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY)
 *   2. SMTP            (SMTP_HOST + SMTP_USER + SMTP_PASS)
 *   3. Resend API      (RESEND_API_KEY) — deprecated, kept as fallback
 *
 * Gmail uses a Google Workspace service account with domain-wide delegation
 * to send as EMAIL_FROM via the Gmail REST API. Edge-compatible (fetch + jose).
 */

import { importPKCS8, SignJWT } from 'jose';

export interface EmailPayload {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  reply_to?: string;
  tags?: Array<{ name: string; value: string }>;
}

export interface EmailResult {
  provider: 'gmail' | 'resend';
  id?: string;
  data?: unknown;
}

// ---------------------------------------------------------------------------
// Gmail REST API provider
// ---------------------------------------------------------------------------

interface GmailConfig {
  serviceAccountEmail: string;
  privateKey: string;
  delegateEmail: string;
}

function getGmailConfig(overrides: Record<string, string>): GmailConfig | null {
  const serviceAccountEmail =
    overrides.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = overrides.GOOGLE_PRIVATE_KEY ?? process.env.GOOGLE_PRIVATE_KEY;
  const delegateEmail =
    overrides.EMAIL_FROM ??
    process.env.EMAIL_FROM ??
    overrides.REVEALUI_FROM_EMAIL ??
    process.env.REVEALUI_FROM_EMAIL ??
    'noreply@revealui.com';

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

function buildRawMessage(payload: EmailPayload): string {
  const to = Array.isArray(payload.to) ? payload.to.join(', ') : payload.to;
  const boundary = `boundary_${Date.now().toString(36)}`;

  const lines = [
    `From: ${payload.from}`,
    `To: ${to}`,
    `Subject: ${payload.subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  const replyTo = payload.reply_to ?? process.env.EMAIL_REPLY_TO;
  if (replyTo) {
    lines.push(`Reply-To: ${replyTo}`);
  }

  lines.push('');

  if (payload.text) {
    lines.push(`--${boundary}`, 'Content-Type: text/plain; charset="UTF-8"', '', payload.text, '');
  }

  if (payload.html) {
    lines.push(`--${boundary}`, 'Content-Type: text/html; charset="UTF-8"', '', payload.html, '');
  }

  lines.push(`--${boundary}--`);

  const raw = lines.join('\r\n');
  const bytes = new TextEncoder().encode(raw);
  let b64 = '';
  for (let i = 0; i < bytes.length; i += 4096) {
    b64 += String.fromCharCode(...bytes.subarray(i, i + 4096));
  }
  return btoa(b64).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sendViaGmail(config: GmailConfig, payload: EmailPayload): Promise<EmailResult> {
  const accessToken = await getGmailAccessToken(config);
  const raw = buildRawMessage({ ...payload, from: config.delegateEmail });

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

  const data = (await res.json()) as { id?: string };
  return { provider: 'gmail', id: data.id, data };
}

// ---------------------------------------------------------------------------
// Resend API provider (deprecated fallback)
// ---------------------------------------------------------------------------

async function sendViaResend(apiKey: string, payload: EmailPayload): Promise<EmailResult> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'RevealUI-MCP/1.0',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as { message?: string }).message ?? `Resend ${res.status}`);
  }

  return { provider: 'resend', data };
}

// ---------------------------------------------------------------------------
// Batch send via Resend (no Gmail batch API equivalent)
// ---------------------------------------------------------------------------

async function batchSendViaResend(apiKey: string, payloads: EmailPayload[]): Promise<EmailResult> {
  const res = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'RevealUI-MCP/1.0',
    },
    body: JSON.stringify(payloads),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as { message?: string }).message ?? `Resend batch ${res.status}`);
  }

  return { provider: 'resend', data };
}

// ---------------------------------------------------------------------------
// Public API — auto-detects provider
// ---------------------------------------------------------------------------

/**
 * Send a single email using the best available provider.
 * Gmail REST API is preferred; falls back to Resend if Gmail is not configured.
 */
export async function sendEmail(
  payload: EmailPayload,
  overrides: Record<string, string> = {},
): Promise<EmailResult> {
  // 1. Gmail REST API (preferred)
  const gmailConfig = getGmailConfig(overrides);
  if (gmailConfig) {
    return sendViaGmail(gmailConfig, payload);
  }

  // 2. Resend API (deprecated fallback)
  const resendKey = overrides.RESEND_API_KEY ?? process.env.RESEND_API_KEY;
  if (resendKey) {
    return sendViaResend(resendKey, payload);
  }

  throw new Error(
    'No email provider configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY for Gmail, or RESEND_API_KEY as fallback.',
  );
}

/**
 * Send a batch of emails. Uses Gmail for each individually (no batch API),
 * or Resend batch API if Gmail is not configured.
 */
export async function sendEmailBatch(
  payloads: EmailPayload[],
  overrides: Record<string, string> = {},
): Promise<EmailResult> {
  // 1. Gmail REST API — send individually (Gmail has no batch send endpoint)
  const gmailConfig = getGmailConfig(overrides);
  if (gmailConfig) {
    const results: EmailResult[] = [];
    for (const payload of payloads) {
      results.push(await sendViaGmail(gmailConfig, payload));
    }
    return { provider: 'gmail', data: { sent: results.length } };
  }

  // 2. Resend batch API (deprecated fallback)
  const resendKey = overrides.RESEND_API_KEY ?? process.env.RESEND_API_KEY;
  if (resendKey) {
    return batchSendViaResend(resendKey, payloads);
  }

  throw new Error('No email provider configured for batch sending.');
}
