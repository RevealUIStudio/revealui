/**
 * Email Service
 *
 * Sends emails using Gmail REST API with domain-wide delegation.
 * Edge-compatible (fetch + jose, no Node.js-only dependencies).
 *
 * Required env vars:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL — GCP service account email
 *   GOOGLE_PRIVATE_KEY           — RSA private key (PKCS8 PEM)
 *   EMAIL_FROM                   — sender address (e.g. noreply@revealui.com)
 *   EMAIL_REPLY_TO               — default reply-to (e.g. support@revealui.com)
 */

import config from '@revealui/config';
import { logger } from '@revealui/utils/logger';
import { importPKCS8, SignJWT } from 'jose';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

interface EmailProvider {
  send(options: EmailOptions): Promise<{ success: boolean; error?: string }>;
}

function sanitizeEmailHeader(value: string): string {
  return value.replace(/[\r\n]/g, '');
}

// ---------------------------------------------------------------------------
// Gmail REST API provider (edge-compatible)
// ---------------------------------------------------------------------------

class GmailProvider implements EmailProvider {
  private serviceAccountEmail: string;
  private privateKey: string;
  private delegateEmail: string;

  constructor() {
    this.serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
    this.privateKey = process.env.GOOGLE_PRIVATE_KEY || '';
    this.delegateEmail = process.env.EMAIL_FROM ?? 'noreply@revealui.com';
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

  async send(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
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
          logger.error('Gmail email delivery failed', new Error(message), { to: options.to });
          throw new Error(`Gmail email delivery failed: ${message}`);
        }
        return { success: false, error: message };
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Gmail error';
      if (process.env.NODE_ENV === 'production') {
        logger.error('Gmail email delivery failed', new Error(message), { to: options.to });
        throw new Error(`Gmail email delivery failed: ${message}`);
      }
      return { success: false, error: message };
    }
  }
}

// ---------------------------------------------------------------------------
// Mock provider (development)
// ---------------------------------------------------------------------------

class MockEmailProvider implements EmailProvider {
  async send(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
    logger.debug('Mock email sent', {
      to: options.to,
      subject: options.subject,
    });
    return { success: true };
  }
}

// ---------------------------------------------------------------------------
// Provider selection
// ---------------------------------------------------------------------------

function getEmailProvider(): EmailProvider {
  // Gmail REST API (production — edge-compatible, free with Workspace)
  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    return new GmailProvider();
  }

  // No provider configured
  logger.warn('No email provider configured — emails will not be sent.');
  if (process.env.NODE_ENV === 'development') {
    return new MockEmailProvider();
  }
  return {
    send: async () => ({ success: false, error: 'No email provider configured' }),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function sendEmail(
  options: EmailOptions,
  { maxRetries = 2 }: { maxRetries?: number } = {},
): Promise<{ success: boolean; error?: string }> {
  const provider = getEmailProvider();

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

export async function sendRecoveryEmail(
  email: string,
  token: string,
  recoveryUrl?: string,
): Promise<{ success: boolean; error?: string }> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || config.reveal.serverURL || config.reveal.publicServerURL;
  if (!baseUrl) {
    return {
      success: false,
      error: 'NEXT_PUBLIC_APP_URL (or NEXT_PUBLIC_SERVER_URL) is not set',
    };
  }
  const finalRecoveryUrl =
    recoveryUrl || `${baseUrl}/auth/recovery/verify?token=${encodeURIComponent(token)}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Account Recovery</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #ea580c;">Account Recovery</h1>
        <p>You requested to recover your account. Click the button below to sign in:</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${finalRecoveryUrl}" style="background-color: #ea580c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Recover Account
          </a>
        </p>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${finalRecoveryUrl}</p>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          This link will expire in 15 minutes. If you didn't request account recovery, you can safely ignore this email.
        </p>
      </body>
    </html>
  `;

  const text = `
Account Recovery

You requested to recover your account. Click the link below to sign in:

${finalRecoveryUrl}

This link will expire in 15 minutes. If you didn't request account recovery, you can safely ignore this email.
  `.trim();

  return sendEmail({
    to: email,
    subject: 'Account Recovery — RevealUI',
    html,
    text,
  });
}

export async function sendPasswordResetEmail(
  email: string,
  tokenId: string,
  resetToken: string,
  resetUrl?: string,
): Promise<{ success: boolean; error?: string }> {
  const baseUrl = config.reveal.serverURL;
  if (!baseUrl) {
    return {
      success: false,
      error: 'NEXT_PUBLIC_SERVER_URL or REVEALUI_PUBLIC_SERVER_URL is not set',
    };
  }
  const finalResetUrl = resetUrl || `${baseUrl}/reset-password?id=${tokenId}&token=${resetToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #2563eb;">Reset Your Password</h1>
        <p>You requested to reset your password. Click the button below to reset it:</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${finalResetUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Reset Password
          </a>
        </p>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${finalResetUrl}</p>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
        </p>
      </body>
    </html>
  `;

  const text = `
Reset Your Password

You requested to reset your password. Click the link below to reset it:

${finalResetUrl}

This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
  `.trim();

  return sendEmail({
    to: email,
    subject: 'Reset Your Password',
    html,
    text,
  });
}
