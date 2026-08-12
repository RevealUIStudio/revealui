/**
 * Agent Memories Shape Proxy Route
 *
 * GET /api/shapes/agent-memories?agent_id=<agent_id>[&site_id=<site_id>]
 *
 * Authenticated proxy for ElectricSQL agent_memories shape (GAP-476).
 * - Admins: agent_id filter only (ops full-agent view)
 * - Non-admins: require site_id and prove owner/collaborator access;
 *   Electric where: agent_id AND site_id
 */

import { getSession } from '@revealui/auth/server';
import { getClient } from '@revealui/db/client';
import { logger } from '@revealui/utils/logger';
import type { NextRequest, NextResponse } from 'next/server';
import { prepareElectricUrl, proxyElectricRequest } from '@/lib/api/electric-proxy';
import { isSafeSiteId, requireAdminRole, userCanAccessSite } from '@/lib/api/shape-authz';
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

    const url = new URL(request.url);
    const agentId = url.searchParams.get('agent_id');
    if (!agentId || agentId.trim().length === 0) {
      return createValidationErrorResponse(
        'agent_id query parameter is required',
        'agent_id',
        agentId,
        {
          example: '/api/shapes/agent-memories?agent_id=assistant&site_id=<site-id>',
        },
      );
    }

    if (!isSyncIdentifier(agentId)) {
      return createValidationErrorResponse(
        'agent_id must contain only alphanumeric characters, hyphens, and underscores',
        'agent_id',
        agentId,
      );
    }

    const originUrl = prepareElectricUrl(request.url);
    originUrl.searchParams.set('table', 'agent_memories');

    if (requireAdminRole(session.user.role)) {
      originUrl.searchParams.set('where', `agent_id = '${agentId}'`);
      return proxyElectricRequest(originUrl);
    }

    const siteId = url.searchParams.get('site_id');
    if (!siteId || siteId.trim().length === 0) {
      return createApplicationErrorResponse(
        'site_id query parameter is required for non-admin access',
        'FORBIDDEN',
        403,
      );
    }

    if (!isSafeSiteId(siteId)) {
      return createValidationErrorResponse(
        'site_id must contain only alphanumeric characters, hyphens, and underscores',
        'site_id',
        siteId,
      );
    }

    const db = getClient();
    const allowed = await userCanAccessSite(db, session.user.id, siteId, session.user.role);
    if (!allowed) {
      return createApplicationErrorResponse(
        'Access denied: you do not own or collaborate on this site',
        'FORBIDDEN',
        403,
      );
    }

    originUrl.searchParams.set('where', `agent_id = '${agentId}' AND site_id = '${siteId}'`);

    return proxyElectricRequest(originUrl);
  } catch (error) {
    logger.error('Error proxying agent memories shape', { error });
    return createErrorResponse(error, {
      endpoint: '/api/shapes/agent-memories',
      operation: 'agent_memories_proxy',
    });
  }
}
