/**
 * Recovery Verify API Route
 *
 * POST /api/auth/recovery/verify
 *
 * Verifies a magic link token and creates a temporary recovery session.
 * The session has a 30-minute expiry and metadata marking it as a recovery session.
 */

import { deleteAllUserSessions, createSession, verifyMagicLink } from '@revealui/auth/server';
import { RecoveryVerifyRequestSchema } from '@revealui/contracts';
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
    let body: unknown;
    try {
      body = await request.json();
    } catch (jsonError) {
      return createValidationErrorResponse('Invalid JSON in request body', 'body', null, {
        parseError: jsonError instanceof Error ? jsonError.message : 'Malformed JSON',
      });
    }

    const result = RecoveryVerifyRequestSchema.safeParse(body);

    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return createValidationErrorResponse(
        firstIssue?.message ?? 'Validation failed',
        firstIssue?.path?.join('.') ?? 'token',
        body,
        {
          issues: result.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      );
    }

    const { token } = result.data;

    // Verify the magic link token
    const verified = await verifyMagicLink(token);

    if (!verified) {
      return createApplicationErrorResponse(
        'Invalid or expired recovery link',
        'RECOVERY_INVALID',
        401,
      );
    }

    // Invalidate ALL existing sessions for this user — if the account is
    // compromised, the attacker's active session must not survive recovery.
    await deleteAllUserSessions(verified.userId);

    // Create a temporary recovery session (30 minutes)
    const userAgent = request.headers.get('user-agent') ?? undefined;
    const ipAddress =
      request.headers.get('x-real-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      undefined;

    const { token: sessionToken } = await createSession(verified.userId, {
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      metadata: { recovery: true },
      userAgent,
      ipAddress,
    });

    const response = NextResponse.json({ success: true });

    // Set session cookie (same pattern as sign-in / MFA verify routes)
    response.cookies.set('revealui-session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 60, // 30 minutes (matches session expiry)
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

    return response;
  } catch (error) {
    logger.error('Error verifying recovery token', { error });
    return createErrorResponse(error, {
      endpoint: '/api/auth/recovery/verify',
      operation: 'recovery_verify',
    });
  }
}

// Rate limit: 5 attempts per 15 minutes per IP
export const POST = withRateLimit(verifyHandler, {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
  keyPrefix: 'recovery-verify',
  failClosed: true,
});
