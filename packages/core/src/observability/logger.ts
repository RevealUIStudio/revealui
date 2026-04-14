/**
 * Structured Logging Infrastructure
 *
 * Re-exports from @revealui/utils to maintain backward compatibility.
 * The actual implementation has been moved to @revealui/utils to break circular dependencies.
 */

// Import logger for internal use
import { logger as utilsLogger } from '@revealui/utils/logger';

// Re-export all types and functions from utils
export type {
  LogContext,
  LogEntry,
  LoggerConfig,
  LogLevel,
} from '@revealui/utils/logger';

export {
  createLogger,
  Logger,
  logAudit,
  logError,
  logger,
  logQuery,
} from '@revealui/utils/logger';

// Additional helper functions that were in core but not in utils
// These can stay here as they're core-specific

/**
 * Request logger middleware
 */
export function createRequestLogger<TRequest = unknown, TResponse = unknown>(
  options: { includeBody?: boolean; includeHeaders?: boolean } = {},
) {
  return async (
    request: TRequest & {
      method: string;
      url: string;
      headers?: {
        get?: (key: string) => string | null;
        entries?: () => Iterable<[string, string]>;
      };
    },
    next: () => Promise<TResponse>,
  ): Promise<TResponse> => {
    // Import logger at runtime to avoid circular deps
    const { logger } = await import('@revealui/utils/logger');
    const requestId = crypto.randomUUID();
    const startTime = Date.now();

    const requestLogger = logger.child({
      requestId,
      method: request.method,
      url: request.url,
      userAgent: request.headers?.get?.('user-agent'),
    });

    requestLogger.info('Request started');

    if (options.includeHeaders) {
      requestLogger.debug('Request headers', {
        headers: Object.fromEntries(request.headers?.entries?.() || []),
      });
    }

    try {
      const response = await next();

      const duration = Date.now() - startTime;
      const responseWithStatus = response as typeof response & { status?: number };

      requestLogger.info('Request completed', {
        status: responseWithStatus.status ?? 200,
        duration,
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      requestLogger.error(
        'Request failed',
        error instanceof Error ? error : new Error(String(error)),
        { duration },
      );

      throw error;
    }
  };
}

/**
 * Performance logger
 */
export function logPerformance(
  operation: string,
  duration: number,
  context?: Record<string, unknown>,
): void {
  const level = duration > 1000 ? 'warn' : 'info';

  utilsLogger[level](`Performance: ${operation}`, {
    ...context,
    operation,
    duration,
    slow: duration > 1000,
  });
}

/**
 * API call logger
 */
export function logAPICall(
  method: string,
  url: string,
  status: number,
  duration: number,
  context?: Record<string, unknown>,
): void {
  const apiContext = {
    ...context,
    method,
    url,
    status,
    duration,
  };

  if (status >= 400) {
    utilsLogger.error('API call', undefined, apiContext);
  } else if (status >= 300) {
    utilsLogger.warn('API call', apiContext);
  } else {
    utilsLogger.info('API call', apiContext);
  }
}

/**
 * Cache operation logger
 */
export function logCache(
  operation: 'hit' | 'miss' | 'set' | 'delete',
  key: string,
  context?: Record<string, unknown>,
): void {
  utilsLogger.debug(`Cache ${operation}`, {
    ...context,
    operation,
    key,
  });
}

/**
 * User action logger
 */
export function logUserAction(
  action: string,
  userId?: string,
  context?: Record<string, unknown>,
): void {
  utilsLogger.info('User action', {
    ...context,
    action,
    userId,
  });
}

/**
 * System event logger
 */
export function logSystemEvent(event: string, context?: Record<string, unknown>): void {
  utilsLogger.info('System event', {
    ...context,
    event,
  });
}

// Log redaction lives in @revealui/security — import `redactLogContext`
// (recursive walker) or `redactLogField` (single key/value) from there.
