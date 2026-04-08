/**
 * Structured Logging Infrastructure
 *
 * Provides consistent, structured logging across the application
 * Extracted from @revealui/core to break circular dependencies
 */

/* console-allowed */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
  [key: string]: unknown;
  userId?: string;
  requestId?: string;
  sessionId?: string;
  traceId?: string;
  spanId?: string;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    cause?: unknown;
  };
  metadata?: Record<string, unknown>;
}

export interface LoggerConfig {
  level?: LogLevel;
  enabled?: boolean;
  pretty?: boolean;
  includeTimestamp?: boolean;
  includeStack?: boolean;
  destination?: 'console' | 'file' | 'remote';
  remoteUrl?: string;
  onLog?: (entry: LogEntry) => void;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

export class Logger {
  private config: Required<LoggerConfig>;
  private context: LogContext = {};
  private extraHandlers: Array<(entry: LogEntry) => void> = [];

  constructor(config: LoggerConfig = {}) {
    this.config = {
      level: config.level || 'info',
      enabled: config.enabled !== undefined ? config.enabled : true,
      pretty: config.pretty !== undefined ? config.pretty : process.env.NODE_ENV !== 'production',
      includeTimestamp: config.includeTimestamp !== undefined ? config.includeTimestamp : true,
      includeStack: config.includeStack !== undefined ? config.includeStack : true,
      destination: config.destination || 'console',
      remoteUrl: config.remoteUrl || '',
      onLog:
        config.onLog ||
        (() => {
          // No-op function
        }),
    };
  }

  /**
   * Register an additional log handler (e.g. DB transport).
   * Called after every log entry, fire-and-forget. Must not throw.
   */
  addLogHandler(handler: (entry: LogEntry) => void): void {
    this.extraHandlers.push(handler);
  }

  /**
   * Set global context
   */
  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Clear global context
   */
  clearContext(): void {
    this.context = {};
  }

  /**
   * Debug log
   */
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  /**
   * Info log
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Warning log
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Error log
   *
   * Accepts either an Error object or a LogContext as the second parameter
   * for backward compatibility with callers that pass structured context.
   */
  error(message: string, errorOrContext?: Error | LogContext, context?: LogContext): void {
    if (errorOrContext instanceof Error) {
      const errorContext = {
        error: {
          name: errorOrContext.name,
          message: errorOrContext.message,
          stack: this.config.includeStack ? errorOrContext.stack : undefined,
          cause: errorOrContext.cause,
        },
      };
      this.log('error', message, { ...context, ...errorContext });
    } else {
      this.log('error', message, { ...errorOrContext, ...context });
    }
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
      : {};

    this.log('fatal', message, { ...context, ...errorContext });
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.config.enabled) return;

    if (LOG_LEVELS[level] < LOG_LEVELS[this.config.level]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: this.config.includeTimestamp ? new Date().toISOString() : '',
      level,
      message,
      context: { ...this.context, ...context },
    };

    // Extract error if in context
    if (entry.context?.error) {
      entry.error = entry.context.error as LogEntry['error'];
      entry.context.error = undefined;
    }

    // Call custom handler
    this.config.onLog(entry);

    // Call additional handlers (e.g. DB transport)
    for (const handler of this.extraHandlers) {
      handler(entry);
    }

    // Output log
    this.output(entry);
  }

  /**
   * Output log entry
   */
  private output(entry: LogEntry): void {
    switch (this.config.destination) {
      case 'console':
        this.outputConsole(entry);
        break;
      case 'file':
        this.outputFile(entry);
        break;
      case 'remote':
        this.outputRemote(entry);
        break;
    }
  }

  /**
   * Output to console
   */
  private outputConsole(entry: LogEntry): void {
    const output = this.config.pretty ? this.formatPretty(entry) : JSON.stringify(entry);

    switch (entry.level) {
      case 'debug':
        console.debug(output);
        break;
      case 'info':
        console.info(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'error':
      case 'fatal':
        console.error(output);
        break;
    }
  }

  /**
   * Output to file
   */
  private outputFile(entry: LogEntry): void {
    // Would require fs module - placeholder for server-side logging
    console.log(JSON.stringify(entry));
  }

  /** Circuit breaker state for remote transport */
  private remoteFailures = 0;
  private readonly maxRemoteFailures = 5;

  /**
   * Output to remote service (with circuit breaker)
   */
  private async outputRemote(entry: LogEntry): Promise<void> {
    if (!this.config.remoteUrl) return;
    if (this.remoteFailures >= this.maxRemoteFailures) return;

    try {
      await fetch(this.config.remoteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry),
      });
      this.remoteFailures = 0;
    } catch {
      this.remoteFailures++;
      this.outputConsole(entry);
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
    };

    const reset = '\x1b[0m';
    const color = levelColors[entry.level];

    const parts: string[] = [];

    if (entry.timestamp) {
      parts.push(`\x1b[90m${entry.timestamp}${reset}`);
    }

    parts.push(`${color}${entry.level.toUpperCase()}${reset}`);
    parts.push(entry.message);

    if (entry.context && Object.keys(entry.context).length > 0) {
      parts.push(JSON.stringify(entry.context, null, 2));
    }

    if (entry.error) {
      parts.push(`\n${color}Error: ${entry.error.message}${reset}`);
      if (entry.error.stack) {
        parts.push(entry.error.stack);
      }
    }

    return parts.join(' ');
  }

  /**
   * Create child logger with additional context
   */
  child(context: LogContext): Logger {
    const childLogger = new Logger(this.config);
    childLogger.setContext({ ...this.context, ...context });
    // Share parent's extra handlers so DB transport applies to child loggers too
    for (const handler of this.extraHandlers) {
      childLogger.addLogHandler(handler);
    }
    return childLogger;
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger({
  level: (process.env.LOG_LEVEL as LogLevel) || 'info',
  pretty: process.env.NODE_ENV !== 'production',
});

/**
 * Create logger with context
 */
export function createLogger(context: LogContext): Logger {
  return logger.child(context);
}

/**
 * Error logger
 */
export function logError(error: Error, context?: LogContext): void {
  logger.error(error.message, error, context);
}

/**
 * Audit logger for security-sensitive operations
 */
export function logAudit(action: string, context?: LogContext): void {
  logger.info(`Audit: ${action}`, {
    ...context,
    audit: true,
    action,
  });
}

/**
 * Database query logger
 */
export function logQuery(query: string, duration: number, context?: LogContext): void {
  logger.debug('Database query', {
    ...context,
    query,
    duration,
  });

  if (duration > 1000) {
    logger.warn('Slow query detected', {
      ...context,
      query,
      duration,
    });
  }
}
