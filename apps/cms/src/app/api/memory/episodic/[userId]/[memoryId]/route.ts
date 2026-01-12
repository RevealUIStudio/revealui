/**
 * Episodic Memory Update/Delete Route
 *
 * PUT /api/memory/episodic/:userId/:memoryId - Update memory
 * DELETE /api/memory/episodic/:userId/:memoryId - Remove memory
 */

import { getClient } from '@revealui/db/client'
import { agentMemories, eq } from '@revealui/db/core'
import { EpisodicMemory } from '@revealui/memory/core/memory'
import { CRDTPersistence } from '@revealui/memory/core/persistence'
import type { AgentMemory } from '@revealui/schema/agents'
import { EmbeddingSchema } from '@revealui/schema/representation'
import { type NextRequest, NextResponse } from 'next/server'
import { getNodeIdFromUser } from '@/lib/utilities/nodeId'

export const dynamic = 'force-dynamic'

/**
 * PUT /api/memory/episodic/:userId/:memoryId
 * Updates a memory in episodic memory.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string; memoryId: string }> },
): Promise<NextResponse> {
  try {
    const { userId, memoryId } = await params

    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid userId: must be a non-empty string' },
        { status: 400 },
      )
    }

    if (!memoryId || typeof memoryId !== 'string' || memoryId.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid memoryId: must be a non-empty string' },
        { status: 400 },
      )
    }

    // Parse request body
    let body: Partial<AgentMemory>
    try {
      body = await request.json()
    } catch (_error) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }

    const db = getClient()
    const persistence = new CRDTPersistence(db)
    const nodeId = await getNodeIdFromUser(userId, db)

    const memory = new EpisodicMemory(userId, nodeId, db, persistence)
    await memory.load()

    // Check if memory exists
    const existingMemory = await memory.get(memoryId)
    if (!existingMemory) {
      return NextResponse.json({ error: 'Memory not found' }, { status: 404 })
    }

    // Validate embedding if provided
    if (body.embedding) {
      const validationResult = EmbeddingSchema.safeParse(body.embedding)
      if (!validationResult.success) {
        return NextResponse.json(
          { error: `Invalid embedding structure: ${validationResult.error.message}` },
          { status: 400 },
        )
      }
    }

    // Build update object (only include fields that are provided)
    const updateData: {
      content?: string
      type?: string
      source?: unknown
      embedding?: number[] | null
      embeddingMetadata?: unknown | null
      metadata?: unknown
      verified?: boolean
      siteId?: string | null
      agentId?: string | null
      expiresAt?: Date | null
    } = {}

    if (body.content !== undefined) {
      if (typeof body.content !== 'string' || body.content.trim().length === 0) {
        return NextResponse.json({ error: 'content must be a non-empty string' }, { status: 400 })
      }
      updateData.content = body.content
    }

    if (body.type !== undefined) {
      updateData.type = body.type
    }

    if (body.source !== undefined) {
      updateData.source = body.source
    }

    if (body.embedding !== undefined) {
      updateData.embedding = body.embedding?.vector || null
      updateData.embeddingMetadata = body.embedding || null
    }

    if (body.metadata !== undefined) {
      updateData.metadata = body.metadata
      // Extract siteId and agentId from metadata if present
      if (body.metadata?.siteId) {
        updateData.siteId = body.metadata.siteId as string
      }
      if (
        body.metadata?.custom &&
        typeof body.metadata.custom === 'object' &&
        body.metadata.custom !== null
      ) {
        const custom = body.metadata.custom as Record<string, unknown>
        if (custom.agentId) {
          updateData.agentId = custom.agentId as string
        }
      }
    }

    if (body.verified !== undefined) {
      updateData.verified = body.verified
    }

    if (body.metadata?.expiresAt !== undefined) {
      updateData.expiresAt = body.metadata.expiresAt
        ? new Date(body.metadata.expiresAt as string)
        : null
    }

    // Update in database
    await db.update(agentMemories).set(updateData).where(eq(agentMemories.id, memoryId))

    // Reload updated memory (will fetch fresh from database)
    // Clear cache by accessing private property (needed for fresh data)
    const memoryInstance = memory as unknown as { memoryCache: Map<string, AgentMemory> }
    memoryInstance.memoryCache.delete(memoryId)

    const updatedMemory = await memory.get(memoryId)

    return NextResponse.json({
      success: true,
      memory: updatedMemory,
    })
  } catch (error) {
    console.error('Error updating episodic memory:', error)

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

/**
 * DELETE /api/memory/episodic/:userId/:memoryId
 * Removes a memory from episodic memory.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string; memoryId: string }> },
): Promise<NextResponse> {
  try {
    const { userId, memoryId } = await params

    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid userId: must be a non-empty string' },
        { status: 400 },
      )
    }

    if (!memoryId || typeof memoryId !== 'string' || memoryId.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid memoryId: must be a non-empty string' },
        { status: 400 },
      )
    }

    const db = getClient()
    const persistence = new CRDTPersistence(db)
    const nodeId = await getNodeIdFromUser(userId, db)

    const memory = new EpisodicMemory(userId, nodeId, db, persistence)
    await memory.load()

    const count = await memory.removeById(memoryId)
    await memory.save()

    return NextResponse.json({
      success: true,
      removed: count > 0,
      count,
    })
  } catch (error) {
    console.error('Error removing episodic memory:', error)

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
