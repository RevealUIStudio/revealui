/**
 * Sign Out API Route
 *
 * POST /api/auth/sign-out
 *
 * Signs out the current user by deleting their session.
 */

import { deleteSession } from '@revealui/auth/server'
import { handleApiError } from '@revealui/core/utils/errors'
import { logger } from '@revealui/core/utils/logger'
import { type NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/middleware/rate-limit'

export const dynamic = 'force-dynamic'

async function signOutHandler(request: NextRequest): Promise<NextResponse> {
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
    const errorInfo = handleApiError(error, { endpoint: 'sign-out' })
    logger.error('Error signing out', { error, ...errorInfo })
    return NextResponse.json({ error: errorInfo.message }, { status: errorInfo.statusCode })
  }
}

// Export rate-limited handler
export const POST = withRateLimit(signOutHandler, {
  maxAttempts: 10,
  windowMs: 15 * 60 * 1000, // 15 minutes
  keyPrefix: 'signout',
})
