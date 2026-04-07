/**
 * MFA Verify API Route
 *
 * POST /api/auth/mfa/verify
 *
 * Step 2 of MFA login flow: validates a TOTP code from the user's authenticator app.
 * Reads userId from the `mfa-pending` signed cookie (set during sign-in).
 * On success, creates a full session and sets the `revealui-session` cookie.
 */

import { rotateSession, verifyCookiePayload, verifyMFACode } from '@revealui/auth/server';
import { MFAVerifyRequestContract } from '@revealui/contracts';
import { logger } from '@revealui/core/utils/logger';
import { type NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/middleware/rate-limit';
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function verifyHandler(request: NextRequest): Promise<NextResponse> {
  try {
    // Read userId from mfa-pending signed cookie (NOT session cookie)
    const mfaPendingCookie = request.cookies.get('mfa-pending')?.value;

    if (!mfaPendingCookie) {
      return createApplicationErrorResponse(
        'MFA verification session expired or missing',
        'UNAUTHORIZED',
        401,
      );
    }

    const payload = verifyCookiePayload<{ userId: string; expiresAt: number }>(
      mfaPendingCookie,
      process.env.REVEALUI_SECRET ?? '',
    );

    if (!payload) {
      return createApplicationErrorResponse(
        'MFA verification session expired or invalid',
        'UNAUTHORIZED',
        401,
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch (jsonError) {
      return createValidationErrorResponse('Invalid JSON in request body', 'body', null, {
        parseError: jsonError instanceof Error ? jsonError.message : 'Malformed JSON',
      });
    }

    const validationResult = MFAVerifyRequestContract.validate(body);

    if (!validationResult.success) {
      const firstIssue = validationResult.errors.issues[0];
      return createValidationErrorResponse(
        firstIssue?.message ?? 'Validation failed',
        firstIssue?.path?.join('.') ?? 'body',
        body,
        {
          issues: validationResult.errors.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      );
    }

    const { code } = validationResult.data;
    const result = await verifyMFACode(payload.userId, code);

    if (!result.success) {
      return createApplicationErrorResponse(
        result.error ?? 'Invalid code',
        'MFA_VERIFY_FAILED',
        401,
      );
    }

    // MFA verified — create a full session
    const userAgent = request.headers.get('user-agent') ?? undefined;
    const ipAddress =
      request.headers.get('x-real-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      undefined;

    const { token: sessionToken } = await rotateSession(payload.userId, {
      userAgent,
      ipAddress,
    });

    const response = NextResponse.json({ success: true });

    // Set session cookie (same pattern as sign-in route)
    response.cookies.set('revealui-session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      domain:
        process.env.NODE_ENV === 'production'
          ? (() => {
              if (!process.env.SESSION_COOKIE_DOMAIN) {
                logger.error(
                  'SESSION_COOKIE_DOMAIN env var is required in production — session cookie will not be set cross-subdomain',
                );
              }
              return process.env.SESSION_COOKIE_DOMAIN ?? undefined;
            })()
          : undefined,
    });

    // Clear the mfa-pending cookie
    response.cookies.set('mfa-pending', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth/mfa',
      maxAge: 0,
    });

    return response;
  } catch (error) {
    logger.error('Error verifying MFA code', { error });
    return createErrorResponse(error, {
      endpoint: '/api/auth/mfa/verify',
      operation: 'mfa_verify',
    });
  }
}

// Rate limit: 5 attempts per 15 minutes (matches sign-in)
export const POST = withRateLimit(verifyHandler, {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
  keyPrefix: 'mfa-verify',
  failClosed: true,
});
