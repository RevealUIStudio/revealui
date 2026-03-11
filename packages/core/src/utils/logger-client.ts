/**
 * Client-Safe Logger
 *
 * Production-safe logging utility that works in both client and server contexts.
 * Does not depend on Node.js APIs (no async_hooks, no crypto).
 * Info/warn messages are no-ops in production to avoid console pollution.
 *
 * NOTE: No 'use client' directive here. This is a plain utility module, not a
 * React component. Adding 'use client' causes Next.js to create a reference
 * proxy when imported from server code (API routes), stripping all methods.
 */

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

/**
 * Client-safe logger implementation
 * Simple console-based logging without Node.js dependencies
 */
class ClientLogger implements Logger {
  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [RevealUI] [${level.toUpperCase()}]`;

    if (context && Object.keys(context).length > 0) {
      return `${prefix} ${message} ${JSON.stringify(context)}`;
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
    console.error(this.formatMessage('error', message, context));
  }
}

/**
 * Create a client-safe logger instance
 *
 * @returns Logger instance safe for client-side use
 */
export function createLogger(): Logger {
  return new ClientLogger();
}

/**
 * Default client-safe logger instance
 */
export const logger = createLogger();
