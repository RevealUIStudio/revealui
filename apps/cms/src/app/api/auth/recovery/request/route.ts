/**
 * Recovery Request API Route
 *
 * POST /api/auth/recovery/request
 *
 * Initiates account recovery by generating a magic link token
 * and sending a recovery email via Resend.
 * Always returns success to prevent user enumeration.
 */

import { createMagicLink } from '@revealui/auth/server';
import { RecoveryRequestSchema } from '@revealui/contracts';
import { logger } from '@revealui/core/utils/logger';
import { getClient } from '@revealui/db';
import { users } from '@revealui/db/schema';
import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/middleware/rate-limit';
import { createErrorResponse, createValidationErrorResponse } from '@/lib/utils/error-response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function requestHandler(request: NextRequest): Promise<NextResponse> {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch (jsonError) {
      return createValidationErrorResponse('Invalid JSON in request body', 'body', null, {
        parseError: jsonError instanceof Error ? jsonError.message : 'Malformed JSON',
      });
    }

    const result = RecoveryRequestSchema.safeParse(body);

    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return createValidationErrorResponse(
        firstIssue?.message ?? 'Validation failed',
        firstIssue?.path?.join('.') ?? 'email',
        body,
        {
          issues: result.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      );
    }

    const { email } = result.data;

    // Look up user by email
    const db = getClient();
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (user) {
      const { token } = await createMagicLink(user.id);
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ??
        process.env.NEXT_PUBLIC_SERVER_URL ??
        'http://localhost:4000';
      const recoveryUrl = `${baseUrl}/auth/recovery/verify?token=${encodeURIComponent(token)}`;

      // Send recovery email via Resend (fire-and-forget)
      sendRecoveryEmail(email, recoveryUrl).catch((err) => {
        logger.warn('Failed to send recovery email', {
          error: err instanceof Error ? err.message : 'unknown',
        });
      });
    }

    // Always return success to prevent user enumeration
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error processing recovery request', { error });
    return createErrorResponse(error, {
      endpoint: '/api/auth/recovery/request',
      operation: 'recovery_request',
    });
  }
}

// ---------------------------------------------------------------------------
// Recovery email
// ---------------------------------------------------------------------------

async function sendRecoveryEmail(to: string, recoveryUrl: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail =
    process.env.RESEND_FROM_EMAIL ?? process.env.EMAIL_FROM ?? 'noreply@revealui.com';
  const support = process.env.REVEALUI_SUPPORT_EMAIL ?? 'support@revealui.com';

  if (!apiKey) {
    logger.debug('Recovery email skipped (no RESEND_API_KEY)', { to, recoveryUrl });
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      // biome-ignore lint/style/useNamingConvention: HTTP header
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: to.replace(/[\r\n]/g, ''),
      subject: 'Reset your RevealUI account access',
      html: `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><title>Account Recovery</title></head>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1 style="color: #2563eb;">Account Recovery</h1>
    <p>We received a request to reset access to your RevealUI account. Click the button below to set a new password:</p>
    <p style="text-align: center; margin: 30px 0;">
      <a href="${recoveryUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
        Reset My Password
      </a>
    </p>
    <p style="color: #666; font-size: 14px;">This link expires in 15 minutes. If you didn't request this, you can safely ignore this email.</p>
    <p style="color: #666; font-size: 14px;">Questions? Contact <a href="mailto:${support}">${support}</a>.</p>
  </body>
</html>`,
      text: `Reset your RevealUI account access.\n\nClick this link to set a new password: ${recoveryUrl}\n\nThis link expires in 15 minutes. If you didn't request this, you can safely ignore this email.\n\nQuestions? Contact ${support}.`,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend API error (${response.status}): ${body}`);
  }

  logger.info('Recovery email sent', { to });
}

// Rate limit: 3 requests per hour per IP
export const POST = withRateLimit(requestHandler, {
  maxAttempts: 3,
  windowMs: 60 * 60 * 1000,
  keyPrefix: 'recovery-request',
});
