/**
 * Knowledge Graph Nodes Shape Proxy Route
 *
 * GET /api/shapes/kg-nodes[?repo=<repo>]
 *
 * Authenticated, read-only proxy for the ElectricSQL `kg_nodes` shape
 * (GAP-349 P4, design spec §8.2/§9). Partitioned by the denormalized `repo`
 * column: an omitted `repo` param syncs the whole fleet graph; a supplied
 * one is validated against {@link isRepoIdentifier} (character-set only, no
 * authored regex) before being inlined into the Electric `where` clause —
 * Electric's shape API takes `where` as a literal SQL predicate string, so
 * an unvalidated value here would be a SQL injection surface.
 *
 * Electric sync is read-only by design: this route (and its kg-edges /
 * kg-edge-episodes siblings) never accepts a write. The only write path into
 * `kg_*` tables is `POST /api/sync/kg-episodes` (additive `ingestEpisode`).
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
