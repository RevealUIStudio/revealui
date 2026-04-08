/**
 * Email Service
 *
 * Sends emails using configured email provider.
 *
 * Provider priority:
 *   1. Gmail REST API  (GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY)
 *   2. Resend API      (RESEND_API_KEY)
 *   3. SMTP            (SMTP_HOST + SMTP_USER + SMTP_PASS, requires nodemailer)
 *   4. Mock / throw    (development logs, production throws)
 *
 * Gmail uses a Google Workspace service account with domain-wide delegation
 * to send as EMAIL_FROM (e.g. noreply@revealui.com) via the Gmail REST API.
 * No Node.js-only dependencies — fully edge-compatible (fetch + jose).
 */

import config from '@revealui/config';
import { logger } from '@revealui/utils/logger';
import { importPKCS8, SignJWT } from 'jose';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
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
    this.delegateEmail =
      process.env.EMAIL_FROM ?? process.env.RESEND_FROM_EMAIL ?? 'noreply@revealui.com';
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

  private buildRawMessage(to: string, subject: string, html: string, text?: string): string {
    const boundary = `boundary_${Date.now().toString(36)}`;

    const lines = [
      `From: ${this.delegateEmail}`,
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

  async send(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
    if (!(this.serviceAccountEmail && this.privateKey)) {
      return { success: false, error: 'Gmail service account credentials not configured' };
    }

    try {
      const accessToken = await this.getAccessToken();

      const raw = this.buildRawMessage(
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
// Resend API provider
// ---------------------------------------------------------------------------

class ResendProvider implements EmailProvider {
  private apiKey: string;
  private fromEmail: string;

  constructor() {
    this.apiKey = process.env.RESEND_API_KEY || '';
    this.fromEmail =
      process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || 'noreply@example.com';
  }

  async send(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
    if (!this.apiKey) {
      const message = 'RESEND_API_KEY not configured';
      if (process.env.NODE_ENV === 'production') {
        logger.error('Resend email delivery failed', new Error(message), { to: options.to });
        throw new Error(`Resend email delivery failed: ${message}`);
      }
      return { success: false, error: message };
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const message = `Resend API error: ${errorText}`;
        if (process.env.NODE_ENV === 'production') {
          logger.error('Resend email delivery failed', new Error(message), { to: options.to });
          throw new Error(`Resend email delivery failed: ${message}`);
        }
        return { success: false, error: message };
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (process.env.NODE_ENV === 'production') {
        logger.error('Resend email delivery failed', new Error(message), { to: options.to });
        throw new Error(`Resend email delivery failed: ${message}`);
      }
      return { success: false, error: message };
    }
  }
}

// ---------------------------------------------------------------------------
// SMTP provider (requires nodemailer)
// ---------------------------------------------------------------------------

class SMTPProvider implements EmailProvider {
  private config: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  private fromEmail: string;

  constructor() {
    this.config = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
    };
    this.fromEmail = process.env.EMAIL_FROM || this.config.auth.user;
  }

  async send(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
    let createTransport: typeof import('nodemailer').createTransport;
    try {
      const nodemailerModule = await import('nodemailer');
      createTransport = nodemailerModule.createTransport;
    } catch (_error) {
      const message = 'nodemailer not installed. Run: pnpm add nodemailer @types/nodemailer';
      if (process.env.NODE_ENV === 'production') {
        logger.error('SMTP email delivery failed', new Error(message));
        throw new Error(`SMTP email delivery failed: ${message}`);
      }
      return { success: false, error: message };
    }

    if (!(this.config.auth.user && this.config.auth.pass)) {
      const message = 'SMTP_USER and SMTP_PASS must be configured';
      if (process.env.NODE_ENV === 'production') {
        logger.error('SMTP email delivery failed', new Error(message));
        throw new Error(`SMTP email delivery failed: ${message}`);
      }
      return { success: false, error: message };
    }

    try {
      const transporter = createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: {
          user: this.config.auth.user,
          pass: this.config.auth.pass,
        },
      });

      await transporter.sendMail({
        from: this.fromEmail,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown SMTP error';
      if (process.env.NODE_ENV === 'production') {
        logger.error('SMTP email delivery failed', new Error(message), { to: options.to });
        throw new Error(`SMTP email delivery failed: ${message}`);
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
    if (process.env.NODE_ENV === 'development') {
      import('@revealui/core/utils/logger')
        .then(({ logger }) => {
          logger.debug('Mock email sent', {
            to: options.to,
            subject: options.subject,
          });
        })
        .catch(() => {
          // Logger not available, skip logging
        });
    }
    return { success: true };
  }
}

// ---------------------------------------------------------------------------
// Provider selection
// ---------------------------------------------------------------------------

function getEmailProvider(): EmailProvider {
  // 1. Gmail REST API (preferred — edge-compatible, free with Workspace)
  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    return new GmailProvider();
  }

  // 2. Resend API
  if (process.env.RESEND_API_KEY) {
    return new ResendProvider();
  }

  // 3. SMTP (requires nodemailer)
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return new SMTPProvider();
  }

  // 4. No provider — warn and return a provider that reports failure
  //    so auth flows surface delivery errors instead of silently succeeding.
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

      if (result.error && /not configured|not installed|unauthorized/i.test(result.error)) {
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
