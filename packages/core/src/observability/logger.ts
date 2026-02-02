/**
 * Structured Logging Infrastructure
 *
 * Provides consistent, structured logging across the application
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export interface LogContext {
  [key: string]: unknown
  userId?: string
  requestId?: string
  sessionId?: string
  traceId?: string
  spanId?: string
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: LogContext
  error?: {
    name: string
    message: string
    stack?: string
    cause?: unknown
  }
  metadata?: Record<string, unknown>
}

export interface LoggerConfig {
  level?: LogLevel
  enabled?: boolean
  pretty?: boolean
  includeTimestamp?: boolean
  includeStack?: boolean
  destination?: 'console' | 'file' | 'remote'
  remoteUrl?: string
  onLog?: (entry: LogEntry) => void
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
}

export class Logger {
  private config: Required<LoggerConfig>
  private context: LogContext = {}

  constructor(config: LoggerConfig = {}) {
    this.config = {
      level: config.level || 'info',
      enabled: config.enabled !== undefined ? config.enabled : true,
      pretty: config.pretty !== undefined ? config.pretty : process.env.NODE_ENV !== 'production',
      includeTimestamp: config.includeTimestamp !== undefined ? config.includeTimestamp : true,
      includeStack: config.includeStack !== undefined ? config.includeStack : true,
      destination: config.destination || 'console',
      remoteUrl: config.remoteUrl || '',
      onLog: config.onLog || (() => {}),
    }
  }

  /**
   * Set global context
   */
  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context }
  }

  /**
   * Clear global context
   */
  clearContext(): void {
    this.context = {}
  }

  /**
   * Debug log
   */
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context)
  }

  /**
   * Info log
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context)
  }

  /**
   * Warning log
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context)
  }

  /**
   * Error log
   */
  error(message: string, error?: Error, context?: LogContext): void {
    const errorContext = error
      ? {
          error: {
            name: error.name,
            message: error.message,
            stack: this.config.includeStack ? error.stack : undefined,
            cause: error.cause,
          },
        }
      : {}

    this.log('error', message, { ...context, ...errorContext })
  }

  /**
   * Fatal log
   */
  fatal(message: string, error?: Error, context?: LogContext): void {
    const errorContext = error
      ? {
          error: {
            name: error.name,
            message: error.message,
            stack: this.config.includeStack ? error.stack : undefined,
            cause: error.cause,
          },
        }
      : {}

    this.log('fatal', message, { ...context, ...errorContext })
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.config.enabled) return

    if (LOG_LEVELS[level] < LOG_LEVELS[this.config.level]) {
      return
    }

    const entry: LogEntry = {
      timestamp: this.config.includeTimestamp ? new Date().toISOString() : '',
      level,
      message,
      context: { ...this.context, ...context },
    }

    // Extract error if in context
    if (entry.context?.error) {
      entry.error = entry.context.error as LogEntry['error']
      delete entry.context.error
    }

    // Call custom handler
    this.config.onLog(entry)

    // Output log
    this.output(entry)
  }

  /**
   * Output log entry
   */
  private output(entry: LogEntry): void {
    switch (this.config.destination) {
      case 'console':
        this.outputConsole(entry)
        break
      case 'file':
        this.outputFile(entry)
        break
      case 'remote':
        this.outputRemote(entry)
        break
    }
  }

  /**
   * Output to console
   */
  private outputConsole(entry: LogEntry): void {
    const output = this.config.pretty ? this.formatPretty(entry) : JSON.stringify(entry)

    switch (entry.level) {
      case 'debug':
        console.debug(output)
        break
      case 'info':
        console.info(output)
        break
      case 'warn':
        console.warn(output)
        break
      case 'error':
      case 'fatal':
        console.error(output)
        break
    }
  }

  /**
   * Output to file
   */
  private outputFile(entry: LogEntry): void {
    // Would require fs module - placeholder for server-side logging
    console.log(JSON.stringify(entry))
  }

  /**
   * Output to remote service
   */
  private async outputRemote(entry: LogEntry): Promise<void> {
    if (!this.config.remoteUrl) return

    try {
      await fetch(this.config.remoteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry),
      })
    } catch (error) {
      // Fallback to console if remote fails
      console.error('Failed to send log to remote:', error)
      this.outputConsole(entry)
    }
  }

  /**
   * Format log entry for pretty printing
   */
  private formatPretty(entry: LogEntry): string {
    const levelColors: Record<LogLevel, string> = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m', // Green
      warn: '\x1b[33m', // Yellow
      error: '\x1b[31m', // Red
      fatal: '\x1b[35m', // Magenta
    }

    const reset = '\x1b[0m'
    const color = levelColors[entry.level]

    const parts: string[] = []

    if (entry.timestamp) {
      parts.push(`\x1b[90m${entry.timestamp}${reset}`)
    }

    parts.push(`${color}${entry.level.toUpperCase()}${reset}`)
    parts.push(entry.message)

    if (entry.context && Object.keys(entry.context).length > 0) {
      parts.push(JSON.stringify(entry.context, null, 2))
    }

    if (entry.error) {
      parts.push(`\n${color}Error: ${entry.error.message}${reset}`)
      if (entry.error.stack) {
        parts.push(entry.error.stack)
      }
    }

    return parts.join(' ')
  }

  /**
   * Create child logger with additional context
   */
  child(context: LogContext): Logger {
    const childLogger = new Logger(this.config)
    childLogger.setContext({ ...this.context, ...context })
    return childLogger
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger({
  level: (process.env.LOG_LEVEL as LogLevel) || 'info',
  pretty: process.env.NODE_ENV !== 'production',
})

/**
 * Create logger with context
 */
export function createLogger(context: LogContext): Logger {
  return logger.child(context)
}

/**
 * Request logger middleware
 */
export function createRequestLogger(options: {
  includeBody?: boolean
  includeHeaders?: boolean
} = {}) {
  return async (
    request: any,
    next: () => Promise<any>,
  ): Promise<any> => {
    const requestId = crypto.randomUUID()
    const startTime = Date.now()

    const requestLogger = logger.child({
      requestId,
      method: request.method,
      url: request.url,
      userAgent: request.headers?.get?.('user-agent'),
    })

    requestLogger.info('Request started')

    if (options.includeHeaders) {
      requestLogger.debug('Request headers', {
        headers: Object.fromEntries(request.headers?.entries?.() || []),
      })
    }

    try {
      const response = await next()

      const duration = Date.now() - startTime

      requestLogger.info('Request completed', {
        status: response.status,
        duration,
      })

      return response
    } catch (error) {
      const duration = Date.now() - startTime

      requestLogger.error(
        'Request failed',
        error instanceof Error ? error : new Error(String(error)),
        { duration },
      )

      throw error
    }
  }
}

/**
 * Error logger
 */
export function logError(error: Error, context?: LogContext): void {
  logger.error(error.message, error, context)
}

/**
 * Performance logger
 */
export function logPerformance(
  operation: string,
  duration: number,
  context?: LogContext,
): void {
  const level = duration > 1000 ? 'warn' : 'info'

  logger[level](`Performance: ${operation}`, {
    ...context,
    operation,
    duration,
    slow: duration > 1000,
  })
}

/**
 * Audit logger for security-sensitive operations
 */
export function logAudit(
  action: string,
  context?: LogContext,
): void {
  logger.info(`Audit: ${action}`, {
    ...context,
    audit: true,
    action,
  })
}

/**
 * Database query logger
 */
export function logQuery(
  query: string,
  duration: number,
  context?: LogContext,
): void {
  logger.debug('Database query', {
    ...context,
    query,
    duration,
  })

  if (duration > 1000) {
    logger.warn('Slow query detected', {
      ...context,
      query,
      duration,
    })
  }
}

/**
 * API call logger
 */
export function logAPICall(
  method: string,
  url: string,
  status: number,
  duration: number,
  context?: LogContext,
): void {
  const apiContext = {
    ...context,
    method,
    url,
    status,
    duration,
  }

  if (status >= 400) {
    logger.error('API call', undefined, apiContext)
  } else if (status >= 300) {
    logger.warn('API call', apiContext)
  } else {
    logger.info('API call', apiContext)
  }
}

/**
 * Cache operation logger
 */
export function logCache(
  operation: 'hit' | 'miss' | 'set' | 'delete',
  key: string,
  context?: LogContext,
): void {
  logger.debug(`Cache ${operation}`, {
    ...context,
    operation,
    key,
  })
}

/**
 * User action logger
 */
export function logUserAction(
  action: string,
  userId?: string,
  context?: LogContext,
): void {
  logger.info('User action', {
    ...context,
    action,
    userId,
  })
}

/**
 * System event logger
 */
export function logSystemEvent(
  event: string,
  context?: LogContext,
): void {
  logger.info('System event', {
    ...context,
    event,
  })
}

/**
 * Sanitize sensitive data from logs
 */
export function sanitizeLogData(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = [
    'password',
    'token',
    'secret',
    'apiKey',
    'accessToken',
    'refreshToken',
    'creditCard',
    'ssn',
  ]

  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase()

    if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeLogData(value as Record<string, unknown>)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

/**
 * Log sampling - only log a percentage of messages
 */
export function createSampledLogger(
  sampleRate: number,
  baseLogger: Logger = logger,
): Logger {
  const config = {
    ...(baseLogger as any).config,
    onLog: (entry: LogEntry) => {
      if (Math.random() < sampleRate) {
        (baseLogger as any).config.onLog(entry)
      }
    },
  }

  return new Logger(config)
}
