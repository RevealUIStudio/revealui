/**
 * Conversations Shape Proxy Route
 *
 * GET /api/shapes/conversations
 *
 * Authenticated proxy for ElectricSQL conversations shape.
 * Validates session and adds row-level filtering before forwarding to ElectricSQL.
 */

import { getSession } from '@revealui/auth/server';
import { logger } from '@revealui/utils/logger';
import type { NextRequest, NextResponse } from 'next/server';
import { prepareElectricUrl, proxyElectricRequest } from '@/lib/api/electric-proxy';
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response';
import { extractRequestContext } from '@/lib/utils/request-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Validate session using RevealUI auth
    const session = await getSession(request.headers, extractRequestContext(request));

    if (!session) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    // Build the ElectricSQL URL with row-level filtering
    const originUrl = prepareElectricUrl(request.url);
    originUrl.searchParams.set('table', 'conversations');

    // Add row-level filtering based on user (SQL injection safe)
    // Validate user ID is a valid UUID format
    const userId = session.user.id;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      return createValidationErrorResponse('Invalid user ID format', 'userId', userId, {
        expectedFormat: 'UUID',
      });
    }

    // Inline the validated UUID in the where clause (safe  -  UUID format verified above)
    originUrl.searchParams.set('where', `user_id = '${userId}'`);

    // Proxy the request to ElectricSQL
    return proxyElectricRequest(originUrl);
  } catch (error) {
    logger.error('Error proxying conversations shape', { error });
    return createErrorResponse(error, {
      endpoint: '/api/shapes/conversations',
      operation: 'conversations_proxy',
    });
  }
}
