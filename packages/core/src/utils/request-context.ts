/**
 * Request Context Management
 *
 * Provides request ID generation and context propagation for distributed tracing.
 * Request IDs enable tracking a single request across multiple services and logs.
 *
 * WARNING: This module uses Node.js-specific APIs (async_hooks, crypto).
 * Do NOT import in client-side code or edge runtime.
 */

import { randomUUID } from 'node:crypto'
import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * Request context data stored in AsyncLocalStorage
 */
export interface RequestContext {
  /** Unique request identifier */
  requestId: string

  /** Request start timestamp */
  startTime: number

  /** User ID (if authenticated) */
  userId?: string

  /** IP address */
  ip?: string

  /** User agent */
  userAgent?: string

  /** Request path */
  path?: string

  /** Request method */
  method?: string

  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * AsyncLocalStorage for request context
 * Provides request-scoped storage without passing context through every function
 */
const requestContextStorage = new AsyncLocalStorage<RequestContext>()

/**
 * Generate a new request ID
 * Uses UUID v4 for guaranteed uniqueness
 */
export function generateRequestId(): string {
  return randomUUID()
}

/**
 * Get the current request context
 * Returns undefined if not in a request context
 */
export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore()
}

/**
 * Get the current request ID
 * Returns undefined if not in a request context
 */
export function getRequestId(): string | undefined {
  return getRequestContext()?.requestId
}

/**
 * Run a function within a request context
 *
 * @param context - Request context data
 * @param fn - Function to run within the context
 * @returns Result of the function
 *
 * @example
 * ```typescript
 * await runInRequestContext(
 *   {
 *     requestId: generateRequestId(),
 *     startTime: Date.now(),
 *     userId: 'user-123',
 *     path: '/api/users',
 *     method: 'GET',
 *   },
 *   async () => {
 *     // All code here has access to request context
 *     const requestId = getRequestId()
 *     logger.info('Processing request', { requestId })
 *   }
 * )
 * ```
 */
export function runInRequestContext<T>(context: RequestContext, fn: () => T): T {
  return requestContextStorage.run(context, fn)
}

/**
 * Update the current request context with additional data
 *
 * @param updates - Partial context updates to merge
 *
 * @example
 * ```typescript
 * updateRequestContext({ userId: 'user-123' })
 * ```
 */
export function updateRequestContext(updates: Partial<RequestContext>): void {
  const current = getRequestContext()
  if (current) {
    Object.assign(current, updates)
  }
}

/**
 * Extract request ID from various header formats
 *
 * Checks multiple common header names:
 * - x-request-id (standard)
 * - x-correlation-id (correlation pattern)
 * - x-trace-id (OpenTelemetry)
 * - request-id (simple)
 *
 * @param headers - Request headers (any format)
 * @returns Request ID or undefined
 */
export function extractRequestId(
  headers: Record<string, string | string[] | undefined>,
): string | undefined {
  const headerNames = ['x-request-id', 'x-correlation-id', 'x-trace-id', 'request-id']

  for (const name of headerNames) {
    const value = headers[name]
    if (value) {
      return Array.isArray(value) ? value[0] : value
    }
  }

  return undefined
}

/**
 * Create request context from HTTP request
 *
 * @param options - Request information
 * @returns Request context
 *
 * @example
 * ```typescript
 * const context = createRequestContext({
 *   headers: request.headers,
 *   path: request.url,
 *   method: request.method,
 *   ip: request.ip,
 * })
 * ```
 */
export function createRequestContext(options: {
  headers?: Record<string, string | string[] | undefined>
  path?: string
  method?: string
  ip?: string
  userId?: string
}): RequestContext {
  // Try to extract existing request ID from headers, or generate new one
  const requestId = options.headers ? extractRequestId(options.headers) : undefined

  return {
    requestId: requestId || generateRequestId(),
    startTime: Date.now(),
    path: options.path,
    method: options.method,
    ip: options.ip,
    userId: options.userId,
    userAgent: options.headers?.['user-agent'] as string | undefined,
  }
}

/**
 * Get request duration in milliseconds
 *
 * @returns Duration in ms, or undefined if not in request context
 */
export function getRequestDuration(): number | undefined {
  const context = getRequestContext()
  if (!context) return undefined

  return Date.now() - context.startTime
}

/**
 * Request context headers for propagating across services
 *
 * Use these when making HTTP requests to other services to maintain trace continuity
 *
 * @returns Headers object with request ID
 *
 * @example
 * ```typescript
 * const response = await fetch('https://api.example.com/users', {
 *   headers: {
 *     ...getRequestHeaders(),
 *     'Authorization': 'Bearer token',
 *   }
 * })
 * ```
 */
export function getRequestHeaders(): Record<string, string> {
  const requestId = getRequestId()
  if (!requestId) return {}

  return {
    'x-request-id': requestId,
  }
}
