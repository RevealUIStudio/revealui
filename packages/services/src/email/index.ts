/**
 * Shared Email Service
 *
 * Sends emails using Gmail REST API with domain-wide delegation.
 * Edge-compatible (fetch + jose, no Node.js-only dependencies).
 *
 * Required env vars:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL  -  GCP service account email
 *   GOOGLE_PRIVATE_KEY            -  RSA private key (PKCS8 PEM)
 *   EMAIL_FROM                    -  sender address (e.g. noreply@revealui.com)
 *   EMAIL_REPLY_TO                -  default reply-to (e.g. support@revealui.com)
 *
 * History: this is the consolidated home for what used to be two parallel
 * implementations at apps/server/src/lib/email.ts (functional, void-returning,
 * throw-on-fail in prod) and apps/admin/src/lib/email/index.ts (class-based,
 * { success, error } return, retry-with-backoff). The class-based design wins
 * because it's the more general shape — extensible to additional providers
 * (SES, Resend, fallback chains) without re-doing the abstraction work in
 * each app. Server's wrapper preserves the original void+throw API on top.
 *
 * Closes GAP-138.
 */

import { logger as defaultLogger } from '@revealui/utils/logger';
import { importPKCS8, SignJWT } from 'jose';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface EmailSendResult {
  success: boolean;
  error?: string;
}

export interface EmailProvider {
  send(options: EmailOptions): Promise<EmailSendResult>;
}

/**
 * Minimal logger contract — matches the shapes exposed by both
 * `@revealui/utils/logger` and `@revealui/core/observability/logger`,
 * so consumers in either app surface can inject their preferred logger
 * without coupling this package to one observability stack.
 */
export interface EmailLogger {
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: unknown, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
}

export interface SendEmailOptions {
  maxRetries?: number;
  logger?: EmailLogger;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strip CR/LF from header values to prevent header-injection attacks.
 * Used on To/Subject/Reply-To before they hit the multipart boundary.
 */
export function sanitizeEmailHeader(value: string): string {
  return value.replace(/[\r\n]/g, '');
}

// ---------------------------------------------------------------------------
// Gmail REST API provider (edge-compatible)
// ---------------------------------------------------------------------------

export class GmailProvider implements EmailProvider {
  private serviceAccountEmail: string;
  private privateKey: string;
  private delegateEmail: string;
  private logger: EmailLogger;

  constructor(opts: { logger?: EmailLogger } = {}) {
    this.serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
    this.privateKey = process.env.GOOGLE_PRIVATE_KEY || '';
    this.delegateEmail = process.env.EMAIL_FROM ?? 'noreply@revealui.com';
    this.logger = opts.logger ?? defaultLogger;
  }

