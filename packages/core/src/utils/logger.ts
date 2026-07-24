/**
 * Logger Utility - Default Export (legacy core barrel → client logger)
 *
 * @deprecated Prefer `@revealui/core/observability/logger` per ADR-008.
 * This barrel re-exports the client-safe logger only (no async_hooks).
 *
 * For server-side logging with request context (until D3):
 *   import { logger } from '@revealui/core/server'
 *   import { logger } from '@revealui/core/utils/logger/server'
 */

export type { LogContext, Logger, LogLevel } from './logger-client.js';
export { createLogger, logger } from './logger-client.js';
