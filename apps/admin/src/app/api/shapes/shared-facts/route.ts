/**
 * Shared Facts Shape Proxy Route
 *
 * GET /api/shapes/shared-facts?session_id=<session_id>
 *
 * Authenticated proxy for ElectricSQL shared_facts shape.
 * Scoped by coordination session ID so only agents in the same
 * session receive each other's discoveries.
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

const SESSION_ID_RE = /^[a-zA-Z0-9_-]+$/;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const aiGate = checkAIFeatureGate();
  if (aiGate) return aiGate;

  try {
    const session = await getSession(request.headers, extractRequestContext(request));
    if (!session) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const sessionId = new URL(request.url).searchParams.get('session_id');
    if (!sessionId || sessionId.trim().length === 0) {
      return createValidationErrorResponse(
        'session_id query parameter is required',
        'session_id',
        sessionId,
        { example: '/api/shapes/shared-facts?session_id=coord-abc123' },
      );
    }

    if (!SESSION_ID_RE.test(sessionId)) {
      return createValidationErrorResponse(
        'session_id must contain only alphanumeric characters, hyphens, and underscores',
        'session_id',
        sessionId,
      );
    }

    const originUrl = prepareElectricUrl(request.url);
    originUrl.searchParams.set('table', 'shared_facts');
    originUrl.searchParams.set('where', `session_id = '${sessionId}'`);

    return proxyElectricRequest(originUrl);
  } catch (error) {
    logger.error('Error proxying shared facts shape', { error });
    return createErrorResponse(error, {
      endpoint: '/api/shapes/shared-facts',
      operation: 'shared_facts_proxy',
    });
  }
}
