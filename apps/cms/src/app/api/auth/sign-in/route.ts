/**
 * Sign In API Route
 *
 * POST /api/auth/sign-in
 *
 * Authenticates a user with email and password.
 */

import { signCookiePayload, signIn } from '@revealui/auth/server';
import config from '@revealui/config';
import { SignInRequestContract } from '@revealui/contracts';
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

async function signInHandler(request: NextRequest): Promise<NextResponse> {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch (jsonError) {
      return createValidationErrorResponse('Invalid JSON in request body', 'body', null, {
        parseError: jsonError instanceof Error ? jsonError.message : 'Malformed JSON',
      });
    }

    // Validate request body using contract
    const validationResult = SignInRequestContract.validate(body);

    if (!validationResult.success) {
      // Extract first validation error for user-friendly response
      const firstIssue = validationResult.errors.issues[0];
      return createValidationErrorResponse(
        firstIssue?.message || 'Validation failed',
        firstIssue?.path?.join('.') || 'body',
        body,
        {
          issues: validationResult.errors.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      );
    }

    // Contract automatically sanitizes email (lowercase, trim)
    const { email: sanitizedEmail, password } = validationResult.data;

    // Get user agent and IP address for session tracking
    const userAgent = request.headers.get('user-agent') || undefined;
    const ipAddress =
      request.headers.get('x-real-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      undefined;

    const result = await signIn(sanitizedEmail, password, {
      userAgent,
      ipAddress,
    });

    if (!result.success) {
      const statusMap: Record<string, number> = {
        rate_limited: 429,
        account_locked: 423,
        email_not_verified: 403,
        database_error: 500,
        session_error: 500,
        unexpected_error: 500,
      };
      const status = statusMap[result.reason] ?? 401;
      return createApplicationErrorResponse(result.error, result.reason.toUpperCase(), status);
    }

    if (result.requiresMfa) {
      const signed = signCookiePayload(
        { userId: result.mfaUserId, expiresAt: Date.now() + 5 * 60 * 1000 },
        config.reveal.secret,
      );
      const response = NextResponse.json({ requiresMfa: true }, { status: 200 });
      response.cookies.set('mfa-pending', signed, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/auth/mfa',
        maxAge: 300,
      });
      return response;
    }

    // Create response with user data
    const response = NextResponse.json({
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        avatarUrl: result.user.avatarUrl,
        role: result.user.role,
      },
    });

    // Set role hint cookie for proxy.ts admin gate (defense-in-depth, not the security boundary).
    // The real enforcement is at the API level via collection access.read checks.
    const userRole = result.user.role ?? 'user';
    const isAdminRole = ['admin', 'super-admin', 'user-admin', 'user-super-admin'].includes(
      userRole,
    );
    response.cookies.set('revealui-role', isAdminRole ? 'admin' : 'user', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      domain:
        process.env.NODE_ENV === 'production'
          ? process.env.SESSION_COOKIE_DOMAIN || undefined
          : undefined,
    });

    // Set session cookie
    response.cookies.set('revealui-session', result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      domain:
        process.env.NODE_ENV === 'production'
          ? (() => {
              if (!process.env.SESSION_COOKIE_DOMAIN) {
                throw new Error(
                  'SESSION_COOKIE_DOMAIN env var is required in production for cross-subdomain auth',
                );
              }
              return process.env.SESSION_COOKIE_DOMAIN;
            })()
          : undefined,
    });

    return response;
  } catch (error) {
    logger.error('Error signing in', { error });
    return createErrorResponse(error, {
      endpoint: '/api/auth/sign-in',
      operation: 'sign_in',
    });
  }
}

// Export rate-limited handler
export const POST = withRateLimit(signInHandler, {
  maxAttempts: 10,
  windowMs: 15 * 60 * 1000, // 15 minutes
  keyPrefix: 'signin',
  failClosed: true,
});
