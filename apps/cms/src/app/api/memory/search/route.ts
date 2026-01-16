/**
 * Vector Memory Search API
 *
 * POST /api/memory/search - Search memories using vector similarity
 *
 * This endpoint uses Supabase vector database for semantic search.
 */

import { VectorMemoryService } from '@revealui/ai/memory/vector'
import { handleApiError } from '@revealui/core/utils/errors'
import { logger } from '@revealui/core/utils/logger'
import { type NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

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
    const body = await request.json()
    const { queryEmbedding, options } = body

    // Validate query embedding
    if (!Array.isArray(queryEmbedding)) {
      return NextResponse.json(
        { error: 'queryEmbedding must be an array of numbers' },
        { status: 400 },
      )
    }

    if (queryEmbedding.length !== 1536) {
      return NextResponse.json(
        { error: `queryEmbedding must have 1536 dimensions, got ${queryEmbedding.length}` },
        { status: 400 },
      )
    }

    // Validate all elements are numbers
    if (!queryEmbedding.every((val) => typeof val === 'number')) {
      return NextResponse.json(
        { error: 'queryEmbedding must contain only numbers' },
        { status: 400 },
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
    const errorInfo = handleApiError(error, { endpoint: 'memory-search' })
    logger.error('Error searching memories', { error, ...errorInfo })
    return NextResponse.json({ error: errorInfo.message }, { status: errorInfo.statusCode })
  }
}