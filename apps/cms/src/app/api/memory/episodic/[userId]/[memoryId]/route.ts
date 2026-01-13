/**
 * Episodic Memory Update/Delete Route
 *
 * PUT /api/memory/episodic/:userId/:memoryId - Update memory
 * DELETE /api/memory/episodic/:userId/:memoryId - Remove memory
 */

import { EpisodicMemory } from '@revealui/ai/memory/memory'
import { CRDTPersistence } from '@revealui/ai/memory/persistence'
import { getClient } from '@revealui/db/client'
import { agentMemories, eq } from '@revealui/db/core'
import type { AgentMemory } from '@revealui/schema/agents'
import { EmbeddingSchema } from '@revealui/schema/representation'
import { type NextRequest, NextResponse } from 'next/server'
import { getNodeIdFromUser } from '@/lib/utilities/nodeId'

// Infer Database type from getClient return type
type Database = ReturnType<typeof getClient>

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
      const jsonBody = (await request.json()) as Partial<AgentMemory>
      body = jsonBody
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }

    const db: Database = getClient()
    const persistence = new CRDTPersistence(db)
    const nodeId = await getNodeIdFromUser(userId, db)

    const memory = new EpisodicMemory(userId, nodeId, db, persistence)
    await memory.load()

    // Check if memory exists
    const existingMemory: AgentMemory | null = await memory.get(memoryId)
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
      source?: AgentMemory['source']
      embedding?: number[] | null
      embeddingMetadata?: AgentMemory['embedding'] | null
      metadata?: AgentMemory['metadata']
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
      if (body.metadata?.siteId && typeof body.metadata.siteId === 'string') {
        updateData.siteId = body.metadata.siteId
      }
      if (
        body.metadata?.custom &&
        typeof body.metadata.custom === 'object' &&
        body.metadata.custom !== null &&
        !Array.isArray(body.metadata.custom)
      ) {
        if ('agentId' in body.metadata.custom && typeof body.metadata.custom.agentId === 'string') {
          updateData.agentId = body.metadata.custom.agentId
        }
      }
    }

    if (body.verified !== undefined) {
      updateData.verified = body.verified
    }

    if (body.metadata?.expiresAt !== undefined) {
      const expiresAt = body.metadata.expiresAt
      updateData.expiresAt = typeof expiresAt === 'string' ? new Date(expiresAt) : null
    }

    // Update in database
    await db.update(agentMemories).set(updateData).where(eq(agentMemories.id, memoryId))

    // Reload updated memory (will fetch fresh from database)
    // Clear cache by accessing private property (needed for fresh data)
    const memoryInstance = memory as unknown as { memoryCache: Map<string, AgentMemory> }
    memoryInstance.memoryCache.delete(memoryId)

    const updatedMemory: AgentMemory | null = await memory.get(memoryId)

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

    const db: Database = getClient()
    const persistence = new CRDTPersistence(db)
    const nodeId = await getNodeIdFromUser(userId, db)

    const memory = new EpisodicMemory(userId, nodeId, db, persistence)
    await memory.load()

    const count: number = await memory.removeById(memoryId)
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
