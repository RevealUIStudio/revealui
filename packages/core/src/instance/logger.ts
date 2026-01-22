/**
 * RevealUI Logger
 *
 * Configurable logging utility for RevealUI framework operations.
 * Respects LOG_LEVEL environment variable and NODE_ENV.
 */

export interface RevealUILogger {
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
  debug: (...args: unknown[]) => void
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * Configurable logger implementation
 * Only outputs when appropriate for the environment and log level
 */
export class Logger implements RevealUILogger {
  private minLevel: LogLevel
  private isDevelopment: boolean

  constructor(minLevel?: LogLevel) {
    this.isDevelopment = process.env.NODE_ENV !== 'production'
    this.minLevel = minLevel || (process.env.LOG_LEVEL as LogLevel) || (this.isDevelopment ? 'debug' : 'warn')
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.isDevelopment && level === 'debug') {
      return false // Never log debug in production
    }

    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error']
    return levels.indexOf(level) >= levels.indexOf(this.minLevel)
  }

  info(...args: unknown[]): void {
    if (!this.isDevelopment && this.shouldLog('info')) {
      console.log('[RevealUI]', ...args)
    }
  }

  warn(...args: unknown[]): void {
    if (!this.isDevelopment && this.shouldLog('warn')) {
      console.warn('[RevealUI]', ...args)
    }
  }

  error(...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error('[RevealUI]', ...args)
    }
  }

  debug(...args: unknown[]): void {
    if (this.shouldLog('debug')) {
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
