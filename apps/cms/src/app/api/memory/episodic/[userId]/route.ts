/**
 * Episodic Memory API Routes
 *
 * GET /api/memory/episodic/:userId - Get episodic memories
 * POST /api/memory/episodic/:userId - Add memory
 * DELETE /api/memory/episodic/:userId/:memoryId - Remove memory
 */

import { EpisodicMemory } from '@revealui/ai/memory/memory'
import { CRDTPersistence } from '@revealui/ai/memory/persistence'
import type { AgentMemory } from '@revealui/contracts/agents'
import { logger } from '@revealui/core/utils/logger'
import { getClient } from '@revealui/db/client'
import { type NextRequest, NextResponse } from 'next/server'
import { getNodeIdFromUser } from '@/lib/utilities/nodeId'
import { createErrorResponse, createValidationErrorResponse } from '@/lib/utils/error-response'

export const dynamic = 'force-dynamic'

/**
 * GET /api/memory/episodic/:userId
 * Gets all episodic memories for a user.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
): Promise<NextResponse> {
  let userId: string | undefined

  try {
    const paramsResolved = await params
    userId = paramsResolved.userId

    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid userId: must be a non-empty string' },
        { status: 400 },
      )
    }

    const db = getClient()
    const persistence = new CRDTPersistence(db)
    const nodeId = await getNodeIdFromUser(userId, db)

    const memory = new EpisodicMemory(userId, nodeId, db, persistence)
    await memory.load()

    const memories = await memory.getAll()

    return NextResponse.json({
      userId: memory.getUserId(),
      memories,
      accessCount: memory.getAccessCount(),
    })
  } catch (error) {
    logger.error('Error getting episodic memory', { error, userId })
    return createErrorResponse(error, {
      endpoint: '/api/memory/episodic/:userId',
      operation: 'episodic_memory_get',
      userId,
    })
  }
}

/**
 * POST /api/memory/episodic/:userId
 * Adds a memory to episodic memory.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
): Promise<NextResponse> {
  let userId: string | undefined

  try {
    const paramsResolved = await params
    userId = paramsResolved.userId

    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      return createValidationErrorResponse(
        'Invalid userId: must be a non-empty string',
        'userId',
        userId,
      )
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

    const memoryData = body as AgentMemory

    if (!memoryData.id || !memoryData.content || !memoryData.type || !memoryData.source) {
      return createValidationErrorResponse(
        'Memory must have id, content, type, and source',
        'body',
        {
          hasId: !!memoryData.id,
          hasContent: !!memoryData.content,
          hasType: !!memoryData.type,
          hasSource: !!memoryData.source,
        },
      )
    }

    const db = getClient()
    const persistence = new CRDTPersistence(db)
    const nodeId = await getNodeIdFromUser(userId, db)

    const memory = new EpisodicMemory(userId, nodeId, db, persistence)
    await memory.load()

    const tag = await memory.add(memoryData)
    await memory.save()

    return NextResponse.json({
      success: true,
      tag,
      memoryId: memoryData.id,
    })
  } catch (error) {
    logger.error('Error adding episodic memory', { error, userId })
    return createErrorResponse(error, {
      endpoint: '/api/memory/episodic/:userId',
      operation: 'episodic_memory_post',
      userId,
    })
  }
}
