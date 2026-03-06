/**
 * Token Utilities
 *
 * Utilities for hashing and verifying session tokens.
 * Uses SHA-256 for fast hashing (sessions are short-lived).
 */

import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Hash a session token using SHA-256.
 *
 * SHA-256 is appropriate for high-entropy session tokens (256-bit / 32 random bytes).
 * Unlike passwords (low entropy, user-chosen), these tokens have sufficient keyspace
 * (~2^256) to make brute-force infeasible even with fast hashes. Using bcrypt/argon2
 * would add ~100ms latency per request with no meaningful security benefit.
 *
 * Security relies on: (1) token entropy >= 128 bits, (2) session expiry enforcement,
 * (3) token regeneration on privilege changes.
 *
 * @param token - Plain session token
 * @returns Hashed token (SHA-256)
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Verify a token matches a hash
 *
 * @param token - Plain token
 * @param hash - Hashed token from database
 * @returns True if token matches hash
 */
export function verifyToken(token: string, hash: string): boolean {
  const tokenHash = hashToken(token)
  const a = Buffer.from(tokenHash, 'utf-8')
  const b = Buffer.from(hash, 'utf-8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
