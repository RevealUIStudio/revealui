/**
 * Password Reset API Route
 *
 * POST /api/auth/password-reset
 *
 * Generates a password reset token and sends reset email (or returns token for testing).
 * PUT /api/auth/password-reset
 *
 * Resets password using a reset token.
 */

import { generatePasswordResetToken, resetPasswordWithToken } from '@revealui/auth/server'
import { type NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    const result = await generatePasswordResetToken(email)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to generate reset token' },
        { status: 500 }
      )
    }

    // In production, send email with reset link
    // For now, return token in response (for testing)
    // TODO: Send email with reset link instead
    // await sendPasswordResetEmail(email, result.token)

    return NextResponse.json({
      message: 'Password reset token generated',
      // In production, don't return token - send via email
      // token: result.token, // Remove in production
    })
  } catch (error) {
    console.error('Error generating password reset token:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const { token, password } = body

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      )
    }

    const result = await resetPasswordWithToken(token, password)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to reset password' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      message: 'Password reset successfully',
    })
  } catch (error) {
    console.error('Error resetting password:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
