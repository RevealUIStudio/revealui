/**
 * Session API Route
 *
 * GET /api/auth/session
 *
 * Returns the current session for the authenticated user.
 */

import { getSession } from '@revealui/auth/server'
import { type NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession(request.headers)

    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      session: {
        id: session.session.id,
        expiresAt: session.session.expiresAt,
        createdAt: session.session.createdAt,
      },
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        avatarUrl: session.user.avatarUrl,
        role: session.user.role,
      },
    })
  } catch (error) {
    console.error('Error getting session:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
