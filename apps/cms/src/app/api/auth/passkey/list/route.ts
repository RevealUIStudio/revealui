/**
 * Passkey List API Route
 *
 * GET /api/auth/passkey/list
 *
 * Returns all passkeys registered for the authenticated user.
 */

import { getSession, listPasskeys } from '@revealui/auth/server';
import { logger } from '@revealui/core/utils/logger';
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

    const userPasskeys = await listPasskeys(session.user.id);

    return NextResponse.json({ passkeys: userPasskeys });
  } catch (error) {
    logger.error('Error listing passkeys', { error });
    return createErrorResponse(error, {
      endpoint: '/api/auth/passkey/list',
      operation: 'passkey_list',
    });
  }
}
