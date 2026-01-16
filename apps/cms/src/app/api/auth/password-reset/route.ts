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
import { handleApiError } from '@revealui/core/utils/errors'
import { logger } from '@revealui/core/utils/logger'
import { type NextRequest, NextResponse } from 'next/server'
import { sendPasswordResetEmail } from '@/lib/email'
import { withRateLimit } from '@/lib/middleware/rate-limit'
import { sanitizeEmail } from '@/lib/utils/sanitize'

export const dynamic = 'force-dynamic'

async function passwordResetRequestHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    let { email } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Sanitize email
    const sanitizedEmail = sanitizeEmail(email)
    if (!sanitizedEmail) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }
    email = sanitizedEmail

    const result = await generatePasswordResetToken(email)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to generate reset token' },
        { status: 500 },
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
    const errorInfo = handleApiError(error, { endpoint: 'password-reset-request' })
    logger.error('Error generating password reset token', { error, ...errorInfo })
    return NextResponse.json({ error: errorInfo.message }, { status: errorInfo.statusCode })
  }
}

async function passwordResetTokenHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const { token, password } = body

    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password are required' }, { status: 400 })
    }

    const result = await resetPasswordWithToken(token, password)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to reset password' },
        { status: 400 },
      )
    }

    return NextResponse.json({
      message: 'Password reset successfully',
    })
  } catch (error) {
    const errorInfo = handleApiError(error, { endpoint: 'password-reset-token' })
    logger.error('Error resetting password', { error, ...errorInfo })
    return NextResponse.json({ error: errorInfo.message }, { status: errorInfo.statusCode })
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
