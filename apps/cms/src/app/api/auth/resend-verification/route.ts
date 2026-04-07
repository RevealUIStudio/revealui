/**
 * Resend Verification Email API Route
 *
 * POST /api/auth/resend-verification
 *
 * Resends the email verification link to the authenticated user.
 * Rate-limited to prevent abuse.
 */

import { createHash } from 'node:crypto';
import { getSession } from '@revealui/auth/server';
import { getClient } from '@revealui/db';
import { users } from '@revealui/db/schema';
import { logger } from '@revealui/utils/logger';
import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { sendVerificationEmail } from '@/lib/email/verification';
import { withRateLimit } from '@/lib/middleware/rate-limit';
import { createApplicationErrorResponse, createErrorResponse } from '@/lib/utils/error-response';
import { extractRequestContext } from '@/lib/utils/request-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function resendHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession(request.headers, extractRequestContext(request));
    if (!session) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    if (session.user.emailVerified) {
      return createApplicationErrorResponse('Email already verified', 'ALREADY_VERIFIED', 400);
    }

    if (!session.user.email) {
      return createApplicationErrorResponse('No email address on account', 'NO_EMAIL', 400);
    }

    // Generate a new token — store the SHA-256 hash, send the raw token via email
    const newToken = crypto.randomUUID();
    const tokenHash = createHash('sha256').update(newToken).digest('hex');
    const db = getClient();

    await db
      .update(users)
      .set({
        emailVerificationToken: tokenHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id));

    const result = await sendVerificationEmail(session.user.email, newToken);

    if (!result.success) {
      logger.warn('Failed to resend verification email', {
        userId: session.user.id,
        error: result.error,
      });
      return createApplicationErrorResponse(
        'Failed to send verification email. Please try again later.',
        'EMAIL_SEND_FAILED',
        500,
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error resending verification email', { error });
    return createErrorResponse(error, {
      endpoint: '/api/auth/resend-verification',
      operation: 'resend_verification',
    });
  }
}

export const POST = withRateLimit(resendHandler, {
  maxAttempts: 3,
  windowMs: 15 * 60 * 1000, // 15 minutes
  keyPrefix: 'resend-verification',
  failClosed: true,
});
