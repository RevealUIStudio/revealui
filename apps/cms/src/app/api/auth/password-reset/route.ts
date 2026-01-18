/**
 * Password Reset API Route
 *
 * POST /api/auth/password-reset
 *
 * Generates a password reset token and sends reset email.
 * PUT /api/auth/password-reset
 *
 * Resets password using a reset token.
 */

import { generatePasswordResetToken, resetPasswordWithToken } from '@revealui/auth/server'
import { logger } from '@revealui/core/utils/logger'
import { type NextRequest, NextResponse } from 'next/server'
import { sendPasswordResetEmail } from '@/lib/email'
import { withRateLimit } from '@/lib/middleware/rate-limit'
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response'
import { sanitizeEmail } from '@/lib/utils/sanitize'

export const dynamic = 'force-dynamic'

async function passwordResetRequestHandler(request: NextRequest): Promise<NextResponse> {
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

    let { email } = body as { email?: unknown }

    if (!email) {
      return createValidationErrorResponse('Email is required', 'email', null)
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

    const result = await generatePasswordResetToken(email)

    if (!result.success) {
      return createApplicationErrorResponse(
        result.error || 'Failed to generate reset token',
        'PASSWORD_RESET_TOKEN_GENERATION_FAILED',
        500,
      )
    }

    // Send email with reset link
    if (result.token) {
      const emailResult = await sendPasswordResetEmail(email, result.token)

      if (!emailResult.success) {
        // Log error but don't reveal to user (security)
        logger.error('Failed to send password reset email', {
          email,
          error: emailResult.error,
        })
        // Still return success to prevent user enumeration
      }
    }

    // Always return success message (don't reveal if user exists)
    return NextResponse.json({
      message: 'If an account exists with this email, a password reset link has been sent.',
    })
  } catch (error) {
    logger.error('Error generating password reset token', { error })
    return createErrorResponse(error, {
      endpoint: '/api/auth/password-reset',
      operation: 'password_reset_request',
    })
  }
}

async function passwordResetTokenHandler(request: NextRequest): Promise<NextResponse> {
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

    const { token, password } = body as { token?: unknown; password?: unknown }

    if (!token || !password) {
      return createValidationErrorResponse('Token and password are required', 'body', {
        token: !!token,
        password: !!password,
      })
    }

    if (typeof token !== 'string') {
      return createValidationErrorResponse('Token must be a string', 'token', token)
    }

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

    const result = await resetPasswordWithToken(token, password)

    if (!result.success) {
      return createApplicationErrorResponse(
        result.error || 'Failed to reset password',
        'PASSWORD_RESET_FAILED',
        400,
        {
          reason: result.error,
        },
      )
    }

    return NextResponse.json({
      message: 'Password reset successfully',
    })
  } catch (error) {
    logger.error('Error resetting password', { error })
    return createErrorResponse(error, {
      endpoint: '/api/auth/password-reset',
      operation: 'password_reset_token',
    })
  }
}

// Export rate-limited handlers
export const POST = withRateLimit(passwordResetRequestHandler, {
  maxAttempts: 3,
  windowMs: 60 * 60 * 1000, // 1 hour
  keyPrefix: 'password-reset',
})

export const PUT = withRateLimit(passwordResetTokenHandler, {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  keyPrefix: 'password-reset-token',
})
