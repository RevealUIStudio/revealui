/**
 * Sign In API Route
 *
 * POST /api/auth/sign-in
 *
 * Authenticates a user with email and password.
 */

import { signIn } from '@revealui/auth/server'
import { logger } from '@revealui/core/utils/logger'
import { type NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/middleware/rate-limit'
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response'
import { sanitizeEmail } from '@/lib/utils/sanitize'

export const dynamic = 'force-dynamic'

async function signInHandler(request: NextRequest): Promise<NextResponse> {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch (jsonError) {
      return createValidationErrorResponse('Invalid JSON in request body', 'body', null, {
        parseError: jsonError instanceof Error ? jsonError.message : 'Malformed JSON',
      })
    }

    if (!body || typeof body !== 'object') {
      return createValidationErrorResponse('Request body must be an object', 'body', body)
    }

    let { email, password } = body as { email?: unknown; password?: unknown }

    if (!email || !password) {
      return createValidationErrorResponse('Email and password are required', 'body', {
        email: !!email,
        password: !!password,
      })
    }

    // Sanitize email
    if (typeof email !== 'string') {
      return createValidationErrorResponse('Email must be a string', 'email', email)
    }
    const sanitizedEmail = sanitizeEmail(email)
    if (!sanitizedEmail) {
      return createValidationErrorResponse('Invalid email format', 'email', email)
    }
    email = sanitizedEmail

    // Get user agent and IP address for session tracking
    const userAgent = request.headers.get('user-agent') || undefined
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      undefined

    const result = await signIn(email, password, {
      userAgent,
      ipAddress,
    })

    if (!result.success) {
      return createApplicationErrorResponse(
        result.error || 'Invalid credentials',
        'INVALID_CREDENTIALS',
        401,
        {
          email,
        },
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
    logger.error('Error signing in', { error })
    return createErrorResponse(error, {
      endpoint: '/api/auth/sign-in',
      operation: 'sign_in',
    })
  }
}

// Export rate-limited handler
export const POST = withRateLimit(signInHandler, {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  keyPrefix: 'signin',
})
