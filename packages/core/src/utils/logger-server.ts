/**
 * Server Logger Utility
 *
 * Server-side logging utility for RevealUI framework.
 * Supports different log levels and structured output.
 * Automatically includes request ID from request context when available.
 *
 * WARNING: This module uses Node.js APIs (async_hooks via request-context).
 * For client-safe logging, use './logger-client.js' instead.
 */

import { getRequestId } from './request-context.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}

class ConsoleLogger implements Logger {
  private minLevel: LogLevel;

  constructor(minLevel: LogLevel = 'info') {
    this.minLevel = minLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    // Automatically include request ID if available
    const requestId = getRequestId();
    const enrichedContext = requestId ? { requestId, ...context } : context;

    if (enrichedContext && Object.keys(enrichedContext).length > 0) {
      return `${prefix} ${message} ${JSON.stringify(enrichedContext)}`;
    }

    return `${prefix} ${message}`;
  }

  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(this.formatMessage('debug', message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV !== 'production') {
      console.info(this.formatMessage('info', message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(this.formatMessage('warn', message, context));
    }
  }

  error(message: string, context?: LogContext): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, context));
    }
  }
}

/**
 * Create a logger instance
 *
 * @param minLevel - Minimum log level to output (default: 'info')
 * @returns Logger instance
 */
export function createLogger(minLevel?: LogLevel): Logger {
  // In production, can be extended to use structured logging services
  // For now, use console-based logger
  const level = minLevel || (process.env.LOG_LEVEL as LogLevel) || 'info';
  return new ConsoleLogger(level);
}

/**
 * Default logger instance
 */
export const logger = createLogger();
