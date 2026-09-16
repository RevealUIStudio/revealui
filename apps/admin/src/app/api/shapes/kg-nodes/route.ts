/**
 * Knowledge Graph Nodes Shape Proxy Route
 *
 * GET /api/shapes/kg-nodes[?repo=<repo>]
 *
 * Fleet knowledge graph (GAP-349). Dual gate: fleet-operator, or Launch /
 * self-host licensed-operator (`REVEALUI_KG_LICENSED_OPERATOR=1` + verified
 * shell admin). Hosted default (env unset) stays fleet-operator only so
 * Pro tenants cannot sync the shared graph. Licensed-operator callers must
 * pass `repo=`; fleet operators keep optional `repo`.
 *
 * Electric sync is read-only. Writes go through POST /api/sync/kg-episodes.
 */

import { getSession } from '@revealui/auth/server';
import { logger } from '@revealui/utils/logger';
import type { NextRequest, NextResponse } from 'next/server';
import { prepareElectricUrl, proxyElectricRequest } from '@/lib/api/electric-proxy';
import { KG_NODE_SHAPE_COLUMNS, setElectricShapeColumns } from '@/lib/api/kg-shape-columns';
import { canAccessKgShapes, resolveKgShapeRepoWhere } from '@/lib/api/shape-authz';
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
  try {
    const session = await getSession(request.headers, extractRequestContext(request));
    if (!session) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const aiGate = await checkAIFeatureGate(session.user.id);
    if (aiGate) return aiGate;

    if (!canAccessKgShapes(session.user)) {
      return createApplicationErrorResponse('Forbidden', 'FORBIDDEN', 403);
    }

    const repo = new URL(request.url).searchParams.get('repo');
    const scoped = resolveKgShapeRepoWhere(session.user, repo);
    if (!scoped.ok) {
      if (scoped.reason === 'missing') {
        return createValidationErrorResponse(
          'repo query param is required for licensed-operator knowledge-graph shapes',
          'repo',
          repo,
        );
      }
      return createValidationErrorResponse(
        'repo must be a non-empty string of alphanumeric characters, hyphens, underscores, or dots (max 128 chars)',
        'repo',
        repo,
      );
    }

    const originUrl = prepareElectricUrl(request.url);
    originUrl.searchParams.set('table', 'kg_nodes');
    // Omit generated `search` (and `embedding`) — Electric 400 otherwise.
    setElectricShapeColumns(originUrl, KG_NODE_SHAPE_COLUMNS);
    if (scoped.repo !== null) {
      originUrl.searchParams.set('where', `repo = '${scoped.repo}'`);
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
