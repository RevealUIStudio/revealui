/**
 * MFA Verify Setup API Route
 *
 * POST /api/auth/mfa/verify-setup
 *
 * Confirms the user's authenticator app works by validating a TOTP code.
 * Activates MFA on the account upon success.
 */

import { getSession, rotateSession, verifyMFASetup } from '@revealui/auth/server';
import { MFAVerifyRequestContract } from '@revealui/contracts';
import { logger } from '@revealui/utils/logger';
import { type NextRequest, NextResponse } from 'next/server';
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response';
import { rejectRecoverySession } from '@/lib/utils/recovery-guard';
import { extractRequestContext } from '@/lib/utils/request-context';
import { sessionCookieDomain, setRoleCookie } from '@/lib/utils/session-cookies';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession(request.headers, extractRequestContext(request));

    if (!session) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const recoveryBlocked = rejectRecoverySession(session);
    if (recoveryBlocked) return recoveryBlocked;

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
    const result = await verifyMFASetup(session.user.id, code);

    if (!result.success) {
      return createApplicationErrorResponse(
        result.error ?? 'Verification failed',
        'MFA_VERIFY_FAILED',
        400,
      );
    }

    // Enrollment just proved possession of the authenticator. Mark this
    // session MFA-stepped so C11 gates (e.g. POST /api/user/api-keys) work
    // without forcing a sign-out/sign-in loop. Without this, the account has
    // mfaEnabled=true but session.metadata.mfaVerified is still false →
    // "MFA required" / "MFA verification required" on the next sensitive action.
    const userAgent = request.headers.get('user-agent') ?? undefined;
    const ipAddress =
      request.headers.get('x-real-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      undefined;
    const { token: sessionToken } = await rotateSession(session.user.id, {
      userAgent,
      ipAddress,
      metadata: { mfaVerified: true },
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set('revealui-session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24,
      domain: sessionCookieDomain({ logIfMissing: true }),
    });
    // Keep role cookie in lockstep when rotating the session after MFA enroll.
    setRoleCookie(response, session.user.role, { maxAge: 60 * 60 * 24 });
    return response;
  } catch (error) {
    logger.error('Error verifying MFA setup', { error });
    return createErrorResponse(error, {
      endpoint: '/api/auth/mfa/verify-setup',
      operation: 'mfa_verify_setup',
    });
  }
}
