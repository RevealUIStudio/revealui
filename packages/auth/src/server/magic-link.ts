/**
 * Magic Link Token Module
 *
 * Generates and verifies single-use, time-limited tokens for passwordless
 * email authentication and account recovery flows.
 *
 * Tokens are stored in the database as HMAC-SHA256 hashes with per-token salts,
 * following the same security pattern as password-reset.ts.
 */

import crypto from 'node:crypto';
import { getClient } from '@revealui/db/client';
import { magicLinks } from '@revealui/db/schema';
import { and, eq, gt, isNull, lt } from 'drizzle-orm';

// =============================================================================
// Configuration (parameterization convention)
// =============================================================================

export interface MagicLinkConfig {
  /** Token expiry in ms (default: 15 minutes) */
  tokenExpiryMs: number;
  /** Temp session duration in ms (default: 30 minutes) */
  tempSessionDurationMs: number;
  /** Max requests per hour per email (default: 3) */
  maxRequestsPerHour: number;
}

const DEFAULT_CONFIG: MagicLinkConfig = {
  tokenExpiryMs: 15 * 60 * 1000,
  tempSessionDurationMs: 30 * 60 * 1000,
  maxRequestsPerHour: 3,
};

let config: MagicLinkConfig = { ...DEFAULT_CONFIG };

export function configureMagicLink(overrides: Partial<MagicLinkConfig>): void {
  config = { ...DEFAULT_CONFIG, ...overrides };
}

export function resetMagicLinkConfig(): void {
  config = { ...DEFAULT_CONFIG };
}

// =============================================================================
// Crypto helpers (same pattern as password-reset.ts)
// =============================================================================

/**
 * Hash a token using HMAC-SHA256 with a per-token salt.
 * The salt is stored in the DB alongside the hash; this defeats rainbow
 * table attacks even if the database is fully compromised.
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

// =============================================================================
// Public API
// =============================================================================

/**
 * Creates a magic link token for a user.
 *
 * - Generates a 32-byte random token
 * - Hashes it with HMAC-SHA256 + per-token salt
 * - Cleans up expired magic links for the same user (opportunistic)
 * - Inserts the hashed token into the database
 *
 * @param userId - User ID to create the magic link for
 * @returns The plaintext token (to embed in the email link) and its expiry
 */
export async function createMagicLink(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const db = getClient();

  // Generate secure token with per-token salt
  const token = crypto.randomBytes(32).toString('hex');
  const tokenSalt = generateSalt();
  const tokenHash = hashToken(token, tokenSalt);
  const expiresAt = new Date(Date.now() + config.tokenExpiryMs);
  const id = crypto.randomUUID();

  // Opportunistic cleanup: delete expired magic links for this user
  await db
    .delete(magicLinks)
    .where(and(eq(magicLinks.userId, userId), lt(magicLinks.expiresAt, new Date())));

  // Store hashed token + salt in database
  await db.insert(magicLinks).values({
    id,
    userId,
    tokenHash,
    tokenSalt,
    expiresAt,
  });

  return { token, expiresAt };
}

/**
 * Verifies a magic link token.
 *
 * Selects all unexpired, unused magic links and checks each one against the
 * provided token using HMAC-SHA256 + timingSafeEqual. This is a table scan
 * by design (same approach as password-reset.ts validation). The table stays
 * small due to opportunistic cleanup in createMagicLink.
 *
 * On match: marks the token as used and returns the userId.
 * On no match: returns null.
 *
 * @param token - Plaintext token from the magic link URL
 * @returns Object with userId if valid, null otherwise
 */
export async function verifyMagicLink(token: string): Promise<{ userId: string } | null> {
  const db = getClient();

  // Select all unexpired, unused magic links
  const rows = await db
    .select()
    .from(magicLinks)
    .where(and(isNull(magicLinks.usedAt), gt(magicLinks.expiresAt, new Date())));

  for (const row of rows) {
    const expectedHash = hashToken(token, row.tokenSalt);
    const expectedBuf = Buffer.from(expectedHash);
    const actualBuf = Buffer.from(row.tokenHash);

    if (expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf)) {
      // Mark token as used (single-use enforcement)
      await db.update(magicLinks).set({ usedAt: new Date() }).where(eq(magicLinks.id, row.id));

      return { userId: row.userId };
    }
  }

  return null;
}
