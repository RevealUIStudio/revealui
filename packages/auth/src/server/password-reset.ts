/**
 * Password Reset Utilities
 *
 * Token generation and validation for password reset flows.
 * Tokens are stored in the database with expiry and single-use enforcement.
 */

import crypto from 'node:crypto'
import { logger } from '@revealui/core'
import { getClient } from '@revealui/db/client'
import { passwordResetTokens } from '@revealui/db/schema'
import { users } from '@revealui/db/schema'
import bcrypt from 'bcryptjs'
import { and, eq, gt, isNull } from 'drizzle-orm'

export interface PasswordResetToken {
  token: string
  expiresAt: Date
}

export interface PasswordResetResult {
  success: boolean
  error?: string
  token?: string
}

const TOKEN_EXPIRY_MS = 60 * 60 * 1000 // 1 hour

/**
 * Hash a token using SHA-256 for secure storage
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

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
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)

    if (!user) {
      // Don't reveal if user exists (security best practice)
      return {
        success: true,
        token: crypto.randomBytes(32).toString('hex'),
      }
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = hashToken(token)
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS)
    const id = crypto.randomUUID()

    // Store hashed token in database
    await db.insert(passwordResetTokens).values({
      id,
      userId: user.id,
      tokenHash,
      expiresAt,
    })

    return {
      success: true,
      token,
    }
  } catch (error) {
    logger.error('Error generating password reset token', { error })
    return {
      success: false,
      error: 'Failed to generate reset token',
    }
  }
}

/**
 * Validates a password reset token
 *
 * @param token - Reset token (plain text)
 * @returns User ID if valid, null otherwise
 */
export async function validatePasswordResetToken(token: string): Promise<string | null> {
  try {
    const db = getClient()
    const tokenHash = hashToken(token)

    const [entry] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          gt(passwordResetTokens.expiresAt, new Date()),
          isNull(passwordResetTokens.usedAt),
        ),
      )
      .limit(1)

    if (!entry) {
      return null
    }

    return entry.userId
  } catch (error) {
    logger.error('Error validating password reset token', { error })
    return null
  }
}

/**
 * Resets password using a token
 *
 * @param token - Reset token (plain text)
 * @param newPassword - New password
 * @returns Success result
 */
export async function resetPasswordWithToken(
  token: string,
  newPassword: string,
): Promise<PasswordResetResult> {
  try {
    const db = getClient()
    const tokenHash = hashToken(token)

    // Find valid token
    const [entry] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          gt(passwordResetTokens.expiresAt, new Date()),
          isNull(passwordResetTokens.usedAt),
        ),
      )
      .limit(1)

    if (!entry) {
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
    await db.update(users).set({ passwordHash }).where(eq(users.id, entry.userId))

    // Mark token as used (single-use enforcement)
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, entry.id))

    return {
      success: true,
    }
  } catch (error) {
    logger.error('Error resetting password', { error })
    return {
      success: false,
      error: 'Failed to reset password',
    }
  }
}

/**
 * Invalidates a password reset token
 *
 * @param token - Reset token (plain text)
 */
export async function invalidatePasswordResetToken(token: string): Promise<void> {
  try {
    const db = getClient()
    const tokenHash = hashToken(token)

    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.tokenHash, tokenHash))
  } catch (error) {
    logger.error('Error invalidating password reset token', { error })
  }
}
