/**
 * Token Utilities
 *
 * Utilities for hashing and verifying session tokens.
 * Uses SHA-256 for fast hashing (sessions are short-lived).
 */

import { createHash } from 'node:crypto'

/**
 * Hash a session token for storage in database
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
  return tokenHash === hash
}
