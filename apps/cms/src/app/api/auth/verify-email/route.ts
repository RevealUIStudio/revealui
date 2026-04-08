/**
 * Email Verification API Route
 *
 * GET /api/auth/verify-email?token=<token>
 *
 * Verifies a user's email address using the token sent during signup.
 * Redirects to the login page with a success/error message.
 *
 * Rate limited: 10 attempts per 15 minutes per IP.
 */

import { createHash } from 'node:crypto';
import { checkRateLimit } from '@revealui/auth/server';
import { getClient } from '@revealui/db';
import { users } from '@revealui/db/schema';
import { logger } from '@revealui/utils/logger';
import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get('token');
  const baseUrl = request.nextUrl.origin;

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/login?error=missing_token`);
  }

  // Rate limit by IP — 10 attempts per 15 minutes
  const ip =
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';

  try {
    const rateLimit = await checkRateLimit(`verify_email:${ip}`, {
      maxAttempts: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.redirect(`${baseUrl}/login?error=too_many_attempts`);
    }
  } catch (rateLimitError) {
    // Fail closed — reject if rate limit store is unavailable
    logger.error('Rate limit check failed for verify-email', {
      error: rateLimitError instanceof Error ? rateLimitError.message : String(rateLimitError),
    });
    return NextResponse.redirect(`${baseUrl}/login?error=verification_failed`);
  }

  try {
    const db = getClient();

    // Hash the incoming raw token to compare against the stored hash.
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const [user] = await db
      .select({ id: users.id, emailVerified: users.emailVerified })
      .from(users)
      .where(
        and(
          eq(users.emailVerificationToken, tokenHash),
          or(
            isNull(users.emailVerificationTokenExpiresAt),
            gt(users.emailVerificationTokenExpiresAt, new Date()),
          ),
        ),
      )
      .limit(1);

    if (!user) {
      return NextResponse.redirect(`${baseUrl}/login?error=invalid_token`);
    }

    if (user.emailVerified) {
      return NextResponse.redirect(`${baseUrl}/login?message=already_verified`);
    }

    // Mark email as verified
    await db
      .update(users)
      .set({
        emailVerified: true,
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return NextResponse.redirect(`${baseUrl}/login?message=email_verified`);
  } catch (error) {
    logger.error('Email verification failed', { error });
    return NextResponse.redirect(`${baseUrl}/login?error=verification_failed`);
  }
}
