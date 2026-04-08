/**
 * Passkey Authenticate Options API Route
 *
 * POST /api/auth/passkey/authenticate-options
 *
 * Generates WebAuthn authentication options for the browser.
 * No authentication required — this is the first step of passkey sign-in.
 */

import { generateAuthenticationChallenge, signCookiePayload } from '@revealui/auth/server';
import config from '@revealui/config';
import { logger } from '@revealui/core/utils/logger';
import { type NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/middleware/rate-limit';
import { createErrorResponse } from '@/lib/utils/error-response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function authenticateOptionsHandler(_request: NextRequest): Promise<NextResponse> {
  try {
    // Generate authentication options (no allowCredentials — discoverable credentials)
    const options = await generateAuthenticationChallenge();

    // Sign challenge into cookie
    const signed = signCookiePayload(
      {
        challenge: options.challenge,
        expiresAt: Date.now() + 5 * 60 * 1000,
      },
      config.reveal.secret,
    );

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
    logger.error('Error generating passkey authentication options', { error });
    return createErrorResponse(error, {
      endpoint: '/api/auth/passkey/authenticate-options',
      operation: 'passkey_authenticate_options',
    });
  }
}

// Rate limit: 10 attempts per 15 minutes
export const POST = withRateLimit(authenticateOptionsHandler, {
  maxAttempts: 10,
  windowMs: 15 * 60 * 1000,
  keyPrefix: 'passkey-auth-options',
  failClosed: true,
});
