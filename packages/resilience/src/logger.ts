/**
 * Internal logger for @revealui/resilience.
 *
 * Defaults to `console`. Consumers should call `configureResilienceLogger()`
 * to supply a structured logger (e.g. from `@revealui/utils/logger`).
 */

export interface ResilienceLogger {
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

let resilienceLogger: ResilienceLogger = console;

/**
 * Replace the default console logger with a structured logger.
 */
export function configureResilienceLogger(logger: ResilienceLogger): void {
  resilienceLogger = logger;
}

/**
 * Get the current resilience logger instance.
 */
export function getResilienceLogger(): ResilienceLogger {
  return resilienceLogger;
}
