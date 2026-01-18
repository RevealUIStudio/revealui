/**
 * ElectricSQL Client (New System - HTTP-based)
 *
 * Provides ElectricSQL client configuration for HTTP-based shape sync.
 * Works with ElectricSQL server 1.2.9+ using the new shape-based API.
 *
 * Note: This uses the new @electric-sql/client package which is HTTP-based,
 * not local-first like the old 0.12.1 system.
 */

import { logger } from '@revealui/core/utils/logger'

// =============================================================================
// Client Configuration
// =============================================================================

export interface ElectricClientConfig {
  /** ElectricSQL service URL (e.g., http://localhost:5133) */
  serviceUrl: string
  /** Authentication token (if needed) */
  authToken?: string
  /** Debug mode */
  debug?: boolean
}

/**
 * Gets the ElectricSQL service URL from environment variables.
 */
export function getElectricServiceUrl(): string {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_ELECTRIC_SERVICE_URL || ''
  }
  return process.env.ELECTRIC_SERVICE_URL || ''
}

/**
 * Validates and parses a service URL.
 *
 * @param url - Service URL string
 * @returns Parsed URL object
 * @throws Error if URL is invalid
 */
export function validateServiceUrl(url: string): URL {
  try {
    return new URL(url)
  } catch {
    throw new Error(
      `Invalid ElectricSQL service URL: "${url}". ` +
        'URL must be a valid HTTP/HTTPS URL (e.g., http://localhost:5133).',
    )
  }
}

/**
 * Creates ElectricSQL client configuration.
 *
 * The new system uses HTTP-based shapes instead of local-first database.
 * This function returns configuration that can be used with ShapeStream and useShape.
 *
 * @param config - Client configuration options
 * @returns Client configuration object
 * @throws Error if service URL is invalid
 *
 * @example
 * ```typescript
 * import { createElectricClientConfig } from '@revealui/sync/client'
 *
 * const config = createElectricClientConfig({
 *   serviceUrl: process.env.NEXT_PUBLIC_ELECTRIC_SERVICE_URL!,
 *   authToken: process.env.ELECTRIC_AUTH_TOKEN,
 * })
 * ```
 */
export function createElectricClientConfig(config: ElectricClientConfig): ElectricClientConfig {
  const { serviceUrl, authToken, debug = false } = config

  // Validate service URL
  if (!serviceUrl || serviceUrl.trim() === '') {
    throw new Error(
      'ElectricSQL service URL is required. ' +
        'Set NEXT_PUBLIC_ELECTRIC_SERVICE_URL or ELECTRIC_SERVICE_URL environment variable.',
    )
  }

  // Validate URL format
  validateServiceUrl(serviceUrl)

  if (debug) {
    logger.debug('ElectricSQL client configuration created', {
      serviceUrl,
      hasAuth: !!authToken,
    })
  }

  return {
    serviceUrl,
    authToken,
    debug,
  }
}

/**
 * Builds the base shape URL endpoint.
 *
 * ✅ VERIFIED: Based on TypeScript definitions from @electric-sql/client
 * The URL should be the base endpoint only (e.g., http://localhost:5133/v1/shape)
 * Table name and filtering should be in the `params` object, not query params.
 *
 * @param baseUrl - Base service URL
 * @returns Full shape endpoint URL
 */
export function buildShapeUrl(baseUrl: string): string {
  // Remove trailing slash if present
  const cleanUrl = baseUrl.replace(/\/$/, '')
  // ✅ VERIFIED: Base endpoint is /v1/shape (from TypeScript definitions)
  return `${cleanUrl}/v1/shape`
}

/**
 * Builds headers for ElectricSQL requests.
 *
 * @param authToken - Optional authentication token
 * @returns Headers object
 */
export function buildHeaders(authToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`
  }

  return headers
}
