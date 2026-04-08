/**
 * Email Verification
 *
 * Sends verification emails and handles token verification for the grace period flow.
 * Users can log in without verifying, but the CMS shows a reminder banner.
 */

import config from '@revealui/config';
import { sendEmail } from './index';

/**
 * Send email verification link to a new user.
 */
export async function sendVerificationEmail(
  email: string,
  token: string,
): Promise<{ success: boolean; error?: string }> {
  const baseUrl = config.reveal.serverURL;

  const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #ea580c;">Verify Your Email</h1>
        <p>Thanks for signing up for RevealUI! Please verify your email address by clicking the button below:</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${verifyUrl}" style="background-color: #ea580c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Verify Email
          </a>
        </p>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${verifyUrl}</p>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          You can use RevealUI without verifying, but some features may be limited after 7 days.
          If you didn't create this account, you can safely ignore this email.
        </p>
      </body>
    </html>
  `;

  const text = `
Verify Your Email

Thanks for signing up for RevealUI! Please verify your email address by visiting:

${verifyUrl}

You can use RevealUI without verifying, but some features may be limited after 7 days.
If you didn't create this account, you can safely ignore this email.
  `.trim();

  return sendEmail({
    to: email,
    subject: 'Verify your email — RevealUI',
    html,
    text,
  });
}
