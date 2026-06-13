/**
 * Email Verification
 *
 * Sends verification emails and verifies the token from the signup link.
 * Email verification is required before a user can sign in.
 */

import config from '@revealui/config';
import { sendEmail } from './index';

/**
 * Send email verification link to a new user.
 */
export async function sendVerificationEmail(
  email: string,
  token: string,
  plan?: 'pro' | 'max',
): Promise<{ success: boolean; error?: string }> {
  const baseUrl = config.reveal.serverURL;

  const planSuffix = plan ? `&upgrade=${plan}` : '';
  const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}${planSuffix}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #2563eb;">Verify Your Email</h1>
        <p>Thanks for signing up for RevealUI! Please verify your email address by clicking the button below:</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${verifyUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Verify Email
          </a>
        </p>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${verifyUrl}</p>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          Please verify your email to activate your account and sign in.
          If you didn't create this account, you can safely ignore this email.
        </p>
      </body>
    </html>
  `;

  const text = `
Verify Your Email

Thanks for signing up for RevealUI! Please verify your email address by visiting:

${verifyUrl}

Please verify your email to activate your account and sign in.
If you didn't create this account, you can safely ignore this email.
  `.trim();

  return sendEmail({
    to: email,
    subject: 'Verify your email  -  RevealUI',
    html,
    text,
  });
}
