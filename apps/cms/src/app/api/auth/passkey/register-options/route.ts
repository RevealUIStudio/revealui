/**
 * Passkey Register Options API Route
 *
 * POST /api/auth/passkey/register-options
 *
 * Generates WebAuthn registration options for the browser.
 * Two flows:
 * - Authenticated: adding a passkey to an existing account
 * - Sign-up: creating a new account with a passkey (email+name in body)
 */

import {
  generateRegistrationChallenge,
  getSession,
  listPasskeys,
  signCookiePayload,
} from '@revealui/auth/server';
import config from '@revealui/config';
import { PasskeyRegisterOptionsRequestSchema } from '@revealui/contracts';
import { getClient } from '@revealui/db';
import { getUserByEmail } from '@revealui/db/queries/users';
import { logger } from '@revealui/utils/logger';
import { type NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/middleware/rate-limit';
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response';
import { rejectRecoverySession } from '@/lib/utils/recovery-guard';
import { extractRequestContext } from '@/lib/utils/request-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function registerOptionsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    // Check for session cookie — if present, this is "add passkey" flow
    const session = await getSession(request.headers, extractRequestContext(request));

    let userId: string;
    let email: string;
    let signUpData: { email: string; name: string } | null = null;

    if (session) {
      // Block recovery sessions from registering passkeys
      const recoveryBlocked = rejectRecoverySession(session);
      if (recoveryBlocked) return recoveryBlocked;

      // Authenticated flow: adding passkey to existing account
      if (!session.user.email) {
        return createApplicationErrorResponse(
          'Email is required to register a passkey',
          'PASSKEY_REGISTER_FAILED',
          400,
        );
      }
      userId = session.user.id;
      email = session.user.email;
    } else {
      // Sign-up flow: parse body for email + name
      let body: unknown;
      try {
        body = await request.json();
      } catch (jsonError) {
        return createValidationErrorResponse('Invalid JSON in request body', 'body', null, {
          parseError: jsonError instanceof Error ? jsonError.message : 'Malformed JSON',
        });
      }

      const result = PasskeyRegisterOptionsRequestSchema.safeParse(body);

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

      if (!(result.data.email && result.data.name)) {
        return createApplicationErrorResponse(
          'Email and name are required for passkey sign-up',
          'VALIDATION_ERROR',
          400,
        );
      }

      // Check if email is already taken
      const db = getClient();
      const existing = await getUserByEmail(db, result.data.email.toLowerCase());

      if (existing) {
        return createApplicationErrorResponse('Unable to create account', 'SIGNUP_FAILED', 400);
      }

      email = result.data.email.toLowerCase();
      userId = crypto.randomUUID(); // Temporary ID for challenge, will create user on verify
      signUpData = { email, name: result.data.name };
    }

    // Get user's existing credential IDs (for excludeCredentials)
    let existingCredentialIds: string[] = [];
    if (session) {
      const existingPasskeys = await listPasskeys(userId);
      existingCredentialIds = existingPasskeys.map((pk) => pk.credentialId);
    }

    // Generate registration options
    const options = await generateRegistrationChallenge(userId, email, existingCredentialIds);

    // Sign challenge into cookie
    const challengePayload = signUpData
      ? {
          challenge: options.challenge,
          userId,
          email: signUpData.email,
          name: signUpData.name,
          expiresAt: Date.now() + 5 * 60 * 1000,
        }
      : {
          challenge: options.challenge,
          userId,
          expiresAt: Date.now() + 5 * 60 * 1000,
        };

    const signed = signCookiePayload(challengePayload, config.reveal.secret);

    const response = NextResponse.json({ options });

    // Set challenge cookie
    response.cookies.set('passkey-challenge', signed, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth/passkey',
      maxAge: 300,
    });

    return response;
  } catch (error) {
    logger.error('Error generating passkey registration options', { error });
    return createErrorResponse(error, {
      endpoint: '/api/auth/passkey/register-options',
      operation: 'passkey_register_options',
    });
  }
}

// Rate limit: 10 attempts per 15 minutes
export const POST = withRateLimit(registerOptionsHandler, {
  maxAttempts: 10,
  windowMs: 15 * 60 * 1000,
  keyPrefix: 'passkey-register-options',
  failClosed: true,
});
