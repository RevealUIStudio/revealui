/**
 * Internal logger for @revealui/security.
 *
 * Defaults to `console`. Consumers should call `configureSecurityLogger()`
 * to supply a structured logger (e.g. from `@revealui/utils/logger`).
 */

export interface SecurityLogger {
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

let securityLogger: SecurityLogger = console;

/**
 * Replace the default console logger with a structured logger.
 */
export function configureSecurityLogger(logger: SecurityLogger): void {
  securityLogger = logger;
}

/**
 * Get the current security logger instance.
 */
export function getSecurityLogger(): SecurityLogger {
  return securityLogger;
}
