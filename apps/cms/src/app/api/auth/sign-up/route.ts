/**
 * Sign Up API Route
 *
 * POST /api/auth/sign-up
 *
 * Creates a new user account.
 */

import { signUp } from '@revealui/auth/server'
import { handleApiError } from '@revealui/core/utils/errors'
import { logger } from '@revealui/core/utils/logger'
import { type NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/middleware/rate-limit'
import { sanitizeEmail, sanitizeName } from '@/lib/utils/sanitize'

export const dynamic = 'force-dynamic'

async function signUpHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    let { email, password, name } = body

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Email, password, and name are required' }, { status: 400 })
    }

    // Sanitize inputs
    const sanitizedEmail = sanitizeEmail(email)
    if (!sanitizedEmail) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }
    email = sanitizedEmail

    const sanitizedName = sanitizeName(name)
    if (!sanitizedName || sanitizedName.length === 0) {
      return NextResponse.json({ error: 'Name is required and must be valid' }, { status: 400 })
    }
    name = sanitizedName

    // Validate password strength (handled by auth package, but check length here)
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    // Get user agent and IP address for session tracking
    const userAgent = request.headers.get('user-agent') || undefined
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      undefined

    const result = await signUp(email, password, name, {
      userAgent,
      ipAddress,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to create account' },
        { status: 400 },
      )
    }

    // Create response with user data
    const response = NextResponse.json({
      user: {
        id: result.user?.id,
        email: result.user?.email,
        name: result.user?.name,
        avatarUrl: result.user?.avatarUrl,
        role: result.user?.role,
      },
    })

    // Set session cookie
    if (result.sessionToken) {
      response.cookies.set('revealui-session', result.sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      })
    }

    return response
  } catch (error) {
    const errorInfo = handleApiError(error, { endpoint: 'sign-up' })
    logger.error('Error signing up', { error, ...errorInfo })
    return NextResponse.json({ error: errorInfo.message }, { status: errorInfo.statusCode })
  }
}

// Export rate-limited handler
export const POST = withRateLimit(signUpHandler, {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  keyPrefix: 'signup',
})
