/**
 * Email provider for MCP servers.
 *
 * Uses Gmail REST API with domain-wide delegation.
 * Edge-compatible (fetch + jose, no Node.js-only dependencies).
 *
 * Required env vars (GAP-211 keyless WIF):
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_WIF_PROVIDER, VERCEL_OIDC_TOKEN
 *   EMAIL_FROM, EMAIL_REPLY_TO
 */

import { gmailWifConfigured, mintGmailAccessToken } from '@revealui/services/email';

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
  delegateEmail: string;
}

function getGmailConfig(overrides: Record<string, string>): GmailConfig | null {
  const env: NodeJS.ProcessEnv = { ...process.env, ...overrides };
  if (!gmailWifConfigured(env)) return null;
  const delegateEmail = overrides.EMAIL_FROM ?? process.env.EMAIL_FROM ?? 'noreply@revealui.com';
  return { delegateEmail };
}

async function getGmailAccessToken(): Promise<string> {
  const minted = await mintGmailAccessToken();
  return minted.accessToken;
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
  const accessToken = await getGmailAccessToken();
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
// Public API  -  Gmail only
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
    'No email provider configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_WIF_PROVIDER.',
  );
}

/**
 * Send a batch of emails via Gmail (sent individually  -  Gmail has no batch endpoint).
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
