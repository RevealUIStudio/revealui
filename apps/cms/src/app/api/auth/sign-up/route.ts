/**
 * Sign Up API Route
 *
 * POST /api/auth/sign-up
 *
 * Creates a new user account.
 */

import { isSignupAllowed, signUp } from '@revealui/auth/server'
import { SignUpRequestContract } from '@revealui/contracts'
import { getMaxUsers, initializeLicense } from '@revealui/core/license'
import { logger } from '@revealui/core/utils/logger'
import { getClient } from '@revealui/db'
import { users } from '@revealui/db/schema'
import { count, eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/middleware/rate-limit'
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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

    // Validate request body using contract
    const validationResult = SignUpRequestContract.validate(body)

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

    // Contract automatically sanitizes email (lowercase, trim) and name (trim, normalize spaces)
    const { email: sanitizedEmail, password, name: sanitizedName } = validationResult.data

    // Check signup whitelist before proceeding
    if (!isSignupAllowed(sanitizedEmail)) {
      return createApplicationErrorResponse(
        'Signups are currently restricted. Contact the administrator for access.',
        'SIGNUP_RESTRICTED',
        403,
      )
    }

    // Enforce user limit based on license tier (free: 3, pro: 25, enterprise: unlimited)
    try {
      await initializeLicense()
      const maxUsers = getMaxUsers()
      if (maxUsers !== Infinity) {
        const db = getClient()
        const [row] = await db
          .select({ total: count() })
          .from(users)
          .where(eq(users.status, 'active'))
        const activeCount = row?.total ?? 0
        if (activeCount >= maxUsers) {
          return createApplicationErrorResponse(
            `User limit reached (${activeCount}/${maxUsers}). Upgrade your license to add more users.`,
            'USER_LIMIT_REACHED',
            403,
          )
        }
      }
    } catch (limitError) {
      // Non-fatal — if limit check fails, allow signup to proceed
      logger.warn('User limit check failed during sign-up', { error: limitError })
    }

    // Get user agent and IP address for session tracking
    const userAgent = request.headers.get('user-agent') || undefined
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      undefined

    const result = await signUp(sanitizedEmail, password, sanitizedName, {
      userAgent,
      ipAddress,
    })

    if (!result.success) {
      return createApplicationErrorResponse(
        result.error || 'Unable to create account',
        'SIGNUP_FAILED',
        400,
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
        domain: process.env.NODE_ENV === 'production' ? '.revealui.com' : undefined,
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
