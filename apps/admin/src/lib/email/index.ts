/**
 * Email Service (admin app)
 *
 * The Gmail JWT/REST sender + retry orchestration is now owned by the
 * shared `@revealui/services/email` package — this file re-exports those
 * primitives and keeps the admin-specific senders (recovery + password
 * reset) that bake in admin URL config.
 *
 * GAP-138 closure: this used to be a ~250-line parallel class-based
 * implementation that mirrored apps/server/src/lib/email.ts (functional).
 * Both apps now share the implementation; the only divergence is each
 * app's wrapper-and-app-specific-templates layer.
 *
 * Required env vars are documented at packages/services/src/email/index.ts.
 */

import config from '@revealui/config';
import { sendEmail } from '@revealui/services/email';

// Re-export the shared primitives so admin consumers (and verification.ts)
// continue to import `sendEmail` etc. from `./index` without churning paths.
export {
  type EmailLogger,
  type EmailOptions,
  type EmailProvider,
  type EmailSendResult,
  GmailProvider,
  getEmailProvider,
  MockEmailProvider,
  type SendEmailOptions,
  sanitizeEmailHeader,
  sendEmail,
} from '@revealui/services/email';

// ---------------------------------------------------------------------------
// Admin-specific senders (URL-coupled to admin config)
// ---------------------------------------------------------------------------

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
    subject: 'Account Recovery  -  RevealUI',
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
