/**
 * Resend Verification Email API Route
 *
 * POST /api/auth/resend-verification
 *
 * Two modes:
 * - Authenticated session: resends to the session user (original behavior).
 * - No session: accepts { email }. The response is the same generic 200 for
 *   existing, nonexistent, already-verified, and per-email-rate-limited
 *   addresses. Token rotation + Workspace Gmail send run before the
 *   response so the inbox is not racing a deferred `after()` callback.
 *
 * Rate-limited per IP (wrapper) and, in the no-session mode, per email.
 */

import { createHash, randomBytes } from 'node:crypto';
import { checkRateLimit, getSession } from '@revealui/auth/server';
import { getClient } from '@revealui/db';
import { getUserByEmail, updateUser } from '@revealui/db/queries/users';
import { logger } from '@revealui/utils/logger';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sendVerificationEmail } from '@/lib/email/verification';
import { withRateLimit } from '@/lib/middleware/rate-limit';
import { createApplicationErrorResponse, createErrorResponse } from '@/lib/utils/error-response';
import { extractRequestContext } from '@/lib/utils/request-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Matches the TTL signUp stamps on the initial verification token.
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const unauthenticatedBody = z.object({
  email: z.email().max(254),
});

/**
 * Rotate the stored verification token and send the link. Stores only the
 * SHA-256 hash, and refreshes the expiry alongside the token so a resent
 * link never inherits the original signup deadline.
 */
async function rotateTokenAndSend(
  userId: string,
  email: string,
  origin?: string,
): Promise<{ success: boolean; error?: string }> {
  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const db = getClient();

  await updateUser(db, userId, {
    emailVerificationToken: tokenHash,
    emailVerificationTokenExpiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
  });

  return sendVerificationEmail(email, rawToken, undefined, undefined, origin);
}

function genericAcceptedResponse(): NextResponse {
  return NextResponse.json({
    success: true,
    message: 'If that account exists and is unverified, a new verification link is on its way.',
  });
}

/**
 * No-session mode. The constant 200 body is load-bearing (anti-enumeration).
 * The send is awaited so Workspace Gmail has accepted the message before we
 * tell the browser it is on its way.
 */
async function resendWithoutSession(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = unauthenticatedBody.safeParse(body);
  if (!parsed.success) {
    return createApplicationErrorResponse(
      'A valid email address is required',
      'INVALID_EMAIL',
      400,
    );
  }
  const email = parsed.data.email;

  // Per-email limiter on top of the wrapper's per-IP one, counted before the
  // user lookup so nonexistent addresses consume the same budget. The key is
  // hashed so raw addresses never become rate-limit storage keys.
  const emailKey = `resend-verification:email:${createHash('sha256').update(email.toLowerCase()).digest('hex')}`;
  const { allowed } = await checkRateLimit(emailKey, {
    maxAttempts: 10,
    windowMs: 15 * 60 * 1000,
  });

  if (allowed) {
    try {
      const db = getClient();
      // Exact-match lookup — the same semantics signIn uses, so any address
      // that can sign in can also request a send.
      const user = await getUserByEmail(db, email);
      if (user && !user.emailVerified && user.email) {
        const result = await rotateTokenAndSend(user.id, user.email, request.nextUrl.origin);
        if (!result.success) {
          logger.error('Failed to send verification email (no-session mode)', {
            userId: user.id,
            error: result.error,
          });
        }
      }
    } catch (error) {
      logger.error('Error sending verification email', { error });
    }
  }

  return genericAcceptedResponse();
}

async function resendHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession(request.headers, extractRequestContext(request));
    if (!session) {
      return resendWithoutSession(request);
    }

    if (session.user.emailVerified) {
      return createApplicationErrorResponse('Email already verified', 'ALREADY_VERIFIED', 400);
    }

    if (!session.user.email) {
      return createApplicationErrorResponse('No email address on account', 'NO_EMAIL', 400);
    }

    const result = await rotateTokenAndSend(
      session.user.id,
      session.user.email,
      request.nextUrl.origin,
    );

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
  maxAttempts: 10,
  windowMs: 15 * 60 * 1000, // 15 minutes
  keyPrefix: 'resend-verification',
  failClosed: true,
});
