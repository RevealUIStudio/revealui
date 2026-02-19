/**
 * Password Reset Utilities
 *
 * Token generation and validation for password reset flows.
 * Tokens are stored in the database with expiry and single-use enforcement.
 */

import crypto from 'node:crypto'
import { logger } from '@revealui/core'
import { getClient } from '@revealui/db/client'
import { passwordResetTokens, users } from '@revealui/db/schema'
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
 * Hash a token using HMAC-SHA256 with a per-token salt.
 * The salt is stored in the DB alongside the hash; this defeats rainbow
 * table attacks even if the database is fully compromised.
 *
 * @param token - Plain-text token
 * @param salt  - 16-byte random salt (hex string)
 */
function hashToken(token: string, salt: string): string {
  return crypto.createHmac('sha256', salt).update(token).digest('hex')
}

/**
 * Generate a 16-byte random salt (hex string).
 */
function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex')
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

    // Generate secure token with per-token salt
    const token = crypto.randomBytes(32).toString('hex')
    const tokenSalt = generateSalt()
    const tokenHash = hashToken(token, tokenSalt)
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS)
    const id = crypto.randomUUID()

    // Store hashed token + salt in database (salt is not secret, just unique)
    await db.insert(passwordResetTokens).values({
      id,
      userId: user.id,
      tokenHash,
      tokenSalt,
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

    // We cannot look up by hash directly without the salt.
    // Strategy: find unexpired unused tokens for any user, then verify via HMAC.
    // To avoid full-table scans we include a time filter. In practice, there are
    // very few active reset tokens at any given moment.
    //
    // A common alternative is to encode the token ID in the reset URL (e.g.,
    // /reset?id=<uuid>&token=<token>), but this requires a URL format change.
    // For now we do a time-bounded scan — acceptable at low token volume.
    const candidates = await db
      .select()
      .from(passwordResetTokens)
      .where(and(gt(passwordResetTokens.expiresAt, new Date()), isNull(passwordResetTokens.usedAt)))

    for (const entry of candidates) {
      const expectedHash = hashToken(token, entry.tokenSalt)
      if (expectedHash === entry.tokenHash) {
        return entry.userId
      }
    }

    return null
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

    // Find valid token by HMAC verification (same time-bounded scan as validatePasswordResetToken)
    const candidates = await db
      .select()
      .from(passwordResetTokens)
      .where(and(gt(passwordResetTokens.expiresAt, new Date()), isNull(passwordResetTokens.usedAt)))

    let entry: (typeof candidates)[number] | undefined
    for (const candidate of candidates) {
      const expectedHash = hashToken(token, candidate.tokenSalt)
      if (expectedHash === candidate.tokenHash) {
        entry = candidate
        break
      }
    }

    if (!entry) {
      return {
        success: false,
        error: 'Invalid or expired reset token',
      }
    }

    // Validate password strength
    const { validatePasswordStrength } = await import('./password-validation.js')
    const passwordValidation = validatePasswordStrength(newPassword)
    if (!passwordValidation.valid) {
      return {
        success: false,
        error: passwordValidation.errors.join('. '),
      }
    }

    // Hash new password
    const password = await bcrypt.hash(newPassword, 12)

    // Update user password
    await db.update(users).set({ password }).where(eq(users.id, entry.userId))

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

    // Find the token entry by HMAC verification (time-bounded scan)
    const candidates = await db
      .select()
      .from(passwordResetTokens)
      .where(and(gt(passwordResetTokens.expiresAt, new Date()), isNull(passwordResetTokens.usedAt)))

    for (const candidate of candidates) {
      const expectedHash = hashToken(token, candidate.tokenSalt)
      if (expectedHash === candidate.tokenHash) {
        await db
          .update(passwordResetTokens)
          .set({ usedAt: new Date() })
          .where(eq(passwordResetTokens.id, candidate.id))
        break
      }
    }
  } catch (error) {
    logger.error('Error invalidating password reset token', { error })
  }
}
