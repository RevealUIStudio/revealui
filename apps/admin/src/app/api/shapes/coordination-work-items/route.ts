/**
 * Coordination Work Items Shape Proxy Route
 *
 * GET /api/shapes/coordination-work-items
 *
 * Authenticated proxy for ElectricSQL coordination_work_items shape.
 * Admin-scoped: any authenticated user can observe all coordination work
 * items (this endpoint backs the coordination dashboard, not a per-user view).
 */

import { getSession } from '@revealui/auth/server';
import { logger } from '@revealui/utils/logger';
import type { NextRequest, NextResponse } from 'next/server';
import { prepareElectricUrl, proxyElectricRequest } from '@/lib/api/electric-proxy';
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

    const originUrl = prepareElectricUrl(request.url);
    originUrl.searchParams.set('table', 'coordination_work_items');

    return proxyElectricRequest(originUrl);
  } catch (error) {
    logger.error('Error proxying coordination-work-items shape', { error });
    return createErrorResponse(error, {
      endpoint: '/api/shapes/coordination-work-items',
      operation: 'coordination_work_items_proxy',
    });
  }
}
