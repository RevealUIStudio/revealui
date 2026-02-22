/**
 * JWT Validation Utilities
 *
 * Utilities for validating JWT tokens from RevealRequest objects.
 */

import { jwtVerify } from 'jose'
import type { RevealRequest } from '../types/index.js'
import { extractAuthHeader } from './request-headers.js'

/**
 * Validate JWT token from request authorization header
 *
 * @param req - RevealRequest object
 * @throws Error if token is invalid or expired
 */
export async function validateJWTFromRequest(req?: RevealRequest): Promise<void> {
  const authHeader = extractAuthHeader(req)

  if (!authHeader || typeof authHeader !== 'string') {
    return // No auth header, skip validation
  }

  // Extract token from "JWT <token>" format
  if (!authHeader.startsWith('JWT ')) {
    return // Not a JWT token, skip validation
  }

  const token = authHeader.substring(4)
  const secret = process.env.REVEALUI_SECRET

  if (!secret || secret.length < 32) {
    throw new Error(
      'REVEALUI_SECRET must be set to a secure random value (minimum 32 characters). ' +
        'Generate one with: openssl rand -base64 32',
    )
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(secret))
  } catch (_error) {
    // Token is invalid, expired, or tampered
    throw new Error('Invalid or expired token')
  }
}
