/**
 * Session API Route
 *
 * GET /api/auth/session
 *
 * Returns the current user session.
 */

import { getSession } from '@revealui/auth/server'
import { handleApiError } from '@revealui/core/utils/errors'
import { logger } from '@revealui/core/utils/logger'
import { type NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession(request.headers)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        avatarUrl: session.user.avatarUrl,
        role: session.user.role,
      },
      session: {
        id: session.session.id,
        expiresAt: session.session.expiresAt.toISOString(),
      },
    })
  } catch (error) {
    const errorInfo = handleApiError(error, { endpoint: 'session' })
    logger.error('Error getting session', { error, ...errorInfo })
    return NextResponse.json({ error: errorInfo.message }, { status: errorInfo.statusCode })
  }
}
