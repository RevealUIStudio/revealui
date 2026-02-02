/**
 * Logger Utility - Default Export
 *
 * Re-exports the client-safe logger implementation.
 * This ensures that default imports get the client-safe version
 * without Node.js dependencies (no async_hooks, no crypto).
 *
 * For server-side logging with request context:
 *   import { logger } from '@revealui/core/server'
 *   import { logger } from '@revealui/core/utils/logger/server'
 */

export type { Logger, LogContext, LogLevel } from './logger-client.js'
export { createLogger, logger } from './logger-client.js'
