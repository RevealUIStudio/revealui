/**
 * MFA Regenerate Backup Codes API Route
 *
 * POST /api/auth/mfa/regenerate
 *
 * Regenerates backup codes for the authenticated user.
 * Requires MFA to be enabled on the account.
 */

import { getSession, regenerateBackupCodes } from '@revealui/auth/server';
import { logger } from '@revealui/core/utils/logger';
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

    const result = await regenerateBackupCodes(session.user.id);

    if (!result.success) {
      return createApplicationErrorResponse(
        result.error ?? 'Failed to regenerate backup codes',
        'MFA_REGENERATE_FAILED',
        400,
      );
    }

    return NextResponse.json({ backupCodes: result.backupCodes });
  } catch (error) {
    logger.error('Error regenerating MFA backup codes', { error });
    return createErrorResponse(error, {
      endpoint: '/api/auth/mfa/regenerate',
      operation: 'mfa_regenerate',
    });
  }
}
