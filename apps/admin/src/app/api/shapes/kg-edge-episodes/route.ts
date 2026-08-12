/**
 * Knowledge Graph Edge-Episode Provenance Shape Proxy Route
 *
 * GET /api/shapes/kg-edge-episodes
 *
 * Authenticated, read-only proxy for the ElectricSQL `kg_edge_episodes` shape
 * (GAP-349 P4, design spec §8.2/§9): the provenance join between `kg_edges`
 * and `kg_episodes` (composite PK `edge_id, episode_id`, no other columns).
 *
 * NOT repo-partitioned, unlike `kg-nodes`/`kg-edges`: `kg_edge_episodes` has
 * no `repo` column (see `packages/db/src/schema/knowledge-graph.ts`) and
 * Electric shape `where` clauses are single-table (design spec §8.2), so a
 * join-based repo filter is not available here without a schema change. This
 * route syncs the full provenance join table. Flagged for the Fable review:
 * if this needs partitioning as the graph grows, it requires either
 * denormalizing `repo` onto `kg_edge_episodes` or dropping this shape in
 * favor of REST-fetched provenance (e.g. via the existing `kgAtTime` /
 * `kgNeighbors` query helpers, which already return `episodeIds` per fact).
 */

import { getSession } from '@revealui/auth/server';
import { logger } from '@revealui/utils/logger';
import type { NextRequest, NextResponse } from 'next/server';
import { prepareElectricUrl, proxyElectricRequest } from '@/lib/api/electric-proxy';
import { requireAdminRole } from '@/lib/api/shape-authz';
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

    // GAP-477: full provenance join is fleet-operator data only.
    if (!requireAdminRole(session.user.role)) {
      return createApplicationErrorResponse('Forbidden', 'FORBIDDEN', 403);
    }

    const originUrl = prepareElectricUrl(request.url);
    originUrl.searchParams.set('table', 'kg_edge_episodes');

    return proxyElectricRequest(originUrl);
  } catch (error) {
    logger.error('Error proxying kg-edge-episodes shape', { error });
    return createErrorResponse(error, {
      endpoint: '/api/shapes/kg-edge-episodes',
      operation: 'kg_edge_episodes_proxy',
    });
  }
}
