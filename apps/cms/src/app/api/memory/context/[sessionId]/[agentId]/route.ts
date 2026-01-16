/**
 * Agent Context API Routes
 *
 * GET /api/memory/context/:sessionId/:agentId - Get agent context
 * POST /api/memory/context/:sessionId/:agentId - Update agent context
 * DELETE /api/memory/context/:sessionId/:agentId - Remove context key
 */

import { AgentContextManager } from '@revealui/ai/memory/agent'
import {
  DatabaseConnectionError,
  DatabaseConstraintError,
  DatabaseOperationError,
  NotFoundError,
  ValidationError,
} from '@revealui/ai/memory/errors'
import { CRDTPersistence } from '@revealui/ai/memory/persistence'
import { getClient } from '@revealui/db/client'
import { handleApiError } from '@revealui/core/utils/errors'
import { logger } from '@revealui/core/utils/logger'
import { type NextRequest, NextResponse } from 'next/server'
import { getNodeIdFromSession } from '@/lib/utilities/nodeId'

export const dynamic = 'force-dynamic'

/**
 * GET /api/memory/context/:sessionId/:agentId
 * Gets agent context for a session and agent.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string; agentId: string }> },
): Promise<NextResponse> {
  let sessionId: string | undefined
  let agentId: string | undefined
  
  try {
    const paramsResolved = await params
    sessionId = paramsResolved.sessionId
    agentId = paramsResolved.agentId

    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid sessionId: must be a non-empty string' },
        { status: 400 },
      )
    }

    if (!agentId || typeof agentId !== 'string' || agentId.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid agentId: must be a non-empty string' },
        { status: 400 },
      )
    }

    const db = getClient()
    const persistence = new CRDTPersistence(db)
    const nodeId = await getNodeIdFromSession(sessionId, db)

    const manager = new AgentContextManager(sessionId, agentId, nodeId, db, persistence)
    await manager.load()

    return NextResponse.json({
      sessionId: manager.getSessionId(),
      agentId: manager.getAgentId(),
      context: manager.getAllContext(),
    })
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, { endpoint: 'context-get', sessionId, agentId })
    logger.error('Error getting agent context', { error, sessionId, agentId, ...errorInfo })
    return NextResponse.json({ error: errorInfo.message }, { status: errorInfo.statusCode })
  }
}

/**
 * POST /api/memory/context/:sessionId/:agentId
 * Updates agent context for a session and agent.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string; agentId: string }> },
): Promise<NextResponse> {
  let sessionId: string | undefined
  let agentId: string | undefined
  
  try {
    const paramsResolved = await params
    sessionId = paramsResolved.sessionId
    agentId = paramsResolved.agentId

    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid sessionId: must be a non-empty string' },
        { status: 400 },
      )
    }

    if (!agentId || typeof agentId !== 'string' || agentId.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid agentId: must be a non-empty string' },
        { status: 400 },
      )
    }

    // Parse request body with error handling
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch (_error: unknown) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }

    // Validate body is an object
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 })
    }

    // Support both single key-value and partial updates
    // If body has exactly one key and it's not 'context', treat as single key-value update
    // Otherwise, treat as partial context update
    const updates: Partial<Record<string, unknown>> = {}
    const keys = Object.keys(body)

    if (keys.length === 1 && keys[0] !== 'context') {
      // Single key-value update (e.g., { theme: 'dark' })
      updates[keys[0]!] = body[keys[0]!]
    } else {
      // Partial context update (e.g., { theme: 'dark', language: 'en' } or { context: {...} })
      Object.assign(updates, body)
    }

    const db = getClient()
    const persistence = new CRDTPersistence(db)
    const nodeId = await getNodeIdFromSession(sessionId, db)

    const manager = new AgentContextManager(sessionId, agentId, nodeId, db, persistence)
    await manager.load()
    manager.updateContext(updates)
    await manager.save()

    return NextResponse.json({
      success: true,
      sessionId: manager.getSessionId(),
      agentId: manager.getAgentId(),
      context: manager.getAllContext(),
    })
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, { endpoint: 'context-post', sessionId, agentId })
    logger.error('Error updating agent context', { error, sessionId, agentId, ...errorInfo })
    return NextResponse.json({ error: errorInfo.message }, { status: errorInfo.statusCode })
  }
}

/**
 * DELETE /api/memory/context/:sessionId/:agentId
 * Removes a context key.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string; agentId: string }> },
): Promise<NextResponse> {
  let sessionId: string | undefined
  let agentId: string | undefined
  
  try {
    const paramsResolved = await params
    sessionId = paramsResolved.sessionId
    agentId = paramsResolved.agentId

    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid sessionId: must be a non-empty string' },
        { status: 400 },
      )
    }

    if (!agentId || typeof agentId !== 'string' || agentId.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid agentId: must be a non-empty string' },
        { status: 400 },
      )
    }

    // Parse request body with error handling
    let body: { key?: string }
    try {
      body = await request.json()
    } catch (_error: unknown) {
      // For DELETE, body is optional, so empty object is acceptable
      body = {}
    }

    // Validate body is an object if provided
    if (body !== null && typeof body !== 'object') {
      return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 })
    }

    const { key } = body || {}

    if (!key || typeof key !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid key parameter' }, { status: 400 })
    }

    const db = getClient()
    const persistence = new CRDTPersistence(db)
    const nodeId = await getNodeIdFromSession(sessionId, db)

    const manager = new AgentContextManager(sessionId, agentId, nodeId, db, persistence)
    await manager.load()
    manager.removeContext(key)
    await manager.save()

    return NextResponse.json({
      success: true,
      sessionId: manager.getSessionId(),
      agentId: manager.getAgentId(),
      context: manager.getAllContext(),
    })
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, { endpoint: 'context-remove', sessionId, agentId })
    logger.error('Error removing context key', { error, sessionId, agentId, ...errorInfo })
    return NextResponse.json({ error: errorInfo.message }, { status: errorInfo.statusCode })
  }
}
