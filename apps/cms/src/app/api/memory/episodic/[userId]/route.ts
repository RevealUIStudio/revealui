/**
 * Episodic Memory API Routes
 *
 * GET /api/memory/episodic/:userId - Get episodic memories
 * POST /api/memory/episodic/:userId - Add memory
 * DELETE /api/memory/episodic/:userId/:memoryId - Remove memory
 */

import { CRDTPersistence } from '@revealui/ai/memory/persistence'
import { EpisodicMemory } from '@revealui/ai/memory/stores'
import { getSession } from '@revealui/auth/server'
import { AgentMemoryContract } from '@revealui/contracts'
import { logger } from '@revealui/core/observability/logger'
import { getClient } from '@revealui/db/client'
import { type NextRequest, NextResponse } from 'next/server'
import { getNodeIdFromUser } from '@/lib/utilities/nodeId'
import { createErrorResponse, createValidationErrorResponse } from '@/lib/utils/error-response'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/memory/episodic/:userId
 * Gets all episodic memories for a user.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
): Promise<NextResponse> {
  let userId: string | undefined

  try {
    const authSession = await getSession(request.headers)
    if (!authSession) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const paramsResolved = await params
    userId = paramsResolved.userId

    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      return createValidationErrorResponse(
        'Invalid userId: must be a non-empty string',
        'userId',
        userId,
      )
    }

    if (authSession.user.id !== userId && authSession.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
    logger.error('Error getting episodic memory', error instanceof Error ? error : undefined, {
      userId,
    })
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
    const authSession = await getSession(request.headers)
    if (!authSession) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const paramsResolved = await params
    userId = paramsResolved.userId

    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      return createValidationErrorResponse(
        'Invalid userId: must be a non-empty string',
        'userId',
        userId,
      )
    }

    if (authSession.user.id !== userId && authSession.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch (jsonError) {
      return createValidationErrorResponse('Invalid JSON in request body', 'body', null, {
        parseError: jsonError instanceof Error ? jsonError.message : 'Malformed JSON',
      })
    }

    // Validate request body using contract
    const validationResult = AgentMemoryContract.validate(body)

    if (!validationResult.success) {
      // Extract first validation error for user-friendly response
      const firstIssue = validationResult.errors.issues[0]
      return createValidationErrorResponse(
        firstIssue?.message || 'Validation failed',
        firstIssue?.path?.join('.') || 'body',
        body,
        {
          issues: validationResult.errors.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      )
    }

    const memoryData = validationResult.data

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
    logger.error('Error adding episodic memory', error instanceof Error ? error : undefined, {
      userId,
    })
    return createErrorResponse(error, {
      endpoint: '/api/memory/episodic/:userId',
      operation: 'episodic_memory_post',
      userId,
    })
  }
}
