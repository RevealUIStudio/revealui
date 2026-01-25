/**
 * RevealUI Logger
 *
 * Production-safe logging utility for RevealUI framework operations.
 * Info/warn messages are no-ops in production to avoid console pollution.
 */

export interface RevealUILogger {
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
  debug: (...args: unknown[]) => void
}

/**
 * Production-safe logger implementation
 * Info/warn messages are completely silenced in production
 */
export class Logger implements RevealUILogger {
  info(...args: unknown[]): void {
    // Info messages are never logged in production
    if (process.env.NODE_ENV !== 'production') {
      console.log('[RevealUI]', ...args)
    }
  }

  warn(...args: unknown[]): void {
    // Warning messages are never logged in production
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[RevealUI]', ...args)
    }
  }

  error(...args: unknown[]): void {
    console.error('[RevealUI]', ...args)
  }

  debug(...args: unknown[]): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[RevealUI]', ...args)
    }
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
