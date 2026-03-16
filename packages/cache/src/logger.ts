/**
 * Internal logger for @revealui/cache.
 *
 * Defaults to `console`. Consumers should call `configureCacheLogger()`
 * to supply a structured logger (e.g. from `@revealui/utils/logger`).
 */

export interface CacheLogger {
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

let cacheLogger: CacheLogger = console;

/**
 * Replace the default console logger with a structured logger.
 */
export function configureCacheLogger(logger: CacheLogger): void {
  cacheLogger = logger;
}

/**
 * Get the current cache logger instance.
 */
export function getCacheLogger(): CacheLogger {
  return cacheLogger;
}
