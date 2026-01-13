/**
 * Episodic Memory API Routes
 *
 * GET /api/memory/episodic/:userId - Get episodic memories
 * POST /api/memory/episodic/:userId - Add memory
 * DELETE /api/memory/episodic/:userId/:memoryId - Remove memory
 */

import { getClient } from '@revealui/db/client'
import { EpisodicMemory } from '@revealui/ai/memory/memory'
import { CRDTPersistence } from '@revealui/ai/memory/persistence'
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
  try {
    const { userId } = await params

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
    console.error('Error getting episodic memory:', error)

    if (error instanceof Error) {
      if (error.message.includes('Invalid')) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      if (error.message.includes('database') || error.message.includes('connection')) {
        return NextResponse.json({ error: 'Database error occurred' }, { status: 500 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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
  try {
    const { userId } = await params

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
    console.error('Error adding episodic memory:', error)

    if (error instanceof Error) {
      if (error.message.includes('Invalid') || error.message.includes('embedding')) {
        return NextResponse.json(
          { error: error.message },
          { status: error.message.includes('embedding') ? 422 : 400 },
        )
      }
      if (error.message.includes('database') || error.message.includes('connection')) {
        return NextResponse.json({ error: 'Database error occurred' }, { status: 500 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
