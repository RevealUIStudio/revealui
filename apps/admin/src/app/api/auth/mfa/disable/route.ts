/**
 * MFA Disable API Route
 *
 * POST /api/auth/mfa/disable
 *
 * Disables MFA on the authenticated user's account.
 * Requires re-authentication via password or passkey.
 *
 * For passkey proof: the client must first call POST /api/auth/passkey/authenticate-options
 * to obtain a WebAuthn challenge (stored in a signed cookie), then include the
 * authenticationResponse in this request. The route verifies the WebAuthn assertion
 * server-side before trusting the proof.
 */

import {
  disableMFA,
  getSession,
  verifyAuthentication,
  verifyCookiePayload,
} from '@revealui/auth/server';
import config from '@revealui/config';
import { MFADisableRequestContract } from '@revealui/contracts';
import { getClient } from '@revealui/db';
import { getPasskeyByCredentialId } from '@revealui/db/queries/passkeys';
import { logger } from '@revealui/utils/logger';
import type { AuthenticationResponseJSON, WebAuthnCredential } from '@simplewebauthn/server';
import { type NextRequest, NextResponse } from 'next/server';
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response';
import { rejectRecoverySession } from '@/lib/utils/recovery-guard';
import { extractRequestContext } from '@/lib/utils/request-context';

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

    const validationResult = MFADisableRequestContract.validate(body);

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

    const data = validationResult.data;

    let proof: Parameters<typeof disableMFA>[1];

    if (data.method === 'password') {
      proof = { method: 'password' as const, password: data.password };
    } else {
      // Passkey proof  -  verify the WebAuthn assertion server-side.
      // The client must have called /api/auth/passkey/authenticate-options first
      // to obtain a challenge stored in a signed httpOnly cookie.
      const challengeCookie = request.cookies.get('passkey-challenge')?.value;
      if (!challengeCookie) {
        return createApplicationErrorResponse(
          'Passkey challenge expired or missing. Call /api/auth/passkey/authenticate-options first.',
          'PASSKEY_CHALLENGE_MISSING',
          401,
        );
      }

      const challengePayload = verifyCookiePayload<{ challenge: string; expiresAt: number }>(
        challengeCookie,
        config.reveal.secret,
      );

      if (!challengePayload) {
        return createApplicationErrorResponse(
          'Passkey challenge expired or invalid',
          'PASSKEY_CHALLENGE_INVALID',
          401,
        );
      }

      const authResponse = data.authenticationResponse as unknown as AuthenticationResponseJSON;

      // Look up the passkey credential
      const db = getClient();
      const storedPasskey = await getPasskeyByCredentialId(db, authResponse.id);

      if (!storedPasskey) {
        return createApplicationErrorResponse('Passkey not recognized', 'PASSKEY_NOT_FOUND', 401);
      }

      // Ensure the passkey belongs to the authenticated user
      if (storedPasskey.userId !== session.user.id) {
        return createApplicationErrorResponse(
          'Passkey does not belong to this account',
          'PASSKEY_OWNER_MISMATCH',
          403,
        );
      }

      const credential: WebAuthnCredential = {
        id: storedPasskey.credentialId,
        publicKey: new Uint8Array(storedPasskey.publicKey),
        counter: storedPasskey.counter,
        transports: storedPasskey.transports as WebAuthnCredential['transports'],
      };

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

      proof = { method: 'passkey' as const, verified: true as const };
    }

    const result = await disableMFA(session.user.id, proof);

    if (!result.success) {
      return createApplicationErrorResponse(
        result.error ?? 'Failed to disable MFA',
        'MFA_DISABLE_FAILED',
        400,
      );
    }

    const response = NextResponse.json({ success: true });

    // Clear the challenge cookie if it was used
    if (data.method === 'passkey') {
      response.cookies.set('passkey-challenge', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/auth/passkey',
        maxAge: 0,
      });
    }

    return response;
  } catch (error) {
    logger.error('Error disabling MFA', { error });
    return createErrorResponse(error, {
      endpoint: '/api/auth/mfa/disable',
      operation: 'mfa_disable',
    });
  }
}
