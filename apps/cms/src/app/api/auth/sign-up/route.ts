/**
 * Sign Up API Route
 *
 * POST /api/auth/sign-up
 *
 * Creates a new user account.
 */

import { signUp } from '@revealui/auth/server'
import { logger } from '@revealui/core/utils/logger'
import { type NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/middleware/rate-limit'
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response'
import { sanitizeEmail, sanitizeName } from '@/lib/utils/sanitize'

export const dynamic = 'force-dynamic'

async function signUpHandler(request: NextRequest): Promise<NextResponse> {
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

    let { email, password, name } = body as { email?: unknown; password?: unknown; name?: unknown }

    if (!email || !password || !name) {
      return createValidationErrorResponse('Email, password, and name are required', 'body', {
        email: !!email,
        password: !!password,
        name: !!name,
      })
    }

    // Sanitize inputs
    if (typeof email !== 'string') {
      return createValidationErrorResponse('Email must be a string', 'email', email)
    }
    const sanitizedEmail = sanitizeEmail(email)
    if (!sanitizedEmail) {
      return createValidationErrorResponse('Invalid email format', 'email', email)
    }
    email = sanitizedEmail

    if (typeof name !== 'string') {
      return createValidationErrorResponse('Name must be a string', 'name', name)
    }
    const sanitizedName = sanitizeName(name)
    if (!sanitizedName || sanitizedName.length === 0) {
      return createValidationErrorResponse('Name is required and must be valid', 'name', name)
    }
    name = sanitizedName

    // Validate password strength (handled by auth package, but check length here)
    if (typeof password !== 'string') {
      return createValidationErrorResponse('Password must be a string', 'password', null)
    }
    if (password.length < 8) {
      return createValidationErrorResponse(
        'Password must be at least 8 characters',
        'password',
        null,
        {
          minLength: 8,
          actualLength: password.length,
        },
      )
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
      return createApplicationErrorResponse(
        result.error || 'Failed to create account',
        'SIGNUP_FAILED',
        400,
        {
          email,
          reason: result.error,
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
    logger.error('Error signing up', { error })
    return createErrorResponse(error, {
      endpoint: '/api/auth/sign-up',
      operation: 'sign_up',
    })
  }
}

// Export rate-limited handler
export const POST = withRateLimit(signUpHandler, {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  keyPrefix: 'signup',
})
