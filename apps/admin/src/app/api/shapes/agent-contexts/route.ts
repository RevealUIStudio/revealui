/**
 * Agent Contexts Shape Proxy Route
 *
 * GET /api/shapes/agent-contexts
 *
 * Authenticated proxy for ElectricSQL agent_contexts shape.
 * Row-level filtered to the caller's auth session id (write path keys
 * agent_contexts by session.session.id). That is user-self scoping.
 */

import { getSession } from '@revealui/auth/server';
import { logger } from '@revealui/utils/logger';
import type { NextRequest, NextResponse } from 'next/server';
import { prepareElectricUrl, proxyElectricRequest } from '@/lib/api/electric-proxy';
import { isUuid } from '@/lib/api/shape-authz';
import { checkAIFeatureGate } from '@/lib/middleware/ai-feature-gate';
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

    const aiGate = await checkAIFeatureGate(session.user.id);
    if (aiGate) return aiGate;

    const originUrl = prepareElectricUrl(request.url);
    originUrl.searchParams.set('table', 'agent_contexts');
    const sessionId = session.session.id;
    if (!isUuid(sessionId)) {
      return createApplicationErrorResponse('Invalid session ID format', 'VALIDATION_ERROR', 400);
    }
    originUrl.searchParams.set('where', `session_id = '${sessionId}'`);

    return proxyElectricRequest(originUrl);
  } catch (error) {
    logger.error('Error proxying agent contexts shape', { error });
    return createErrorResponse(error, {
      endpoint: '/api/shapes/agent-contexts',
      operation: 'agent_contexts_proxy',
    });
  }
}
