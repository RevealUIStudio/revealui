/**
 * RevealUI Logger
 *
 * Simple logging utility for RevealUI framework operations.
 */

export interface RevealUILogger {
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
  debug: (...args: unknown[]) => void
}

/**
 * Default logger implementation
 * Uses console methods with RevealUI prefix
 */
export class Logger implements RevealUILogger {
  info(...args: unknown[]): void {
    console.log('[RevealUI]', ...args)
  }

  warn(...args: unknown[]): void {
    console.warn('[RevealUI]', ...args)
  }

  error(...args: unknown[]): void {
    console.error('[RevealUI]', ...args)
  }

  debug(...args: unknown[]): void {
    console.debug('[RevealUI]', ...args)
  }
}

/**
 * Creates a new logger instance
 */
export function createLogger(): RevealUILogger {
  return new Logger()
}

/**
 * Default logger instance
 */
export const defaultLogger: RevealUILogger = new Logger()
