/**
 * Episodic Memory API Routes
 *
 * GET /api/memory/episodic/:userId - Get episodic memories
 * POST /api/memory/episodic/:userId - Add memory
 * DELETE /api/memory/episodic/:userId/:memoryId - Remove memory
 */

import { EpisodicMemory } from '@revealui/ai/memory/memory'
import { CRDTPersistence } from '@revealui/ai/memory/persistence'
import { getClient } from '@revealui/db/client'
import { handleApiError } from '@revealui/core/utils/errors'
import { logger } from '@revealui/core/utils/logger'
import type { AgentMemory } from '@revealui/schema/agents'
import { type NextRequest, NextResponse } from 'next/server'
import { getNodeIdFromUser } from '@/lib/utilities/nodeId'

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
    const errorInfo = handleApiError(error, { endpoint: 'episodic-memory-get', userId })
    logger.error('Error getting episodic memory', { error, userId, ...errorInfo })
    return NextResponse.json({ error: errorInfo.message }, { status: errorInfo.statusCode })
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
      return NextResponse.json(
        { error: 'Invalid userId: must be a non-empty string' },
        { status: 400 },
      )
    }

    const body = await request.json()
    const memoryData = body as AgentMemory

    if (!memoryData.id || !memoryData.content || !memoryData.type || !memoryData.source) {
      return NextResponse.json(
        { error: 'Memory must have id, content, type, and source' },
        { status: 400 },
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
    const errorInfo = handleApiError(error, { endpoint: 'episodic-memory-post', userId })
    logger.error('Error adding episodic memory', { error, userId, ...errorInfo })
    return NextResponse.json({ error: errorInfo.message }, { status: errorInfo.statusCode })
  }
}
