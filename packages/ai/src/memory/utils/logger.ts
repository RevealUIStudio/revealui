/**
 * Simple Logger Utility
 *
 * Provides a minimal logging interface that can be easily replaced
 * with a proper logging service later. Respects environment and log levels.
 */

export interface Logger {
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
  debug: (...args: unknown[]) => void
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * Environment-aware logger implementation
 * Only logs when appropriate for the environment and log level
 */
class SimpleLogger implements Logger {
  private prefix: string
  private minLevel: LogLevel
  private isProduction: boolean

  constructor(prefix = '[Memory]') {
    this.prefix = prefix
    this.isProduction = process.env.NODE_ENV === 'production'
    this.minLevel = (process.env.LOG_LEVEL as LogLevel) || (this.isProduction ? 'warn' : 'debug')
  }

  private shouldLog(level: LogLevel): boolean {
    // Never log debug or info in production
    if (this.isProduction && (level === 'debug' || level === 'info')) {
      return false
    }

    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error']
    return levels.indexOf(level) >= levels.indexOf(this.minLevel)
  }

  info(...args: unknown[]): void {
    // Info logs are never shown in production
    if (!this.isProduction && this.shouldLog('info')) {
      console.log(this.prefix, ...args)
    }
  }

  warn(...args: unknown[]): void {
    // Warning logs are never shown in production
    if (!this.isProduction && this.shouldLog('warn')) {
      console.warn(this.prefix, ...args)
    }
  }

  error(...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(this.prefix, ...args)
    }
  }

  debug(...args: unknown[]): void {
    if (this.shouldLog('debug')) {
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
