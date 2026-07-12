/**
 * Knowledge Graph Repos Route
 *
 * GET /api/kg/repos
 *
 * Authenticated, read-only list of distinct `repo` values present in
 * `kg_nodes`. Backs the explorer's repo picker (GAP-349 P4 deliverable B).
 *
 * Deliberately NOT an Electric shape: the design spec (§8.2) has the
 * explorer subscribe only to the repos actually in view, never the whole
 * fleet graph unfiltered (50-150k nodes per §12). This tiny, fixed,
 * parameterless query gives the picker real data without ever syncing an
 * unfiltered `kg_nodes` shape just to discover repo names.
 */

import { getSession } from '@revealui/auth/server';
import { getClient } from '@revealui/db/client';
import { kgNodes } from '@revealui/db/schema';
import { logger } from '@revealui/utils/logger';
import { isNotNull } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { checkAIFeatureGate } from '@/lib/middleware/ai-feature-gate';
import { createApplicationErrorResponse, createErrorResponse } from '@/lib/utils/error-response';
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

    const db = getClient();
    const rows = await db
      .selectDistinct({ repo: kgNodes.repo })
      .from(kgNodes)
      .where(isNotNull(kgNodes.repo))
      .orderBy(kgNodes.repo);

    const repos = rows.flatMap((r) => (r.repo ? [r.repo] : []));

    return NextResponse.json({ repos });
  } catch (error) {
    logger.error('Error listing kg repos', { error });
    return createErrorResponse(error, {
      endpoint: '/api/kg/repos',
      operation: 'kg_repos_list',
    });
  }
}
