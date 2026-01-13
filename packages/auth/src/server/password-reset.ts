/**
 * Password Reset Utilities
 *
 * Token generation and validation for password reset flows.
 */

import { getClient } from '@revealui/db/client'
import { users } from '@revealui/db/core'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

export interface PasswordResetToken {
  token: string
  expiresAt: Date
}

export interface PasswordResetResult {
  success: boolean
  error?: string
  token?: string
}

// In-memory store for reset tokens (reset on server restart)
// In production, store in database with expiration
const resetTokensStore = new Map<string, { userId: string; expiresAt: number }>()

const TOKEN_EXPIRY_MS = 60 * 60 * 1000 // 1 hour

/**
 * Generates a password reset token for a user
 *
 * @param email - User email
 * @returns Reset token and expiry
 */
export async function generatePasswordResetToken(email: string): Promise<PasswordResetResult> {
  try {
    const db = getClient()

    // Find user by email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    if (!user) {
      // Don't reveal if user exists (security best practice)
      return {
        success: true,
        token: crypto.randomBytes(32).toString('hex'),
      }
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = Date.now() + TOKEN_EXPIRY_MS

    // Store token (in production, store in database)
    resetTokensStore.set(token, {
      userId: user.id,
      expiresAt,
    })

    // Clean up expired tokens
    setTimeout(() => {
      resetTokensStore.delete(token)
    }, TOKEN_EXPIRY_MS)

    return {
      success: true,
      token,
    }
  } catch (error) {
    console.error('Error generating password reset token:', error)
    return {
      success: false,
      error: 'Failed to generate reset token',
    }
  }
}

/**
 * Validates a password reset token
 *
 * @param token - Reset token
 * @returns User ID if valid, null otherwise
 */
export function validatePasswordResetToken(token: string): string | null {
  const entry = resetTokensStore.get(token)

  if (!entry) {
    return null
  }

  if (Date.now() > entry.expiresAt) {
    resetTokensStore.delete(token)
    return null
  }

  return entry.userId
}

/**
 * Resets password using a token
 *
 * @param token - Reset token
 * @param newPassword - New password
 * @returns Success result
 */
export async function resetPasswordWithToken(
  token: string,
  newPassword: string
): Promise<PasswordResetResult> {
  try {
    // Validate token
    const userId = validatePasswordResetToken(token)
    if (!userId) {
      return {
        success: false,
        error: 'Invalid or expired reset token',
      }
    }

    // Validate password strength
    const { validatePasswordStrength } = await import('./password-validation')
    const passwordValidation = validatePasswordStrength(newPassword)
    if (!passwordValidation.valid) {
      return {
        success: false,
        error: passwordValidation.errors.join('. '),
      }
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12)

    // Update user password
    const db = getClient()
    await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, userId))

    // Delete token (one-time use)
    resetTokensStore.delete(token)

    return {
      success: true,
    }
  } catch (error) {
    console.error('Error resetting password:', error)
    return {
      success: false,
      error: 'Failed to reset password',
    }
  }
}

/**
 * Invalidates a password reset token (after use)
 *
 * @param token - Reset token
 */
export function invalidatePasswordResetToken(token: string): void {
  resetTokensStore.delete(token)
}
