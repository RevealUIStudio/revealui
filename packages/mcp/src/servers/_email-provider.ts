/**
 * Email provider for MCP servers.
 *
 * Uses Gmail REST API with domain-wide delegation.
 * Edge-compatible (fetch + jose, no Node.js-only dependencies).
 *
 * Required env vars:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL — GCP service account email
 *   GOOGLE_PRIVATE_KEY           — RSA private key (PKCS8 PEM)
 *   EMAIL_FROM                   — sender address (e.g. noreply@revealui.com)
 *   EMAIL_REPLY_TO               — default reply-to (e.g. support@revealui.com)
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
  provider: 'gmail';
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
  const delegateEmail = overrides.EMAIL_FROM ?? process.env.EMAIL_FROM ?? 'noreply@revealui.com';

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
  const replyTo = payload.reply_to ?? process.env.EMAIL_REPLY_TO;

  const lines = [
    `From: ${payload.from}`,
    `To: ${to}`,
    `Subject: ${payload.subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

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
// Public API — Gmail only
// ---------------------------------------------------------------------------

/**
 * Send a single email via Gmail REST API.
 */
export async function sendEmail(
  payload: EmailPayload,
  overrides: Record<string, string> = {},
): Promise<EmailResult> {
  const gmailConfig = getGmailConfig(overrides);
  if (gmailConfig) {
    return sendViaGmail(gmailConfig, payload);
  }

  throw new Error(
    'No email provider configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY.',
  );
}

/**
 * Send a batch of emails via Gmail (sent individually — Gmail has no batch endpoint).
 */
export async function sendEmailBatch(
  payloads: EmailPayload[],
  overrides: Record<string, string> = {},
): Promise<EmailResult> {
  const gmailConfig = getGmailConfig(overrides);
  if (gmailConfig) {
    const results: EmailResult[] = [];
    for (const payload of payloads) {
      results.push(await sendViaGmail(gmailConfig, payload));
    }
    return { provider: 'gmail', data: { sent: results.length } };
  }

  throw new Error('No email provider configured for batch sending.');
}
