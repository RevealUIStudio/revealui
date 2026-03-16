/**
 * MFA/2FA — TOTP-based Multi-Factor Authentication
 *
 * Uses the timing-safe TOTP implementation from @revealui/core/security/auth.
 * Backup codes are bcrypt-hashed for storage (one-time use, consumed on verify).
 */

import { randomBytes } from 'node:crypto';
import { TwoFactorAuth } from '@revealui/core/security';
import { getClient } from '@revealui/db/client';
import { users } from '@revealui/db/schema';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

// =============================================================================
// Configuration
// =============================================================================

export interface MFAConfig {
  /** Number of backup codes to generate (default: 8) */
  backupCodeCount: number;
  /** Length of each backup code in bytes (default: 5, produces 10 hex chars) */
  backupCodeLength: number;
  /** Issuer name shown in authenticator apps */
  issuer: string;
}

const DEFAULT_MFA_CONFIG: MFAConfig = {
  backupCodeCount: 8,
  backupCodeLength: 5,
  issuer: 'RevealUI',
};

let config: MFAConfig = { ...DEFAULT_MFA_CONFIG };

export function configureMFA(overrides: Partial<MFAConfig>): void {
  config = { ...DEFAULT_MFA_CONFIG, ...overrides };
}

export function resetMFAConfig(): void {
  config = { ...DEFAULT_MFA_CONFIG };
}

// =============================================================================
// Backup Code Generation
// =============================================================================

/**
 * Generate a set of plaintext backup codes.
 * Returns both the plaintext codes (to show the user once) and bcrypt hashes (to store).
 */
async function generateBackupCodes(): Promise<{
  plaintext: string[];
  hashed: string[];
}> {
  const plaintext: string[] = [];
  const hashed: string[] = [];

  for (let i = 0; i < config.backupCodeCount; i++) {
    const code = randomBytes(config.backupCodeLength).toString('hex');
    plaintext.push(code);
    hashed.push(await bcrypt.hash(code, 10));
  }

  return { plaintext, hashed };
}

// =============================================================================
// TOTP Provisioning URI
// =============================================================================

/**
 * Build an otpauth:// URI for QR code generation in authenticator apps.
 */