  private async getAccessToken(): Promise<string> {
    const key = await importPKCS8(this.privateKey.replace(/\\n/g, '\n'), 'RS256');

    const now = Math.floor(Date.now() / 1000);
    const jwt = await new SignJWT({
      scope: 'https://www.googleapis.com/auth/gmail.send',
      sub: this.delegateEmail,
    })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(this.serviceAccountEmail)
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

  private buildRawMessage(options: EmailOptions): string {
    const boundary = `boundary_${Date.now().toString(36)}`;
    const replyTo = options.replyTo ?? process.env.EMAIL_REPLY_TO;

    const lines = [
      `From: ${this.delegateEmail}`,
      `To: ${sanitizeEmailHeader(options.to)}`,
      `Subject: ${sanitizeEmailHeader(options.subject)}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ];

    if (replyTo) {
      lines.push(`Reply-To: ${sanitizeEmailHeader(replyTo)}`);
    }

    lines.push('');

    if (options.text) {
      lines.push(
        `--${boundary}`,
        'Content-Type: text/plain; charset="UTF-8"',
        '',
        options.text,
        '',
      );
    }

    lines.push(`--${boundary}`, 'Content-Type: text/html; charset="UTF-8"', '', options.html, '');
    lines.push(`--${boundary}--`);

    const raw = lines.join('\r\n');
    const bytes = new TextEncoder().encode(raw);
    let b64 = '';
    for (let i = 0; i < bytes.length; i += 4096) {
      b64 += String.fromCharCode(...bytes.subarray(i, i + 4096));
    }
    return btoa(b64).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  async send(options: EmailOptions): Promise<EmailSendResult> {
    if (!(this.serviceAccountEmail && this.privateKey)) {
      return { success: false, error: 'Gmail service account credentials not configured' };
    }

    try {
      const accessToken = await this.getAccessToken();
      const raw = this.buildRawMessage(options);

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
        const message = `Gmail API error (${res.status}): ${body}`;
        if (process.env.NODE_ENV === 'production') {
          this.logger.error('Gmail email delivery failed', new Error(message), { to: options.to });
          throw new Error(`Gmail email delivery failed: ${message}`);
        }
        return { success: false, error: message };
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Gmail error';
      if (process.env.NODE_ENV === 'production') {
        this.logger.error('Gmail email delivery failed', new Error(message), { to: options.to });
        throw new Error(`Gmail email delivery failed: ${message}`);
      }
      return { success: false, error: message };
    }
  }
}

// ---------------------------------------------------------------------------
// Mock provider (development)
// ---------------------------------------------------------------------------

export class MockEmailProvider implements EmailProvider {
  private logger: EmailLogger;

  constructor(opts: { logger?: EmailLogger } = {}) {
    this.logger = opts.logger ?? defaultLogger;
  }

  async send(options: EmailOptions): Promise<EmailSendResult> {
    this.logger.debug('Mock email sent', {
      to: options.to,
      subject: options.subject,
    });
    return { success: true };
  }
}

// ---------------------------------------------------------------------------
// Provider selection
// ---------------------------------------------------------------------------

export function getEmailProvider(opts: { logger?: EmailLogger } = {}): EmailProvider {
  const logger = opts.logger ?? defaultLogger;

  // Gmail REST API (production  -  edge-compatible, free with Workspace)
  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    return new GmailProvider({ logger });
  }

  // No provider configured
  logger.warn('No email provider configured  -  emails will not be sent.');
  if (process.env.NODE_ENV === 'development') {
    return new MockEmailProvider({ logger });
  }
  return {
    send: async () => ({ success: false, error: 'No email provider configured' }),
  };
}

// ---------------------------------------------------------------------------
// Public API — sendEmail with retry-with-backoff
// ---------------------------------------------------------------------------

/**
 * Send an email via the configured provider. Returns `{ success, error? }`.
 *
 * Behavior:
 *   - Retries up to `maxRetries` (default 2) with exponential backoff
 *   - "Not configured" errors short-circuit retries (no point retrying that)
 *   - In `NODE_ENV=production`, after all retries fail → throws
 *   - In dev, after all retries fail → returns the result
 *
 * Inject a custom `logger` if you want a non-default observability stack
 * (e.g. Hono server logger vs Next admin logger). Defaults to
 * `@revealui/utils/logger`.
 */
export async function sendEmail(
  options: EmailOptions,
  { maxRetries = 2, logger: customLogger }: SendEmailOptions = {},
): Promise<EmailSendResult> {
  const logger = customLogger ?? defaultLogger;
  const provider = getEmailProvider({ logger });

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await provider.send(options);

      if (result.success) return result;

      if (result.error && /not configured/i.test(result.error)) {
        return result;
      }

      if (attempt === maxRetries) {
        if (process.env.NODE_ENV === 'production') {
          const errorMsg = `Email delivery failed after ${maxRetries + 1} attempts: ${result.error}`;
          logger.error('Email delivery failed after retries', new Error(errorMsg), {
            to: options.to,
            attempts: maxRetries + 1,
          });
          throw new Error(errorMsg);
        }
        return result;
      }

      await new Promise((resolve) => setTimeout(resolve, 200 * 2 ** attempt));
    } catch (error) {
      if (attempt === maxRetries) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (process.env.NODE_ENV === 'production') {
          const errorMsg = `Email delivery failed after ${maxRetries + 1} attempts: ${message}`;
          logger.error('Email delivery failed after retries', new Error(errorMsg), {
            to: options.to,
            attempts: maxRetries + 1,
          });
          throw new Error(errorMsg);
        }
        return { success: false, error: message };
      }
      await new Promise((resolve) => setTimeout(resolve, 200 * 2 ** attempt));
    }
  }

  if (process.env.NODE_ENV === 'production') {
    logger.error('Email delivery failed: max retries exceeded', new Error('Max retries exceeded'), {
      to: options.to,
    });
    throw new Error('Email delivery failed: max retries exceeded');
  }
  return { success: false, error: 'Max retries exceeded' };
}
