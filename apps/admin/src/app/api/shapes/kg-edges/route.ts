/**
 * Knowledge Graph Edges Shape Proxy Route
 *
 * GET /api/shapes/kg-edges[?repo=<repo>]
 *
 * Authenticated, read-only proxy for the ElectricSQL `kg_edges` shape
 * (GAP-349 P4, design spec §8.2/§9). Same repo-partition and validation
 * contract as `kg-nodes` — see that route's header comment.
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
  const aiGate = checkAIFeatureGate();
  if (aiGate) return aiGate;

  try {
    const session = await getSession(request.headers, extractRequestContext(request));
    if (!session) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
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
    originUrl.searchParams.set('table', 'kg_edges');
    if (repo !== null) {
      originUrl.searchParams.set('where', `repo = '${repo}'`);
    }

    return proxyElectricRequest(originUrl);
  } catch (error) {
    logger.error('Error proxying kg-edges shape', { error });
    return createErrorResponse(error, {
      endpoint: '/api/shapes/kg-edges',
      operation: 'kg_edges_proxy',
    });
  }
}
