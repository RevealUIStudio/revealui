/**
 * Vector Memory Search API
 *
 * POST /api/memory/search - Search memories using vector similarity
 *
 * This endpoint uses Supabase vector database for semantic search.
 */

import { checkRateLimit, getSession } from '@revealui/auth/server';
import { logger } from '@revealui/utils/logger';
import { type NextRequest, NextResponse } from 'next/server';
import { resolveMemoryReadScope } from '@/lib/memory/memory-read-scope';
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
  try {
    const authSession = await getSession(request.headers, extractRequestContext(request));
    if (!authSession) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const aiGate = await checkAIMemoryFeatureGate(authSession.user.id);
    if (aiGate) return aiGate;

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

    const mod = await import('@revealui/ai/memory/vector').catch(() => null);
    if (!mod) {
      return NextResponse.json(
        { error: 'AI features require @revealui/ai (Pro)' },
        { status: 503 },
      );
    }
    const rawOptions =
      options && typeof options === 'object' ? (options as Record<string, unknown>) : {};
    const memoryScope = await resolveMemoryReadScope({
      userId: authSession.user.id,
      user: authSession.user,
      requestedSiteId: typeof rawOptions.siteId === 'string' ? rawOptions.siteId : undefined,
    });
    if (!memoryScope) {
      return NextResponse.json({
        success: true,
        results: [],
        count: 0,
      });
    }
    const service = new mod.VectorMemoryService();
    const safeOptions = {
      siteIds: memoryScope.siteIds,
      agentId: typeof rawOptions.agentId === 'string' ? rawOptions.agentId : undefined,
      type: typeof rawOptions.type === 'string' ? rawOptions.type : undefined,
      limit: typeof rawOptions.limit === 'number' ? rawOptions.limit : undefined,
      threshold: typeof rawOptions.threshold === 'number' ? rawOptions.threshold : undefined,
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
