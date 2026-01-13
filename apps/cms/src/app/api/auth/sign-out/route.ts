/**
 * Sign Out API Route
 *
 * POST /api/auth/sign-out
 *
 * Signs out the current user by deleting their session.
 */

import { deleteSession } from '@revealui/auth/server'
import { type NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await deleteSession(request.headers)

    // Create response
    const response = NextResponse.json({
      success: true,
    })

    // Clear session cookie
    response.cookies.delete('revealui-session')

    return response
  } catch (error) {
    console.error('Error signing out:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
