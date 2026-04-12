/**
 * Agent Contexts Shape Proxy Route
 *
 * GET /api/shapes/agent-contexts
 *
 * Authenticated proxy for ElectricSQL agent_contexts shape.
 * Filters by session_id (agent_contexts.session_id belongs to the auth session).
 */

import { getSession } from '@revealui/auth/server';
import { logger } from '@revealui/utils/logger';
import type { NextRequest, NextResponse } from 'next/server';
import { prepareElectricUrl, proxyElectricRequest } from '@/lib/api/electric-proxy';
import { checkAIFeatureGate } from '@/lib/middleware/ai-feature-gate';
import { createApplicationErrorResponse, createErrorResponse } from '@/lib/utils/error-response';
import { extractRequestContext } from '@/lib/utils/request-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const aiGate = checkAIFeatureGate();
  if (aiGate) return aiGate;

  try {
    // Validate session using RevealUI auth
    const session = await getSession(request.headers, extractRequestContext(request));

    if (!session) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    // Build the ElectricSQL URL with row-level filtering
    // Filter by session_id  -  agent_contexts are scoped to the auth session
    const originUrl = prepareElectricUrl(request.url);
    originUrl.searchParams.set('table', 'agent_contexts');
    // Validate session ID format before inlining
    const sessionId = session.session.id;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
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
