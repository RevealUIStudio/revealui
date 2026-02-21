/**
 * Agent Contexts Shape Proxy Route
 *
 * GET /api/shapes/agent-contexts
 *
 * Authenticated proxy for ElectricSQL agent_contexts shape.
 * Filters by session_id (agent_contexts.session_id belongs to the auth session).
 */

import { getSession } from '@revealui/auth/server'
import { logger } from '@revealui/core/utils/logger'
import type { NextRequest, NextResponse } from 'next/server'
import { prepareElectricUrl, proxyElectricRequest } from '@/lib/api/electric-proxy'
import { createApplicationErrorResponse, createErrorResponse } from '@/lib/utils/error-response'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Validate session using RevealUI auth
    const session = await getSession(request.headers)

    if (!session) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401)
    }

    // Build the ElectricSQL URL with row-level filtering
    // Filter by session_id — agent_contexts are scoped to the auth session
    const originUrl = prepareElectricUrl(request.url)
    originUrl.searchParams.set('table', 'agent_contexts')
    originUrl.searchParams.set('where', 'session_id = $1')
    originUrl.searchParams.set('params', JSON.stringify([session.session.id]))

    return proxyElectricRequest(originUrl)
  } catch (error) {
    logger.error('Error proxying agent contexts shape', { error })
    return createErrorResponse(error, {
      endpoint: '/api/shapes/agent-contexts',
      operation: 'agent_contexts_proxy',
    })
  }
}
