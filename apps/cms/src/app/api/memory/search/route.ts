/**
 * Vector Memory Search API
 *
 * POST /api/memory/search - Search memories using vector similarity
 *
 * This endpoint uses Supabase vector database for semantic search.
 */

import { VectorMemoryService } from '@revealui/ai/memory/vector'
import { getSession } from '@revealui/auth/server'
import { logger } from '@revealui/core/observability/logger'
import { type NextRequest, NextResponse } from 'next/server'
import { createErrorResponse, createValidationErrorResponse } from '@/lib/utils/error-response'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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
    const authSession = await getSession(request.headers)
    if (!authSession) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch (jsonError) {
      return createValidationErrorResponse('Invalid JSON in request body', 'body', null, {
        parseError: jsonError instanceof Error ? jsonError.message : 'Malformed JSON',
      })
    }

    if (!body || typeof body !== 'object') {
      return createValidationErrorResponse('Request body must be an object', 'body', body)
    }

    const { queryEmbedding, options } = body as {
      queryEmbedding?: unknown
      options?: unknown
    }

    // Validate query embedding
    if (!Array.isArray(queryEmbedding)) {
      return createValidationErrorResponse(
        'queryEmbedding must be an array of numbers',
        'queryEmbedding',
        queryEmbedding,
      )
    }

    if (queryEmbedding.length !== 1536) {
      return createValidationErrorResponse(
        `queryEmbedding must have 1536 dimensions, got ${queryEmbedding.length}`,
        'queryEmbedding',
        queryEmbedding.length,
        {
          expected: 1536,
          actual: queryEmbedding.length,
        },
      )
    }

    // Validate all elements are numbers
    if (!queryEmbedding.every((val) => typeof val === 'number')) {
      return createValidationErrorResponse(
        'queryEmbedding must contain only numbers',
        'queryEmbedding',
        queryEmbedding,
      )
    }

    // Perform search
    const service = new VectorMemoryService()
    const results = await service.searchSimilar(queryEmbedding, options || {})

    return NextResponse.json({
      success: true,
      results,
      count: results.length,
    })
  } catch (error) {
    logger.error('Error searching memories', error instanceof Error ? error : undefined)
    return createErrorResponse(error, {
      endpoint: '/api/memory/search',
      operation: 'memory_search',
    })
  }
}
