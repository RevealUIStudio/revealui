/**
 * Episodic Memory Update/Delete Route
 *
 * PUT /api/memory/episodic/:userId/:memoryId - Update memory
 * DELETE /api/memory/episodic/:userId/:memoryId - Remove memory
 */

import { EpisodicMemory } from '@revealui/ai/memory/memory'
import { CRDTPersistence } from '@revealui/ai/memory/persistence'
import { getClient } from '@revealui/db/client'
import { handleApiError } from '@revealui/core/utils/errors'
import { logger } from '@revealui/core/utils/logger'
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
  let userId: string | undefined
  let memoryId: string | undefined
  
  try {
    const paramsResolved = await params
    userId = paramsResolved.userId
    memoryId = paramsResolved.memoryId

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

    // Build update object for EpisodicMemory/VectorMemoryService
    // Use EpisodicMemory's update mechanism which delegates to VectorMemoryService
    const updateData: Partial<AgentMemory> = {}

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
      updateData.embedding = body.embedding
    }

    if (body.metadata !== undefined) {
      updateData.metadata = body.metadata
    }

    if (body.verified !== undefined) {
      updateData.verified = body.verified
    }

    // Update access count and accessedAt when updating
    updateData.accessedAt = new Date().toISOString()

    // Use EpisodicMemory's incrementAccess to update access count
    // Then use VectorMemoryService via EpisodicMemory for the actual update
    // Since EpisodicMemory doesn't have an update method, we need to use VectorMemoryService directly
    const { VectorMemoryService } = await import('@revealui/ai/memory/vector')
    const vectorService = new VectorMemoryService()

    // Get current memory to preserve fields not being updated
    const currentMemory = await memory.get(memoryId)
    if (!currentMemory) {
      return NextResponse.json({ error: 'Memory not found' }, { status: 404 })
    }

    // Merge updates with current memory
    const updatedMemoryData: AgentMemory = {
      ...currentMemory,
      ...updateData,
      id: memoryId, // Ensure ID is preserved
    }

    // Update via VectorMemoryService
    const updatedMemory = await vectorService.update(memoryId, updatedMemoryData)

    // Clear cache in EpisodicMemory
    const memoryInstance = memory as unknown as { memoryCache: Map<string, AgentMemory> }
    memoryInstance.memoryCache.delete(memoryId)
    memoryInstance.memoryCache.set(memoryId, updatedMemory)

    return NextResponse.json({
      success: true,
      memory: updatedMemory,
    })
  } catch (error) {
    const errorInfo = handleApiError(error, { endpoint: 'episodic-memory-update', userId, memoryId })
    logger.error('Error updating episodic memory', { error, userId, memoryId, ...errorInfo })
    return NextResponse.json({ error: errorInfo.message }, { status: errorInfo.statusCode })
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
  let userId: string | undefined
  let memoryId: string | undefined
  
  try {
    const paramsResolved = await params
    userId = paramsResolved.userId
    memoryId = paramsResolved.memoryId

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
    const errorInfo = handleApiError(error, { endpoint: 'episodic-memory-delete', userId, memoryId })
    logger.error('Error removing episodic memory', { error, userId, memoryId, ...errorInfo })
    return NextResponse.json({ error: errorInfo.message }, { status: errorInfo.statusCode })
  }
}
