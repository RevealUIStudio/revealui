/**
 * MFA Status API Route
 *
 * GET /api/auth/mfa/status
 *
 * Returns whether MFA is enabled for the authenticated user.
 */

import { getSession, isMFAEnabled } from '@revealui/auth/server';
import { logger } from '@revealui/utils/logger';
import { type NextRequest, NextResponse } from 'next/server';
import { createApplicationErrorResponse, createErrorResponse } from '@/lib/utils/error-response';
import { extractRequestContext } from '@/lib/utils/request-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession(request.headers, extractRequestContext(request));

    if (!session) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const enabled = await isMFAEnabled(session.user.id);

    return NextResponse.json({ enabled });
  } catch (error) {
    logger.error('Error checking MFA status', { error });
    return createErrorResponse(error, {
      endpoint: '/api/auth/mfa/status',
      operation: 'mfa_status',
    });
  }
}
