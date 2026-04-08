/**
 * Agent Memories Shape Proxy Route
 *
 * GET /api/shapes/agent-memories?agent_id=<agent_id>
 *
 * Authenticated proxy for ElectricSQL agent_memories shape.
 * Caller must supply `agent_id` as a query param. Auth gate ensures only
 * authenticated users can subscribe to any agent's memories.
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

export async function GET(request: NextRequest): Promise<NextResponse> {
  const aiGate = checkAIFeatureGate();
  if (aiGate) return aiGate;

  try {
    // Validate session using RevealUI auth
    const session = await getSession(request.headers, extractRequestContext(request));

    if (!session) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    // Caller supplies the agent_id to scope memories to a specific agent
    const agentId = new URL(request.url).searchParams.get('agent_id');
    if (!agentId || agentId.trim().length === 0) {
      return createValidationErrorResponse(
        'agent_id query parameter is required',
        'agent_id',
        agentId,
        {
          example: '/api/shapes/agent-memories?agent_id=assistant',
        },
      );
    }

    // Validate agent_id is safe to inline (alphanumeric, hyphens, underscores only)
    if (!/^[a-zA-Z0-9_-]+$/.test(agentId)) {
      return createValidationErrorResponse(
        'agent_id must contain only alphanumeric characters, hyphens, and underscores',
        'agent_id',
        agentId,
      );
    }

    // Build the ElectricSQL URL with row-level filtering
    const originUrl = prepareElectricUrl(request.url);
    originUrl.searchParams.set('table', 'agent_memories');
    originUrl.searchParams.set('where', `agent_id = '${agentId}'`);

    return proxyElectricRequest(originUrl);
  } catch (error) {
    logger.error('Error proxying agent memories shape', { error });
    return createErrorResponse(error, {
      endpoint: '/api/shapes/agent-memories',
      operation: 'agent_memories_proxy',
    });
  }
}
