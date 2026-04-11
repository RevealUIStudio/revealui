/**
 * Password Reset Utilities
 *
 * Token generation and validation for password reset flows.
 * Tokens are stored in the database with expiry and single-use enforcement.
 */

import crypto from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db/client';
import { passwordResetTokens, sessions, users } from '@revealui/db/schema';
import bcrypt from 'bcryptjs';
import { and, eq, gt, isNull, ne } from 'drizzle-orm';

export interface PasswordResetToken {
  token: string;
  expiresAt: Date;
}

export interface PasswordResetResult {
  success: boolean;
  error?: string;
  token?: string;
  tokenId?: string;
}

const TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Hash a token using HMAC-SHA256 with a per-token salt.
 * The salt is stored in the DB alongside the hash; this defeats rainbow
 * table attacks even if the database is fully compromised.
 *
 * @param token - Plain-text token
 * @param salt  - 16-byte random salt (hex string)
 */
function hashToken(token: string, salt: string): string {
  return crypto.createHmac('sha256', salt).update(token).digest('hex');
}

/**
 * Generate a 16-byte random salt (hex string).
 */
function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Generates a password reset token for a user
 *
 * @param email - User email
 * @returns Reset token and expiry
 */
export async function generatePasswordResetToken(email: string): Promise<PasswordResetResult> {
  try {
    const db = getClient();

    // Find user by email — intentionally does NOT check user.password.
    // OAuth-only users (password: null) can use this flow to set a password,
    // giving them a fallback login method independent of their OAuth provider.
    // This is safe because the reset link is sent to their verified email.
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user) {
      // Don't reveal if user exists (security best practice)
      return {
        success: true,
        token: crypto.randomBytes(32).toString('hex'),
      };
    }

    // Invalidate any existing unused reset tokens for this user before creating a new one.
    // This limits active tokens to one per user, preventing table accumulation that would
    // slow the time-bounded full-table scan in validatePasswordResetToken.
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt)));

    // Generate secure token with per-token salt
    const token = crypto.randomBytes(32).toString('hex');
    const tokenSalt = generateSalt();
    const tokenHash = hashToken(token, tokenSalt);
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);
    const id = crypto.randomUUID();

    // Store hashed token + salt in database (salt is not secret, just unique)
    await db.insert(passwordResetTokens).values({
      id,
      userId: user.id,
      tokenHash,
      tokenSalt,
      expiresAt,
    });

    return {
      success: true,
      token,
      tokenId: id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isSchemaError =
      errorMessage.includes('column') ||
      errorMessage.includes('relation') ||
      errorMessage.includes('does not exist');

    if (isSchemaError) {
      logger.error(
        'Password reset token generation failed due to DB schema mismatch. ' +
          'Ensure migration 0006_add_password_reset_token_salt.sql has been applied.',
        error instanceof Error ? error : new Error(String(error)),
      );
    } else {
      logger.error(
        'Error generating password reset token',
        error instanceof Error ? error : new Error(String(error)),
      );
    }

    return {
      success: false,
      error: 'Failed to generate reset token',
    };
  }
}

/**
 * Validates a password reset token
 *
 * Uses O(1) lookup by token ID, then verifies the token hash with timingSafeEqual
 * against the single matching row.
 *
 * @param tokenId - Token row ID (from the reset URL)
 * @param token - Reset token (plain text, from the reset URL)
 * @returns User ID if valid, null otherwise
 */
export async function validatePasswordResetToken(
  tokenId: string,
  token: string,
): Promise<string | null> {
  try {
    const db = getClient();

    // O(1) lookup by primary key, filtered to unexpired and unused tokens
    const [entry] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.id, tokenId),
          gt(passwordResetTokens.expiresAt, new Date()),
          isNull(passwordResetTokens.usedAt),
        ),
      )
      .limit(1);

    if (!entry) {
      return null;
    }

    // Verify the token hash using timing-safe comparison
    const expectedHash = hashToken(token, entry.tokenSalt);
    const expectedBuf = Buffer.from(expectedHash);
    const actualBuf = Buffer.from(entry.tokenHash);
    if (expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf)) {
      return entry.userId;
    }

    return null;
  } catch (error) {
    logger.error(
      'Error validating password reset token',
      error instanceof Error ? error : new Error(String(error)),
    );
    return null;
  }
}

/**
 * Resets password using a token
 *
 * Uses O(1) lookup by token ID, then verifies the token hash.
 *
 * @param tokenId - Token row ID (from the reset URL)
 * @param token - Reset token (plain text, from the reset URL)
 * @param newPassword - New password
 * @returns Success result
 */
