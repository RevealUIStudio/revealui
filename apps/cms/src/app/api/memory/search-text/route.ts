/**
 * Text-based Vector Memory Search API
 *
 * POST /api/memory/search-text - Search memories using natural language text
 *
 * This endpoint generates embeddings from the query text and performs
 * vector similarity search against the memory database.
 */

import { generateEmbedding } from '@revealui/ai/embeddings'
import { VectorMemoryService } from '@revealui/ai/memory/vector'
import { getSession } from '@revealui/auth/server'
import { logger } from '@revealui/core/observability/logger'
import { type NextRequest, NextResponse } from 'next/server'
import { createErrorResponse, createValidationErrorResponse } from '@/lib/utils/error-response'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface SearchTextBody {
  query?: unknown
  options?: {
    siteId?: string
    agentId?: string
    type?: string
    limit?: number
    threshold?: number
  }
}

/**
 * POST /api/memory/search-text
 * Search for similar memories using natural language text.
 *
 * Request body:
 * {
 *   query: string (the search text),
 *   options?: {
 *     siteId?: string,
 *     agentId?: string,
 *     type?: string,
 *     limit?: number,
 *     threshold?: number (0-1, default 0.5)
 *   }
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const authSession = await getSession(request.headers)
    if (!authSession) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: SearchTextBody
    try {
      body = (await request.json()) as SearchTextBody
    } catch (jsonError) {
      return createValidationErrorResponse('Invalid JSON in request body', 'body', null, {
        parseError: jsonError instanceof Error ? jsonError.message : 'Malformed JSON',
      })
    }

    if (!body || typeof body !== 'object') {
      return createValidationErrorResponse('Request body must be an object', 'body', body)
    }

    const { query, options = {} } = body

    // Validate query
    if (typeof query !== 'string') {
      return createValidationErrorResponse('query must be a string', 'query', query)
    }

    if (query.trim().length === 0) {
      return createValidationErrorResponse('query cannot be empty', 'query', query)
    }

    if (query.length > 8000) {
      return createValidationErrorResponse(
        'query is too long (max 8000 characters)',
        'query',
        query.length,
        { maxLength: 8000, actualLength: query.length },
      )
    }

    // Generate embedding from query text
    const embedding = await generateEmbedding(query)

    // Perform vector search
    const service = new VectorMemoryService()
    const results = await service.searchSimilar(embedding.vector, {
      ...options,
      limit: options.limit ?? 10,
      threshold: options.threshold ?? 0.5,
    })

    return NextResponse.json({
      success: true,
      results,
      count: results.length,
      query: query.substring(0, 100), // Return truncated query for debugging
    })
  } catch (error) {
    logger.error('Error in text-based memory search', error instanceof Error ? error : undefined)
    return createErrorResponse(error, {
      endpoint: '/api/memory/search-text',
      operation: 'memory_search_text',
    })
  }
}
