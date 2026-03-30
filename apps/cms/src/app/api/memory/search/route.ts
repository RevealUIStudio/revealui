/**
 * Vector Memory Search API
 *
 * POST /api/memory/search - Search memories using vector similarity
 *
 * This endpoint uses Supabase vector database for semantic search.
 */

import { checkRateLimit, getSession } from '@revealui/auth/server';
import { logger } from '@revealui/core/observability/logger';
import { type NextRequest, NextResponse } from 'next/server';
import { checkAIMemoryFeatureGate } from '@/lib/middleware/ai-feature-gate';
import { createErrorResponse, createValidationErrorResponse } from '@/lib/utils/error-response';
import { extractRequestContext } from '@/lib/utils/request-context';

/** Rate limit: 30 requests per minute per user */
const MEMORY_SEARCH_RATE_LIMIT = {
  maxAttempts: 30,
  windowMs: 60 * 1000,
} as const;

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/memory/search
 * Search for similar memories using vector similarity.
 *
 * Request body:
 * {
 *   queryEmbedding: number[] (1536 dimensions),
 *   options?: {
 *     userId?: string,
 *     siteId?: string,
 *     agentId?: string,
 *     type?: string,
 *     limit?: number,
 *     threshold?: number
 *   }
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const aiGate = checkAIMemoryFeatureGate();
  if (aiGate) return aiGate;

  try {
    const authSession = await getSession(request.headers, extractRequestContext(request));
    if (!authSession) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit per user
    const rateLimit = await checkRateLimit(
      `memory_search:${authSession.user.id}`,
      MEMORY_SEARCH_RATE_LIMIT,
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) },
        },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch (jsonError) {
      return createValidationErrorResponse('Invalid JSON in request body', 'body', null, {
        parseError: jsonError instanceof Error ? jsonError.message : 'Malformed JSON',
      });
    }

    if (!body || typeof body !== 'object') {
      return createValidationErrorResponse('Request body must be an object', 'body', body);
    }

    const { queryEmbedding, options } = body as {
      queryEmbedding?: unknown;
      options?: unknown;
    };

    // Validate query embedding
    if (!Array.isArray(queryEmbedding)) {
      return createValidationErrorResponse(
        'queryEmbedding must be an array of numbers',
        'queryEmbedding',
        queryEmbedding,
      );
    }

    const expectedDim = Number(process.env.EMBEDDING_DIMENSIONS ?? 1536);
    if (queryEmbedding.length !== expectedDim) {
      return createValidationErrorResponse(
        `queryEmbedding must have ${expectedDim} dimensions, got ${queryEmbedding.length}`,
        'queryEmbedding',
        queryEmbedding.length,
        {
          expected: expectedDim,
          actual: queryEmbedding.length,
        },
      );
    }

    // Validate all elements are numbers
    if (!queryEmbedding.every((val) => typeof val === 'number')) {
      return createValidationErrorResponse(
        'queryEmbedding must contain only numbers',
        'queryEmbedding',
        queryEmbedding,
      );
    }

    // Perform search — enforce userId so non-admins can only search their own memories
    const mod = await import('@revealui/ai/memory/vector').catch(() => null);
    if (!mod) {
      return NextResponse.json(
        { error: 'AI features require @revealui/ai (Pro)' },
        { status: 503 },
      );
    }
    // Strip siteId from options for non-admins to prevent cross-tenant data access
    const service = new mod.VectorMemoryService();
    const isAdmin = authSession.user.role === 'admin';
    const safeOptions = {
      ...((options as Record<string, unknown>) ?? {}),
      ...(!isAdmin ? { userId: authSession.user.id, siteId: undefined } : {}),
    };
    const results = await service.searchSimilar(queryEmbedding, safeOptions);

    return NextResponse.json({
      success: true,
      results,
      count: results.length,
    });
  } catch (error) {
    logger.error('Error searching memories', error instanceof Error ? error : undefined);
    return createErrorResponse(error, {
      endpoint: '/api/memory/search',
      operation: 'memory_search',
    });
  }
}