export async function resetPasswordWithToken(
  tokenId: string,
  token: string,
  newPassword: string,
): Promise<PasswordResetResult> {
  try {
    const db = getClient();

    // O(1) lookup by primary key, filtered to unexpired and unused tokens
    const [entry] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.id, tokenId),
          gt(passwordResetTokens.expiresAt, new Date()),
          isNull(passwordResetTokens.usedAt),
        ),
      )
      .limit(1);

    if (!entry) {
      return {
        success: false,
        error: 'Invalid or expired reset token',
      };
    }

    // Verify the token hash using timing-safe comparison
    const expectedHash = hashToken(token, entry.tokenSalt);
    const expectedBuf = Buffer.from(expectedHash);
    const actualBuf = Buffer.from(entry.tokenHash);
    if (
      !(expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf))
    ) {
      return {
        success: false,
        error: 'Invalid or expired reset token',
      };
    }

    // Validate password strength
    const { validatePasswordStrength, checkPasswordBreach } = await import(
      './password-validation.js'
    );
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      return {
        success: false,
        error: passwordValidation.errors.join('. '),
      };
    }

    // Check password against known data breaches (non-blocking on failure)
    const breachCount = await checkPasswordBreach(newPassword);
    if (breachCount > 0) {
      return {
        success: false,
        error: `This password has appeared in ${breachCount.toLocaleString()} data breaches. Please choose a different password.`,
      };
    }

    // Hash new password
    const password = await bcrypt.hash(newPassword, 12);

    // Update user password
    await db.update(users).set({ password }).where(eq(users.id, entry.userId));

    // Invalidate all existing sessions for this user so any attacker who had
    // a compromised session can no longer use it after the password change.
    await db.delete(sessions).where(eq(sessions.userId, entry.userId));

    // Mark token as used (single-use enforcement)
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, entry.id));

    return {
      success: true,
    };
  } catch (error) {
    logger.error(
      'Error resetting password',
      error instanceof Error ? error : new Error(String(error)),
    );
    return {
      success: false,
      error: 'Failed to reset password',
    };
  }
}

export interface ChangePasswordResult {
  success: boolean;
  error?: string;
}

/**
 * Change password for an authenticated user.
 *
 * Verifies the current password before updating. After a successful change,
 * invalidates all other sessions for the user (keeping the current session
 * active) to ensure any compromised sessions cannot persist.
 *
 * @param userId - Authenticated user ID
 * @param currentPassword - Plain-text current password to verify
 * @param newPassword - Plain-text new password to hash and store
 * @param currentSessionId - Session ID to preserve (all others will be deleted)
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  currentSessionId?: string,
): Promise<ChangePasswordResult> {
  try {
    const db = getClient();

    const [user] = await db
      .select({ id: users.id, password: users.password })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return { success: false, error: 'User not found.' };
    }

    if (!user.password) {
      return {
        success: false,
        error: 'No password is set on this account. Use the password reset link to set one.',
      };
    }

    const currentValid = await bcrypt.compare(currentPassword, user.password);
    if (!currentValid) {
      return { success: false, error: 'Current password is incorrect.' };
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await db.update(users).set({ password: newHash }).where(eq(users.id, userId));

    // Invalidate all other sessions so stolen/compromised sessions cannot persist.
    // This mirrors resetPasswordWithToken which deletes ALL sessions. Here we keep
    // the current session so the user stays logged in after changing their password.
    if (currentSessionId) {
      await db
        .delete(sessions)
        .where(and(eq(sessions.userId, userId), ne(sessions.id, currentSessionId)));
    } else {
      // No current session ID provided — delete all sessions as a safe default
      await db.delete(sessions).where(eq(sessions.userId, userId));
    }

    return { success: true };
  } catch (error) {
    logger.error(
      'Error changing password',
      error instanceof Error ? error : new Error(String(error)),
    );
    return { success: false, error: 'An unexpected error occurred.' };
  }
}

/**
 * Invalidates a password reset token
 *
 * Uses O(1) lookup by token ID, then verifies the token hash before marking as used.
 *
 * @param tokenId - Token row ID (from the reset URL)
 * @param token - Reset token (plain text, from the reset URL)
 */
export async function invalidatePasswordResetToken(tokenId: string, token: string): Promise<void> {
  try {
    const db = getClient();

    // O(1) lookup by primary key
    const [entry] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.id, tokenId),
          gt(passwordResetTokens.expiresAt, new Date()),
          isNull(passwordResetTokens.usedAt),
        ),
      )
      .limit(1);

    if (!entry) {
      return;
    }

    // Verify the token hash before invalidating
    const expectedHash = hashToken(token, entry.tokenSalt);
    const expectedBuf = Buffer.from(expectedHash);
    const actualBuf = Buffer.from(entry.tokenHash);
    if (expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf)) {
      await db
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.id, entry.id));
    }
  } catch (error) {
    logger.error(
      'Error invalidating password reset token',
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}
