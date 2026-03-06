/**
 * Sign In API Route
 *
 * POST /api/auth/sign-in
 *
 * Authenticates a user with email and password.
 */

import { signIn } from '@revealui/auth/server'
import { SignInRequestContract } from '@revealui/contracts'
import { logger } from '@revealui/core/utils/logger'
import { type NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/middleware/rate-limit'
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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

    // Validate request body using contract
    const validationResult = SignInRequestContract.validate(body)

    if (!validationResult.success) {
      // Extract first validation error for user-friendly response
      const firstIssue = validationResult.errors.issues[0]
      return createValidationErrorResponse(
        firstIssue?.message || 'Validation failed',
        firstIssue?.path?.join('.') || 'body',
        body,
        {
          issues: validationResult.errors.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      )
    }

    // Contract automatically sanitizes email (lowercase, trim)
    const { email: sanitizedEmail, password } = validationResult.data

    // Get user agent and IP address for session tracking
    const userAgent = request.headers.get('user-agent') || undefined
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      undefined

    const result = await signIn(sanitizedEmail, password, {
      userAgent,
      ipAddress,
    })

    if (!result.success) {
      return createApplicationErrorResponse(
        result.error || 'Invalid email or password',
        'INVALID_CREDENTIALS',
        401,
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
        domain:
          process.env.NODE_ENV === 'production'
            ? process.env.SESSION_COOKIE_DOMAIN || '.revealui.com'
            : undefined,
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
  failClosed: true,
})
