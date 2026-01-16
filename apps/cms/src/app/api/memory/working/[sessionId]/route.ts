/**
 * Working Memory API Routes
 *
 * GET /api/memory/working/:sessionId - Get working memory
 * POST /api/memory/working/:sessionId - Update working memory
 */

import { WorkingMemory } from '@revealui/ai/memory/memory'
import { CRDTPersistence } from '@revealui/ai/memory/persistence'
import { getClient } from '@revealui/db/client'
import { type NextRequest, NextResponse } from 'next/server'
import { getNodeIdFromSession } from '@/lib/utilities/nodeId'

export const dynamic = 'force-dynamic'

/**
 * GET /api/memory/working/:sessionId
 * Gets working memory for a session.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<NextResponse> {
  try {
    const { sessionId } = await params

    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid sessionId: must be a non-empty string' },
        { status: 400 },
      )
    }

    const db = getClient()
    const persistence = new CRDTPersistence(db)
    const nodeId = await getNodeIdFromSession(sessionId, db)

    const memory = new WorkingMemory(sessionId, nodeId, persistence)
    await memory.load()

    return NextResponse.json({
      sessionId: memory.getSessionId(),
      context: memory.getContext(),
      sessionState: memory.getSessionState(),
      activeAgents: memory.getActiveAgents(),
    })
  } catch (error) {
    const { handleApiError, handleDatabaseError } = await import('@revealui/core/utils/errors')
    const { logger } = await import('@revealui/core/utils/logger')
    
    try {
      handleDatabaseError(error, 'get-working-memory', { sessionId })
    } catch (dbError) {
      const errorInfo = handleApiError(dbError, { endpoint: 'working-memory-get', sessionId })
      logger.error('Error getting working memory', { error, sessionId, ...errorInfo })
      return NextResponse.json({ error: errorInfo.message }, { status: errorInfo.statusCode })
    }
    
    // Fallback if not a database error
    const errorInfo = handleApiError(error, { endpoint: 'working-memory-get', sessionId })
    logger.error('Error getting working memory', { error, sessionId, ...errorInfo })
    return NextResponse.json({ error: errorInfo.message }, { status: errorInfo.statusCode })
  }
}

/**
 * POST /api/memory/working/:sessionId
 * Updates working memory for a session.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<NextResponse> {
  try {
    const { sessionId } = await params

    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid sessionId: must be a non-empty string' },
        { status: 400 },
      )
    }

    const body = await request.json()
    const { context, sessionState, activeAgents } = body

    const db = getClient()
    const persistence = new CRDTPersistence(db)
    const nodeId = await getNodeIdFromSession(sessionId, db)

    const memory = new WorkingMemory(sessionId, nodeId, persistence)
    await memory.load()

    // Update context if provided
    if (context !== undefined) {
      if (typeof context === 'object' && context !== null) {
        memory.setContext(context as Record<string, unknown>)
      }
    }

    // Update session state if provided
    if (sessionState !== undefined) {
      memory.updateSessionState(sessionState)
    }

    // Update active agents if provided
    if (Array.isArray(activeAgents)) {
      // Remove all existing agents and add new ones
      // Note: This is a simplified approach. In production, you'd want
      // to merge intelligently rather than replace
      const currentAgents = memory.getActiveAgents()
      for (const agent of currentAgents) {
        // Remove by agent ID
        memory.removeAgentById(agent.id)
      }

      // Add new agents
      for (const agent of activeAgents) {
        memory.addAgent(agent)
      }
    }

    await memory.save()

    return NextResponse.json({
      success: true,
      sessionId: memory.getSessionId(),
      context: memory.getContext(),
      sessionState: memory.getSessionState(),
      activeAgents: memory.getActiveAgents(),
    })
  } catch (error) {
    const { handleApiError, handleDatabaseError } = await import('@revealui/core/utils/errors')
    const { logger } = await import('@revealui/core/utils/logger')
    
    try {
      handleDatabaseError(error, 'update-working-memory', { sessionId })
    } catch (dbError) {
      const errorInfo = handleApiError(dbError, { endpoint: 'working-memory-post', sessionId })
      logger.error('Error updating working memory', { error, sessionId, ...errorInfo })
      return NextResponse.json({ error: errorInfo.message }, { status: errorInfo.statusCode })
    }
    
    // Fallback if not a database error
    const errorInfo = handleApiError(error, { endpoint: 'working-memory-post', sessionId })
    logger.error('Error updating working memory', { error, sessionId, ...errorInfo })
    return NextResponse.json({ error: errorInfo.message }, { status: errorInfo.statusCode })
  }
}