function buildProvisioningUri(secret: string, email: string): string {
  const issuer = encodeURIComponent(config.issuer);
  const account = encodeURIComponent(email);
  return `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

// =============================================================================
// Public API
// =============================================================================

export interface MFASetupResult {
  success: boolean;
  /** Base32-encoded TOTP secret (show once) */
  secret?: string;
  /** otpauth:// URI for QR code */
  uri?: string;
  /** Plaintext backup codes (show once) */
  backupCodes?: string[];
  error?: string;
}

/**
 * Initiate MFA setup for a user.
 * Generates a TOTP secret and backup codes. The user must verify with a TOTP
 * code before MFA is activated (see `verifyMFASetup`).
 */
export async function initiateMFASetup(userId: string, email: string): Promise<MFASetupResult> {
  const db = getClient();

  // Check if MFA is already enabled
  const [user] = await db
    .select({ mfaEnabled: users.mfaEnabled })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  if (user.mfaEnabled) {
    return { success: false, error: 'MFA is already enabled' };
  }

  // Generate TOTP secret and backup codes
  const secret = TwoFactorAuth.generateSecret();
  const { plaintext, hashed } = await generateBackupCodes();
  const uri = buildProvisioningUri(secret, email);

  // Store secret and backup codes (MFA stays disabled until verified)
  await db
    .update(users)
    .set({
      mfaSecret: secret,
      mfaBackupCodes: hashed,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  return {
    success: true,
    secret,
    uri,
    backupCodes: plaintext,
  };
}

/**
 * Verify MFA setup by confirming the user's authenticator app works.
 * This activates MFA on the account.
 */
export async function verifyMFASetup(
  userId: string,
  code: string,
): Promise<{ success: boolean; error?: string }> {
  const db = getClient();

  const [user] = await db
    .select({ mfaSecret: users.mfaSecret, mfaEnabled: users.mfaEnabled })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  if (user.mfaEnabled) {
    return { success: false, error: 'MFA is already enabled' };
  }

  if (!user.mfaSecret) {
    return { success: false, error: 'MFA setup not initiated' };
  }

  // Verify the TOTP code against the stored secret
  const valid = TwoFactorAuth.verifyCode(user.mfaSecret, code);
  if (!valid) {
    return { success: false, error: 'Invalid verification code' };
  }

  // Activate MFA
  await db
    .update(users)
    .set({
      mfaEnabled: true,
      mfaVerifiedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  return { success: true };
}

/**
 * Verify a TOTP code during login (step 2 of MFA login flow).
 */
export async function verifyMFACode(
  userId: string,
  code: string,
): Promise<{ success: boolean; error?: string }> {
  const db = getClient();

  const [user] = await db
    .select({ mfaSecret: users.mfaSecret, mfaEnabled: users.mfaEnabled })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!(user?.mfaEnabled && user.mfaSecret)) {
    return { success: false, error: 'MFA not enabled' };
  }

  const valid = TwoFactorAuth.verifyCode(user.mfaSecret, code);
  if (!valid) {
    return { success: false, error: 'Invalid code' };
  }

  return { success: true };
}

/**
 * Verify a backup code (one-time use). Consumes the code on success.
 */
export async function verifyBackupCode(
  userId: string,
  code: string,
): Promise<{ success: boolean; remainingCodes?: number; error?: string }> {
  const db = getClient();

  const [user] = await db
    .select({ mfaBackupCodes: users.mfaBackupCodes, mfaEnabled: users.mfaEnabled })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.mfaEnabled) {
    return { success: false, error: 'MFA not enabled' };
  }

  const storedCodes = (user.mfaBackupCodes ?? []) as string[];
  if (storedCodes.length === 0) {
    return { success: false, error: 'No backup codes available' };
  }

  // Find and consume the matching backup code
  for (let i = 0; i < storedCodes.length; i++) {
    const storedCode = storedCodes[i];
    if (!storedCode) continue;
    const matches = await bcrypt.compare(code, storedCode);
    if (matches) {
      // Remove the consumed code
      const remaining = [...storedCodes.slice(0, i), ...storedCodes.slice(i + 1)];
      await db
        .update(users)
        .set({
          mfaBackupCodes: remaining,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      return { success: true, remainingCodes: remaining.length };
    }
  }

  return { success: false, error: 'Invalid backup code' };
}

/**
 * Regenerate backup codes (requires active MFA).
 */
export async function regenerateBackupCodes(
  userId: string,
): Promise<{ success: boolean; backupCodes?: string[]; error?: string }> {
  const db = getClient();

  const [user] = await db
    .select({ mfaEnabled: users.mfaEnabled })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.mfaEnabled) {
    return { success: false, error: 'MFA not enabled' };
  }

  const { plaintext, hashed } = await generateBackupCodes();

  await db
    .update(users)
    .set({
      mfaBackupCodes: hashed,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  return { success: true, backupCodes: plaintext };
}

/**
 * Disable MFA on a user account. Requires password confirmation.
 */
export async function disableMFA(
  userId: string,
  password: string,
): Promise<{ success: boolean; error?: string }> {
  const db = getClient();

  const [user] = await db
    .select({
      mfaEnabled: users.mfaEnabled,
      password: users.password,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  if (!user.mfaEnabled) {
    return { success: false, error: 'MFA is not enabled' };
  }

  if (!user.password) {
    return { success: false, error: 'Password verification required' };
  }

  // Verify password before disabling MFA
  const passwordValid = await bcrypt.compare(password, user.password);
  if (!passwordValid) {
    return { success: false, error: 'Invalid password' };
  }

  // Clear all MFA data
  await db
    .update(users)
    .set({
      mfaEnabled: false,
      mfaSecret: null,
      mfaBackupCodes: null,
      mfaVerifiedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  return { success: true };
}

/**
 * Check if a user has MFA enabled.
 */
export async function isMFAEnabled(userId: string): Promise<boolean> {
  const db = getClient();

  const [user] = await db
    .select({ mfaEnabled: users.mfaEnabled })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user?.mfaEnabled ?? false;
}
