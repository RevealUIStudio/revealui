/**
 * Shared Memories Shape Proxy Route
 *
 * GET /api/shapes/shared-memories?session_scope=<session_scope>
 *
 * Authenticated proxy for ElectricSQL agent_memories shape,
 * filtered to shared and reconciled memories within a coordination session.
 * GAP-476: admin-scoped until ACL — no user ownership join on session_scope.
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

    const sessionScope = new URL(request.url).searchParams.get('session_scope');
    if (!sessionScope || sessionScope.trim().length === 0) {
      return createValidationErrorResponse(
        'session_scope query parameter is required',
        'session_scope',
        sessionScope,
        { example: '/api/shapes/shared-memories?session_scope=coord-abc123' },
      );
    }

    if (!isSyncIdentifier(sessionScope)) {
      return createValidationErrorResponse(
        'session_scope must contain only alphanumeric characters, hyphens, and underscores',
        'session_scope',
        sessionScope,
      );
    }

    const originUrl = prepareElectricUrl(request.url);
    originUrl.searchParams.set('table', 'agent_memories');
    originUrl.searchParams.set(
      'where',
      `session_scope = '${sessionScope}' AND (scope = 'shared' OR scope = 'reconciled')`,
    );

    return proxyElectricRequest(originUrl);
  } catch (error) {
    logger.error('Error proxying shared memories shape', { error });
    return createErrorResponse(error, {
      endpoint: '/api/shapes/shared-memories',
      operation: 'shared_memories_proxy',
    });
  }
}
