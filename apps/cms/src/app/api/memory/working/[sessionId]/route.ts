/**
 * Working Memory API Routes
 *
 * GET /api/memory/working/:sessionId - Get working memory
 * POST /api/memory/working/:sessionId - Update working memory
 */

import { CRDTPersistence } from '@revealui/ai/memory/persistence'
import { WorkingMemory } from '@revealui/ai/memory/stores'
import { getSession } from '@revealui/auth/server'
import { logger } from '@revealui/core/observability/logger'
import { getClient } from '@revealui/db/client'
import { type NextRequest, NextResponse } from 'next/server'
import { getNodeIdFromSession } from '@/lib/utilities/nodeId'
import { createErrorResponse, createValidationErrorResponse } from '@/lib/utils/error-response'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/memory/working/:sessionId
 * Gets working memory for a session.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<NextResponse> {
  let sessionId: string | undefined

  try {
    const authSession = await getSession(request.headers)
    if (!authSession) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const paramsResolved = await params
    sessionId = paramsResolved.sessionId

    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim().length === 0) {
      return createValidationErrorResponse(
        'Invalid sessionId: must be a non-empty string',
        'sessionId',
        sessionId,
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
    logger.error('Error getting working memory', error instanceof Error ? error : undefined, {
      sessionId,
    })
    return createErrorResponse(error, {
      endpoint: '/api/memory/working/:sessionId',
      operation: 'working_memory_get',
      sessionId,
    })
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
  let sessionId: string | undefined

  try {
    const authSession = await getSession(request.headers)
    if (!authSession) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const paramsResolved = await params
    sessionId = paramsResolved.sessionId

    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim().length === 0) {
      return createValidationErrorResponse(
        'Invalid sessionId: must be a non-empty string',
        'sessionId',
        sessionId,
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

    const { context, sessionState, activeAgents } = body as {
      context?: unknown
      sessionState?: unknown
      activeAgents?: unknown
    }

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
    if (sessionState !== undefined && sessionState !== null) {
      memory.updateSessionState(sessionState as Record<string, unknown>)
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
    logger.error('Error updating working memory', error instanceof Error ? error : undefined, {
      sessionId,
    })
    return createErrorResponse(error, {
      endpoint: '/api/memory/working/:sessionId',
      operation: 'working_memory_post',
      sessionId,
    })
  }
}
