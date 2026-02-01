/**
 * Next.js Middleware
 *
 * Runs before every request to:
 * - Add request ID header for distributed tracing
 * - Set up request context for logging
 * - Track request timing
 */

import {
  createRequestContext,
  extractRequestId,
  generateRequestId,
} from '@revealui/core/utils/request-context'
import { type NextRequest, NextResponse } from 'next/server'

/**
 * Middleware configuration
 * Matches all routes except static files and Next.js internals
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

/**
 * Middleware function
 *
 * Adds request ID to all requests and responses for distributed tracing
 */
export function middleware(request: NextRequest) {
  // Extract or generate request ID
  const existingRequestId = extractRequestId(Object.fromEntries(request.headers.entries()))
  const requestId = existingRequestId || generateRequestId()

  // Create request context for logging
  // Note: AsyncLocalStorage works in Node.js runtime, not Edge runtime
  // For Edge runtime, we rely on header propagation only
  const context = createRequestContext({
    headers: Object.fromEntries(request.headers.entries()),
    path: request.nextUrl.pathname,
    method: request.method,
    ip: request.ip || request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
  })

  // Continue with the request
  const response = NextResponse.next()

  // Add request ID to response headers for client tracking
  response.headers.set('x-request-id', requestId)

  // Add CORS headers for request ID (if needed for frontend)
  response.headers.set('Access-Control-Expose-Headers', 'x-request-id')

  // Add request timing headers (for observability)
  const duration = Date.now() - context.startTime
  response.headers.set('x-request-duration', duration.toString())

  return response
}
