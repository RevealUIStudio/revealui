/**
 * Simple Logger Utility
 *
 * Provides a minimal logging interface that can be easily replaced
 * with a proper logging service later. Uses console methods for now
 * but provides a consistent interface.
 */

export interface Logger {
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
  debug: (...args: unknown[]) => void
}

/**
 * Simple logger implementation using console
 * Can be replaced with a proper logging service later
 */
class SimpleLogger implements Logger {
  private prefix: string

  constructor(prefix = '[Memory]') {
    this.prefix = prefix
  }

  info(...args: unknown[]): void {
    console.log(this.prefix, ...args)
  }

  warn(...args: unknown[]): void {
    console.warn(this.prefix, ...args)
  }

  error(...args: unknown[]): void {
    console.error(this.prefix, ...args)
  }

  debug(...args: unknown[]): void {
    // Safely check NODE_ENV (may not exist in all environments)
    const isProduction =
      typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production'
    if (!isProduction) {
      console.debug(this.prefix, ...args)
    }
  }
}

/**
 * Creates a logger instance with optional prefix
 */
export function createLogger(prefix?: string): Logger {
  return new SimpleLogger(prefix)
}

/**
 * Default logger instance
 */
export const defaultLogger: Logger = new SimpleLogger('[Memory]')
