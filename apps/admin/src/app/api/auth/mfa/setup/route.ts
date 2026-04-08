/**
 * MFA Setup API Route
 *
 * POST /api/auth/mfa/setup
 *
 * Initiates TOTP MFA setup for the authenticated user.
 * Returns the TOTP secret, provisioning URI (for QR code), and backup codes.
 */

import { getSession, initiateMFASetup } from '@revealui/auth/server';
import { logger } from '@revealui/utils/logger';
import { type NextRequest, NextResponse } from 'next/server';
import { createApplicationErrorResponse, createErrorResponse } from '@/lib/utils/error-response';
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

    if (!session.user.email) {
      return createApplicationErrorResponse(
        'Email is required to set up MFA',
        'MFA_SETUP_FAILED',
        400,
      );
    }

    const result = await initiateMFASetup(session.user.id, session.user.email);

    if (!result.success) {
      return createApplicationErrorResponse(
        result.error ?? 'MFA setup failed',
        'MFA_SETUP_FAILED',
        400,
      );
    }

    return NextResponse.json({
      secret: result.secret,
      uri: result.uri,
      backupCodes: result.backupCodes,
    });
  } catch (error) {
    logger.error('Error initiating MFA setup', { error });
    return createErrorResponse(error, {
      endpoint: '/api/auth/mfa/setup',
      operation: 'mfa_setup',
    });
  }
}
