/**
 * Passkey Authenticate Verify API Route
 *
 * POST /api/auth/passkey/authenticate-verify
 *
 * Verifies a WebAuthn authentication response and creates a session.
 * Passkeys are inherently MFA — no TOTP check required.
 */

import { rotateSession, verifyAuthentication, verifyCookiePayload } from '@revealui/auth/server';
import config from '@revealui/config';
import { PasskeyAuthenticateVerifyRequestSchema } from '@revealui/contracts';
import { logger } from '@revealui/core/utils/logger';
import { getClient } from '@revealui/db';
import { passkeys, users } from '@revealui/db/schema';
import type { AuthenticationResponseJSON, WebAuthnCredential } from '@simplewebauthn/server';
import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/middleware/rate-limit';
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function authenticateVerifyHandler(request: NextRequest): Promise<NextResponse> {
  try {
    // Read passkey-challenge cookie
    const challengeCookie = request.cookies.get('passkey-challenge')?.value;

    if (!challengeCookie) {
      return createApplicationErrorResponse(
        'Passkey authentication session expired or missing',
        'UNAUTHORIZED',
        401,
      );
    }

    const challengePayload = verifyCookiePayload<{ challenge: string; expiresAt: number }>(
      challengeCookie,
      config.reveal.secret,
    );

    if (!challengePayload) {
      return createApplicationErrorResponse(
        'Passkey authentication session expired or invalid',
        'UNAUTHORIZED',
        401,
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch (jsonError) {
      return createValidationErrorResponse('Invalid JSON in request body', 'body', null, {
        parseError: jsonError instanceof Error ? jsonError.message : 'Malformed JSON',
      });
    }

    const result = PasskeyAuthenticateVerifyRequestSchema.safeParse(body);

    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return createValidationErrorResponse(
        firstIssue?.message ?? 'Validation failed',
        firstIssue?.path?.join('.') ?? 'body',
        body,
        {
          issues: result.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      );
    }

    const { authenticationResponse } = result.data;
    const authResponse = authenticationResponse as unknown as AuthenticationResponseJSON;

    // Look up passkey by credential ID
    const db = getClient();
    const [storedPasskey] = await db
      .select()
      .from(passkeys)
      .where(eq(passkeys.credentialId, authResponse.id))
      .limit(1);

    if (!storedPasskey) {
      return createApplicationErrorResponse('Passkey not recognized', 'PASSKEY_NOT_FOUND', 401);
    }

    // Verify the user account exists and is not deleted
    const [user] = await db.select().from(users).where(eq(users.id, storedPasskey.userId)).limit(1);

    if (!user) {
      return createApplicationErrorResponse('User account not found', 'USER_NOT_FOUND', 401);
    }

    // Build WebAuthnCredential for verification
    const credential: WebAuthnCredential = {
      id: storedPasskey.credentialId,
      publicKey: new Uint8Array(storedPasskey.publicKey),
      counter: storedPasskey.counter,
      transports: storedPasskey.transports as WebAuthnCredential['transports'],
    };

    // Verify authentication
    const verification = await verifyAuthentication(
      authResponse,
      credential,
      challengePayload.challenge,
    );

    if (!verification.verified) {
      return createApplicationErrorResponse(
        'Passkey verification failed',
        'PASSKEY_VERIFY_FAILED',
        401,
      );
    }

    // Passkeys are inherently MFA — create session directly (no TOTP check)
    const userAgent = request.headers.get('user-agent') ?? undefined;
    const ipAddress =
      request.headers.get('x-real-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      undefined;

    const { token: sessionToken } = await rotateSession(storedPasskey.userId, {
      userAgent,
      ipAddress,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
      },
    });

    // Set session cookie
    response.cookies.set('revealui-session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
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

    // Set role hint cookie
    const userRole = user.role ?? 'user';
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
          ? (process.env.SESSION_COOKIE_DOMAIN ?? undefined)
          : undefined,
    });

    // Clear challenge cookie
    response.cookies.set('passkey-challenge', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth/passkey',
      maxAge: 0,
    });

    return response;
  } catch (error) {
    logger.error('Error verifying passkey authentication', { error });
    return createErrorResponse(error, {
      endpoint: '/api/auth/passkey/authenticate-verify',
      operation: 'passkey_authenticate_verify',
    });
  }
}

// Rate limit: 5 attempts per 15 minutes
export const POST = withRateLimit(authenticateVerifyHandler, {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
  keyPrefix: 'passkey-auth-verify',
  failClosed: true,
});
