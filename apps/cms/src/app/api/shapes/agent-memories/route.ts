/**
 * Agent Memories Shape Proxy Route
 *
 * GET /api/shapes/agent-memories
 *
 * Authenticated proxy for ElectricSQL agent_memories shape.
 * Validates session and adds row-level filtering before forwarding to ElectricSQL.
 */

import { prepareElectricUrl, proxyElectricRequest } from '@/lib/api/electric-proxy'
import { getSession } from '@revealui/auth/server'
import { type NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Validate session using RevealUI auth
    const session = await getSession(request.headers)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Build the ElectricSQL URL with row-level filtering
    const originUrl = prepareElectricUrl(request.url)
    originUrl.searchParams.set('table', 'agent_memories')
    
    // Add row-level filtering based on user/agent (SQL injection safe)
    // Validate user ID is a valid UUID format
    const userId = session.user.id
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }
    
    // Use parameterized query format for ElectricSQL
    originUrl.searchParams.set('where', `agent_id = $1`)
    originUrl.searchParams.set('params', JSON.stringify([userId]))

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
