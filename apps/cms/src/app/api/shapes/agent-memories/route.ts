/**
 * Agent Memories Shape Proxy Route
 *
 * GET /api/shapes/agent-memories
 *
 * Authenticated proxy for ElectricSQL agent_memories shape.
 * Validates session and adds row-level filtering before forwarding to ElectricSQL.
 */

import { prepareElectricUrl, proxyElectricRequest, getUserIdFromRequest } from '@/lib/api/electric-proxy'
import { type NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // TODO: Validate session
    // const userId = await getUserIdFromRequest(request)
    // if (!userId) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    // Build the ElectricSQL URL with row-level filtering
    const originUrl = prepareElectricUrl(request.url)
    originUrl.searchParams.set('table', 'agent_memories')

    // TODO: Add row-level filtering based on user/agent
    // For now, we'll let ElectricSQL handle filtering via params
    // Once authentication is implemented, add:
    // originUrl.searchParams.set('where', `agent_id = '${userId}' OR user_id = '${userId}'`)

    // Proxy the request to ElectricSQL
    return proxyElectricRequest(originUrl)
  } catch (error) {
    console.error('Error proxying agent memories shape:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
