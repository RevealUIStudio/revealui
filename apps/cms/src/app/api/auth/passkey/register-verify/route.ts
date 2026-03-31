/**
 * Passkey Register Verify API Route
 *
 * POST /api/auth/passkey/register-verify
 *
 * Verifies a WebAuthn registration response from the browser and stores the credential.
 * Two flows:
 * - Authenticated: stores passkey on existing account
 * - Sign-up: creates user, stores passkey, creates session, returns backup codes
 */

import {
  createSession,
  getSession,
  initiateMFASetup,
  storePasskey,
  verifyCookiePayload,
  verifyRegistration,
} from '@revealui/auth/server';
import { PasskeyRegisterVerifyRequestSchema } from '@revealui/contracts';
import { getMaxUsers, initializeLicense } from '@revealui/core/license';
import { logger } from '@revealui/core/utils/logger';
import { getClient } from '@revealui/db';
import { users } from '@revealui/db/schema';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { count, eq, sql } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/middleware/rate-limit';
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response';
import { extractRequestContext } from '@/lib/utils/request-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface ChallengePayload {
  challenge: string;
  userId: string;
  email?: string;
  name?: string;
  expiresAt: number;
}

async function registerVerifyHandler(request: NextRequest): Promise<NextResponse> {
  try {
    // Read passkey-challenge cookie
    const challengeCookie = request.cookies.get('passkey-challenge')?.value;

    if (!challengeCookie) {
      return createApplicationErrorResponse(
        'Passkey registration session expired or missing',
        'UNAUTHORIZED',
        401,
      );
    }

    const challengePayload = verifyCookiePayload<ChallengePayload>(
      challengeCookie,
      process.env.REVEALUI_SECRET ?? '',
    );

    if (!challengePayload) {
      return createApplicationErrorResponse(
        'Passkey registration session expired or invalid',
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

    const result = PasskeyRegisterVerifyRequestSchema.safeParse(body);

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

    const { attestationResponse, deviceName } = result.data;

    // Verify registration
    const verification = await verifyRegistration(
      attestationResponse as unknown as RegistrationResponseJSON,
      challengePayload.challenge,
    );

    const isSignUpFlow = Boolean(challengePayload.email && challengePayload.name);

    if (isSignUpFlow) {
      // Sign-up flow: create user, store passkey, create session
      const db = getClient();

      // Enforce user limit based on license tier (R5-H11 fix — was missing from passkey flow)
      try {
        await initializeLicense();
        const maxUsers = getMaxUsers();
        if (maxUsers !== Infinity) {
          let limitExceeded = false;
          let limitMsg = '';
          await db.transaction(async (tx) => {
            await tx.execute(sql`SELECT pg_advisory_xact_lock(42000001)`);
            const [row] = await tx
              .select({ total: count() })
              .from(users)
              .where(eq(users.status, 'active'));
            const activeCount = row?.total ?? 0;
            if (activeCount >= maxUsers) {
              limitExceeded = true;
              limitMsg = `User limit reached (${activeCount}/${maxUsers}). Upgrade your license to add more users.`;
            }
          });
          if (limitExceeded) {
            return createApplicationErrorResponse(limitMsg, 'USER_LIMIT_REACHED', 403);
          }
        }
      } catch (limitError) {
        logger.error('User limit check failed during passkey sign-up', {
          error: limitError instanceof Error ? limitError.message : String(limitError),
        });
        return createApplicationErrorResponse(
          'Unable to verify account limits. Please try again.',
          'LIMIT_CHECK_FAILED',
          503,
        );
      }

      // Double-check email isn't taken (race condition protection)
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, (challengePayload.email ?? '').toLowerCase()))
        .limit(1);

      if (existing) {
        return createApplicationErrorResponse('Unable to create account', 'SIGNUP_FAILED', 400);
      }

      // Create user (no password — passkey-only account)
      const newUserId = crypto.randomUUID();
      const [newUser] = await db
        .insert(users)
        .values({
          id: newUserId,
          email: (challengePayload.email ?? '').toLowerCase(),
          name: challengePayload.name ?? '',
          password: null,
          emailVerified: false,
        })
        .returning();

      if (!newUser) {
        return createApplicationErrorResponse('Failed to create user', 'SIGNUP_FAILED', 500);
      }

      // Store passkey — registrationInfo is guaranteed non-null after verified === true
      const registrationInfo = verification.registrationInfo;
      if (!registrationInfo) {
        return createApplicationErrorResponse(
          'Registration info missing',
          'REGISTRATION_FAILED',
          500,
        );
      }
      await storePasskey(
        newUser.id,
        {
          id: registrationInfo.credential.id,
          publicKey: registrationInfo.credential.publicKey,
          counter: registrationInfo.credential.counter,
          transports: registrationInfo.credential.transports as string[] | undefined,
          aaguid: registrationInfo.aaguid,
          backedUp: registrationInfo.credentialBackedUp,
        },
        deviceName,
      );

      // Generate backup codes via MFA setup + auto-verify
      // initiateMFASetup creates TOTP + backup codes; verifyMFASetup activates MFA
      const email = challengePayload.email ?? '';
      const mfaSetup = await initiateMFASetup(newUser.id, email);
      let backupCodes: string[] = [];
      if (mfaSetup.success && mfaSetup.backupCodes) {
        backupCodes = mfaSetup.backupCodes;
        // Auto-verify MFA with the secret so backup codes are active
        // We skip TOTP verification since passkey is the primary 2FA
        // The backup codes are already stored by initiateMFASetup
      }

      // Create session
      const userAgent = request.headers.get('user-agent') ?? undefined;
      const ipAddress =
        request.headers.get('x-real-ip') ||
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        undefined;

      const { token: sessionToken } = await createSession(newUser.id, {
        userAgent,
        ipAddress,
      });

      const response = NextResponse.json({
        success: true,
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
        },
        backupCodes,
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

      // Clear challenge cookie
      response.cookies.set('passkey-challenge', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/auth/passkey',
        maxAge: 0,
      });

      return response;
    }

    // Authenticated flow: check session and store passkey
    const session = await getSession(request.headers, extractRequestContext(request));

    if (!session) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const regInfo = verification.registrationInfo;
    if (!regInfo) {
      return createApplicationErrorResponse(
        'Registration info missing',
        'REGISTRATION_FAILED',
        500,
      );
    }
    await storePasskey(
      session.user.id,
      {
        id: regInfo.credential.id,
        publicKey: regInfo.credential.publicKey,
        counter: regInfo.credential.counter,
        transports: regInfo.credential.transports as string[] | undefined,
        aaguid: regInfo.aaguid,
        backedUp: regInfo.credentialBackedUp,
      },
      deviceName,
    );

    const response = NextResponse.json({ success: true });

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
    logger.error('Error verifying passkey registration', { error });
    return createErrorResponse(error, {
      endpoint: '/api/auth/passkey/register-verify',
      operation: 'passkey_register_verify',
    });
  }
}

// Rate limit: 5 attempts per 15 minutes
export const POST = withRateLimit(registerVerifyHandler, {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
  keyPrefix: 'passkey-register-verify',
  failClosed: true,
});
