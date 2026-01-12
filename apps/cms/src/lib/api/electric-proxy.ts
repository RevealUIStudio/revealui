/**
 * ElectricSQL Shape Proxy Utilities
 *
 * Server-side utilities for proxying ElectricSQL shape requests with authentication
 * and row-level filtering. This enables secure, authenticated sync for TanStack DB.
 */

import { ELECTRIC_PROTOCOL_QUERY_PARAMS } from '@electric-sql/client'
import { type NextRequest } from 'next/server'

/**
 * Gets the ElectricSQL service URL from environment variables.
 */
function getElectricUrl(): string {
  return process.env.ELECTRIC_SERVICE_URL || process.env.ELECTRIC_URL || 'http://localhost:5133'
}

/**
 * Prepares the ElectricSQL proxy URL from a request URL.
 * Copies over Electric-specific query params and adds auth if configured.
 *
 * @param requestUrl - The incoming request URL
 * @returns The prepared ElectricSQL origin URL
 */
export function prepareElectricUrl(requestUrl: string): URL {
  const url = new URL(requestUrl)
  const electricUrl = getElectricUrl()
  const originUrl = new URL(`${electricUrl}/v1/shape`)

  // Copy Electric-specific query params
  url.searchParams.forEach((value, key) => {
    if (ELECTRIC_PROTOCOL_QUERY_PARAMS.includes(key)) {
      originUrl.searchParams.set(key, value)
    }
  })

  // Add Electric Cloud authentication if configured
  if (process.env.ELECTRIC_SOURCE_ID && process.env.ELECTRIC_SECRET) {
    originUrl.searchParams.set('source_id', process.env.ELECTRIC_SOURCE_ID)
    originUrl.searchParams.set('secret', process.env.ELECTRIC_SECRET)
  }

  return originUrl
}

/**
 * Proxies a request to ElectricSQL and returns the response.
 *
 * @param originUrl - The prepared ElectricSQL URL
 * @returns The proxied response
 */
export async function proxyElectricRequest(originUrl: URL): Promise<Response> {
  const response = await fetch(originUrl)
  const headers = new Headers(response.headers)
  headers.delete('content-encoding')
  headers.delete('content-length')
  headers.set('vary', 'cookie')

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

/**
 * Extracts user ID from request (for row-level filtering).
 * TODO: Implement actual session extraction based on RevealUI auth system
 *
 * @param request - Next.js request object
 * @returns User ID or null if not authenticated
 */
export async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  // TODO: Implement session extraction
  // This should use RevealUI's authentication system
  // For now, return null (will need to be implemented)
  return null
}
