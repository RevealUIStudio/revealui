/**
 * Server logger with request-id enrichment (ADR-008 D3/D4)
 *
 * Thin facade over `@revealui/utils/logger` that injects `requestId` from
 * AsyncLocalStorage (`request-context`) on every log call. Not a second
 * logger implementation.
 *
 * WARNING: Uses Node.js APIs (async_hooks via request-context). Do not import
 * from browser / RSC client graphs. Client code: `@revealui/core/utils/logger`
 * or `@revealui/core/observability/logger`.
 *
 * Package export: `@revealui/core/utils/logger/server`
 * Also re-exported from `@revealui/core/server`.
 */

import {
  createLogger as createUtilsLogger,
  type LogContext,
  type LogLevel,
  type Logger as UtilsLogger,
  Logger as UtilsLoggerClass,
} from '@revealui/utils/logger';
import { getRequestId } from './request-context.js';

export type { LogContext, LogLevel };
export type Logger = Pick<UtilsLogger, 'debug' | 'info' | 'warn' | 'error'>;

function withRequestId(context?: LogContext): LogContext | undefined {
  const requestId = getRequestId();
  if (!requestId) {
    return context;
  }
  return { requestId, ...context };
}

function wrap(backend: UtilsLogger): Logger {
  return {
    debug(message: string, context?: LogContext): void {
      backend.debug(message, withRequestId(context));
    },
    info(message: string, context?: LogContext): void {
      backend.info(message, withRequestId(context));
    },
    warn(message: string, context?: LogContext): void {
      backend.warn(message, withRequestId(context));
    },
    error(message: string, context?: LogContext): void {
      backend.error(message, withRequestId(context));
    },
  };
}

/**
 * Create a server logger that enriches context with the active request ID.
 *
 * @param minLevel - Optional minimum level (maps to utils `level` config)
 */
export function createLogger(minLevel?: LogLevel): Logger {
  const level = minLevel || (process.env.LOG_LEVEL as LogLevel | undefined) || 'info';
  const backend = new UtilsLoggerClass({
    level,
  }).child({ component: 'core-server' });
  return wrap(backend);
}

/**
 * Default server logger (request-id enriching).
 */
export const logger: Logger = wrap(createUtilsLogger({ component: 'core-server' }));
