/**
 * Shared Memories Shape Proxy Route
 *
 * GET /api/shapes/shared-memories?session_scope=<session_scope>
 *
 * Authenticated proxy for ElectricSQL agent_memories shape,
 * filtered to shared and reconciled memories within a coordination session.
 */

import { getSession } from '@revealui/auth/server';
import { logger } from '@revealui/utils/logger';
import type { NextRequest, NextResponse } from 'next/server';
import { prepareElectricUrl, proxyElectricRequest } from '@/lib/api/electric-proxy';
import { checkAIFeatureGate } from '@/lib/middleware/ai-feature-gate';
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response';
import { extractRequestContext } from '@/lib/utils/request-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SESSION_SCOPE_RE = /^[a-zA-Z0-9_-]+$/;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const aiGate = checkAIFeatureGate();
  if (aiGate) return aiGate;

  try {
    const session = await getSession(request.headers, extractRequestContext(request));
    if (!session) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
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

    if (!SESSION_SCOPE_RE.test(sessionScope)) {
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
