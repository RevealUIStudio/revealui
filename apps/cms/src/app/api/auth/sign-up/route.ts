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
import { count, eq, sql } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { sendVerificationEmail } from '@/lib/email/verification'
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
    const tosAcceptedAt = new Date()
    const tosVersion = process.env.TOS_VERSION ?? '2026-03-01'

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
        // Use an advisory lock inside a transaction to serialize concurrent sign-up
        // limit checks. Without this, two simultaneous requests can both pass the
        // count check before either creates a user (TOCTOU). The lock is held for
        // the transaction duration — concurrent requests queue behind it and will
        // read the updated count after the first completes.
        // Note: signUp() runs after this transaction; for full atomicity it would
        // need to be inside the same transaction (requires auth package changes).
        let limitExceeded = false
        let limitMsg = ''
        await db.transaction(async (tx) => {
          await tx.execute(sql`SELECT pg_advisory_xact_lock(42000001)`)
          const [row] = await tx
            .select({ total: count() })
            .from(users)
            .where(eq(users.status, 'active'))
          const activeCount = row?.total ?? 0
          if (activeCount >= maxUsers) {
            limitExceeded = true
            limitMsg = `User limit reached (${activeCount}/${maxUsers}). Upgrade your license to add more users.`
          }
        })
        if (limitExceeded) {
          return createApplicationErrorResponse(limitMsg, 'USER_LIMIT_REACHED', 403)
        }
      }
    } catch (limitError) {
      logger.error('User limit check failed during sign-up', {
        error: limitError instanceof Error ? limitError.message : String(limitError),
      })
      return createApplicationErrorResponse(
        'Unable to verify account limits. Please try again.',
        'LIMIT_CHECK_FAILED',
        503,
      )
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
      tosAcceptedAt,
      tosVersion,
    })

    if (!result.success) {
      return createApplicationErrorResponse(
        result.error || 'Unable to create account',
        'SIGNUP_FAILED',
        400,
      )
    }

    // Send verification email (fire-and-forget — don't block signup)
    if (result.user?.email && result.user?.emailVerificationToken) {
      sendVerificationEmail(result.user.email, result.user.emailVerificationToken).catch(
        (emailError) => {
          logger.warn('Failed to send verification email', {
            userId: result.user?.id,
            error: emailError,
          })
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
        emailVerified: result.user?.emailVerified ?? false,
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
