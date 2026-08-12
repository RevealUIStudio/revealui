/**
 * Shared Facts Shape Proxy Route
 *
 * GET /api/shapes/shared-facts?session_id=<session_id>
 *
 * Authenticated proxy for ElectricSQL shared_facts shape.
 * GAP-476: admin-scoped until ACL — schema has no user_id ownership join;
 * non-admins receive 403. Coordination session_id still scopes the Electric where.
 */

import { getSession } from '@revealui/auth/server';
import { logger } from '@revealui/utils/logger';
import type { NextRequest, NextResponse } from 'next/server';
import { prepareElectricUrl, proxyElectricRequest } from '@/lib/api/electric-proxy';
import { requireAdminRole } from '@/lib/api/shape-authz';
import { checkAIFeatureGate } from '@/lib/middleware/ai-feature-gate';
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response';
import { isSyncIdentifier } from '@/lib/utils/identifier-validation';
import { extractRequestContext } from '@/lib/utils/request-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession(request.headers, extractRequestContext(request));
    if (!session) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const aiGate = await checkAIFeatureGate(session.user.id);
    if (aiGate) return aiGate;

    if (!requireAdminRole(session.user.role)) {
      return createApplicationErrorResponse('Forbidden', 'FORBIDDEN', 403);
    }

    const sessionId = new URL(request.url).searchParams.get('session_id');
    if (!sessionId || sessionId.trim().length === 0) {
      return createValidationErrorResponse(
        'session_id query parameter is required',
        'session_id',
        sessionId,
        { example: '/api/shapes/shared-facts?session_id=coord-abc123' },
      );
    }

    if (!isSyncIdentifier(sessionId)) {
      return createValidationErrorResponse(
        'session_id must contain only alphanumeric characters, hyphens, and underscores',
        'session_id',
        sessionId,
      );
    }

    const originUrl = prepareElectricUrl(request.url);
    originUrl.searchParams.set('table', 'shared_facts');
    originUrl.searchParams.set('where', `session_id = '${sessionId}'`);

    return proxyElectricRequest(originUrl);
  } catch (error) {
    logger.error('Error proxying shared facts shape', { error });
    return createErrorResponse(error, {
      endpoint: '/api/shapes/shared-facts',
      operation: 'shared_facts_proxy',
    });
  }
}
