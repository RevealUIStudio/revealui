/**
 * Request Header Utilities
 *
 * Utilities for extracting headers from RevealRequest objects.
 * Handles various header types (Headers, Map, plain object).
 */

import type { RevealRequest } from '../types/index.js'

/**
 * Extract authorization header from request
 *
 * @param req - RevealRequest object
 * @returns Authorization header value or null if not found
 */
export function extractAuthHeader(req?: RevealRequest): string | null {
  if (!req?.headers) {
    return null
  }

  let authHeader: string | undefined | null

  if (req.headers instanceof Headers) {
    authHeader = req.headers.get('authorization') || undefined
  } else if (typeof req.headers === 'object' && 'authorization' in req.headers) {
    authHeader = (req.headers as { authorization?: string }).authorization
  }

  return authHeader || null
}
