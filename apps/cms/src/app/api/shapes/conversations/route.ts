/**
 * Conversations Shape Proxy Route
 *
 * GET /api/shapes/conversations
 *
 * Authenticated proxy for ElectricSQL conversations shape.
 * Validates session and adds row-level filtering before forwarding to ElectricSQL.
 */

import { getSession } from '@revealui/auth/server'
import { type NextRequest, NextResponse } from 'next/server'
import { prepareElectricUrl, proxyElectricRequest } from '@/lib/api/electric-proxy'

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
    originUrl.searchParams.set('table', 'conversations')

    // Add row-level filtering based on user (SQL injection safe)
    // Validate user ID is a valid UUID format
    const userId = session.user.id
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    // Use parameterized query format for ElectricSQL
    originUrl.searchParams.set('where', `user_id = $1`)
    originUrl.searchParams.set('params', JSON.stringify([userId]))

    // Proxy the request to ElectricSQL
    return proxyElectricRequest(originUrl)
  } catch (error) {
    const { handleApiError } = await import('@revealui/core/utils/errors')
    const { logger } = await import('@revealui/core/utils/logger')
    const errorInfo = handleApiError(error, { endpoint: 'conversations' })
    logger.error('Error proxying conversations shape', { error, ...errorInfo })
    return NextResponse.json({ error: errorInfo.message }, { status: errorInfo.statusCode })
  }
}
