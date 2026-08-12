/**
 * Knowledge Graph Nodes Shape Proxy Route
 *
 * GET /api/shapes/kg-nodes[?repo=<repo>]
 *
 * Fleet knowledge graph (GAP-349). GAP-477 Phase C: admin_platform only —
 * any authenticated user previously could sync the whole graph. Optional
 * `repo` still scopes the Electric where for admins who pass it.
 *
 * Electric sync is read-only. Writes go through POST /api/sync/kg-episodes.
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
import { isRepoIdentifier } from '@/lib/utils/identifier-validation';
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

    const repo = new URL(request.url).searchParams.get('repo');
    if (repo !== null && !isRepoIdentifier(repo)) {
      return createValidationErrorResponse(
        'repo must be a non-empty string of alphanumeric characters, hyphens, underscores, or dots (max 128 chars)',
        'repo',
        repo,
      );
    }

    const originUrl = prepareElectricUrl(request.url);
    originUrl.searchParams.set('table', 'kg_nodes');
    if (repo !== null) {
      originUrl.searchParams.set('where', `repo = '${repo}'`);
    }

    return proxyElectricRequest(originUrl);
  } catch (error) {
    logger.error('Error proxying kg-nodes shape', { error });
    return createErrorResponse(error, {
      endpoint: '/api/shapes/kg-nodes',
      operation: 'kg_nodes_proxy',
    });
  }
}
