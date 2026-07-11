/**
 * Email Verification API Route
 *
 * GET /api/auth/verify-email?token=<token>
 *
 * Verifies a user's email address using the token sent during signup.
 * On success, establishes a session immediately (the same mechanism
 * sign-up uses for the auto-promoted first user) and redirects straight
 * into the product instead of bouncing the user to a second manual login
 * mid-purchase. Any invalid/expired/reused/garbage token never creates a
 * session and preserves the existing failure redirects.
 *
 * Rate limited: 10 attempts per 15 minutes per IP.
 */

import { createHash } from 'node:crypto';
import { auditLoginSuccess, checkRateLimit, rotateSession } from '@revealui/auth/server';
import { getClient } from '@revealui/db';
import { getUserByVerificationToken, updateUser } from '@revealui/db/queries/users';
import { logger } from '@revealui/utils/logger';
import { type NextRequest, NextResponse } from 'next/server';
import { isAdminRole } from '@/lib/access/roles/isAdminRole';
import { resolveAuthDest } from '@/lib/utils/auth-redirect';
import { sessionCookieDomain } from '@/lib/utils/session-cookies';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get('token');
  const rawUpgrade = request.nextUrl.searchParams.get('upgrade');
  // Whitelist to known checkout plans  -  never forward an arbitrary value
  // into a redirect destination.
  const upgrade: 'pro' | 'max' | null =
    rawUpgrade === 'pro' || rawUpgrade === 'max' ? rawUpgrade : null;
  const baseUrl = request.nextUrl.origin;

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/login?error=missing_token`);
  }

  // Rate limit by IP  -  10 attempts per 15 minutes
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
    // Fail closed  -  reject if rate limit store is unavailable
    logger.error('Rate limit check failed for verify-email', {
      error: rateLimitError instanceof Error ? rateLimitError.message : String(rateLimitError),
    });
    return NextResponse.redirect(`${baseUrl}/login?error=verification_failed`);
  }

  try {
    const db = getClient();

    // Hash the incoming raw token to compare against the stored hash.
    // A reused token (already consumed) or a garbage token both fail this
    // lookup: a valid, unexpired, single-use match is required to proceed.
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const user = await getUserByVerificationToken(db, tokenHash);

    if (!user) {
      return NextResponse.redirect(`${baseUrl}/login?error=invalid_token`);
    }

    if (user.emailVerified) {
      return NextResponse.redirect(`${baseUrl}/login?message=already_verified`);
    }

    // Mark email as verified and consume the token in one update.
    const updatedUser = await updateUser(db, user.id, {
      emailVerified: true,
      emailVerifiedAt: new Date(),
      emailVerificationToken: null,
    });

    if (!updatedUser) {
      // Row vanished between lookup and update (e.g. concurrent deletion).
      // Fail closed  -  no session on an unconfirmed write.
      logger.error('verify-email: updateUser returned no row for a matched token', {
        userId: user.id,
      });
      return NextResponse.redirect(`${baseUrl}/login?error=verification_failed`);
    }

    // Establish a session for this user. Use rotateSession (revoke-then-issue)
    // for parity with the sign-in path: it deletes any prior sessions for the
    // user, then mints a fresh one. The signup-time session row is only ever
    // handed to the client as a cookie once the email is verified (sign-up
    // route sets the cookie behind `isVerified`), so for a verifying user it is
    // an undelivered orphan row that rotate cleanly reclaims.
    const userAgent = request.headers.get('user-agent') || undefined;
    const ipAddress =
      request.headers.get('x-real-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      undefined;

    const { token: sessionToken } = await rotateSession(updatedUser.id, {
      userAgent,
      ipAddress,
    });

    // First login on email verification: land a success receipt in the audit
    // trail (best-effort; auditLoginSuccess never throws).
    await auditLoginSuccess(updatedUser.id, ipAddress ?? 'unknown', userAgent ?? 'unknown');

    const dest = resolveAuthDest({
      upgrade,
      redirect: null,
      fallback: isAdminRole(updatedUser.role) ? '/' : '/welcome',
    });

    const response = NextResponse.redirect(`${baseUrl}${dest}`);

    // Set role cookie for proxy.ts role-aware gate (defense-in-depth).
    response.cookies.set('revealui-role', updatedUser.role, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      domain: sessionCookieDomain(),
    });

    response.cookies.set('revealui-session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day (matches DB session expiry)
      domain: sessionCookieDomain({ logIfMissing: true }),
    });

    return response;
  } catch (error) {
    logger.error('Email verification failed', { error });
    return NextResponse.redirect(`${baseUrl}/login?error=verification_failed`);
  }
}
