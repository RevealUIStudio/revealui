/**
 * Services Logger
 *
 * Simple structured logging utility for services package.
 * Formats logs consistently with timestamps, log levels, and optional context.
 * No external dependencies - uses console methods with structured formatting.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface LogContext {
  [key: string]: unknown
}

interface LoggerOptions {
  service?: string
  context?: LogContext
}

/**
 * Simple logger class for structured logging
 */
export class Logger {
  private service?: string
  private defaultContext?: LogContext

  constructor(options: LoggerOptions = {}) {
    this.service = options.service
    this.defaultContext = options.context
  }

  /**
   * Format log entry with timestamp, level, service, and context
   */
  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString()
    const servicePrefix = this.service ? `[${this.service}]` : '[Services]'
    const levelPrefix = level.toUpperCase().padEnd(5)

    const mergedContext = {
      ...this.defaultContext,
      ...context,
    }

    const contextStr =
      Object.keys(mergedContext).length > 0 ? ` ${JSON.stringify(mergedContext)}` : ''

    return `${timestamp} ${servicePrefix} [${levelPrefix}] ${message}${contextStr}`
  }

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void {
    // Info messages are never logged in production
    if (process.env.NODE_ENV !== 'production') {
      console.log(this.formatMessage('info', message, context))
    }
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    // Warning messages are never logged in production
    if (process.env.NODE_ENV !== 'production') {
      console.warn(this.formatMessage('warn', message, context))
    }
  }

  /**
   * Log error message
   */
  error(message: string, error?: unknown, context?: LogContext): void {
    if (this.shouldLog('error')) {
      const errorContext: LogContext = {
        ...context,
      }

      if (error instanceof Error) {
        errorContext.error = error.message
        errorContext.stack = error.stack
      } else if (error !== undefined) {
        // Use JSON.stringify for objects, String() for primitives
        if (typeof error === 'object' && error !== null) {
          try {
            errorContext.error = JSON.stringify(error)
          } catch {
            errorContext.error = 'Error object could not be stringified'
          }
        } else if (typeof error === 'string') {
          errorContext.error = error
        } else if (
          typeof error === 'number' ||
          typeof error === 'boolean' ||
          typeof error === 'bigint'
        ) {
          errorContext.error = String(error)
        } else {
          // For unknown types, use a safe fallback
          errorContext.error = 'Unknown error type'
        }
      }

      console.error(this.formatMessage('error', message, errorContext))
    }
  }

  /**
   * Log debug message (only when appropriate)
   */
  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, context))
    }
  }

  /**
   * Check if message should be logged based on environment and log level
   */
  private shouldLog(level: LogLevel): boolean {
    const isProduction = process.env.NODE_ENV === 'production'
    const logLevel = process.env.LOG_LEVEL as LogLevel || (isProduction ? 'warn' : 'debug')

    // Never log debug or info in production
    if (isProduction && (level === 'debug' || level === 'info')) {
      return false
    }

    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error']
    return levels.indexOf(level) >= levels.indexOf(logLevel)
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): Logger {
    return new Logger({
      service: this.service,
      context: {
        ...this.defaultContext,
        ...context,
      },
    })
  }
}

/**
 * Create a new logger instance
 */
export function createLogger(options: LoggerOptions = {}): Logger {
  return new Logger(options)
}

/**
 * Default logger instance
 */
export const defaultLogger = new Logger({ service: 'Services' })
