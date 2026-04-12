/**
 * Error Tracking and Reporting
 *
 * Integrates with error tracking services (Sentry, Bugsnag, etc.)
 */

import { logger } from '../observability/logger.js';
import type { ErrorInfo } from './error-boundary.js';

export interface ErrorReport {
  error: Error;
  errorInfo?: ErrorInfo;
  context?: ErrorContext;
  timestamp: string;
  id: string;
  fingerprint?: string;
  level: ErrorLevel;
  tags?: Record<string, string>;
  user?: UserContext;
  extra?: Record<string, unknown>;
}

export interface ErrorContext {
  [key: string]: unknown;
  url?: string;
  userAgent?: string;
  viewport?: {
    width: number;
    height: number;
  };
  component?: string;
  action?: string;
  route?: string;
  version?: string;
  environment?: string;
}

export interface UserContext {
  id?: string;
  email?: string;
  username?: string;
  ip?: string;
}

export type ErrorLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

export interface ErrorReporter {
  captureError(error: Error, context?: Partial<ErrorReport>): void;
  captureMessage(message: string, level?: ErrorLevel, context?: Partial<ErrorReport>): void;
  setUser(user: UserContext | null): void;
  setContext(context: Partial<ErrorContext>): void;
  setTag(key: string, value: string): void;
  addBreadcrumb(breadcrumb: Breadcrumb): void;
}

export interface Breadcrumb {
  timestamp: string;
  level: ErrorLevel;
  category?: string;
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Error reporting system
 */
export class ErrorReportingSystem implements ErrorReporter {
  private reporters: ErrorReporter[] = [];
  private globalContext: Partial<ErrorContext> = {};
  private globalTags: Record<string, string> = {};
  private user: UserContext | null = null;
  private breadcrumbs: Breadcrumb[] = [];
  private maxBreadcrumbs: number = 100;
  private enabled: boolean = true;
  private errorFilters: Array<(error: Error) => boolean> = [];

  /**
   * Add error reporter
   */
  addReporter(reporter: ErrorReporter): void {
    this.reporters.push(reporter);
  }

  /**
   * Remove error reporter
   */
  removeReporter(reporter: ErrorReporter): void {
    const index = this.reporters.indexOf(reporter);
    if (index > -1) {
      this.reporters.splice(index, 1);
    }
  }

  /**
   * Capture error
   */
  captureError(error: Error, context?: Partial<ErrorReport>): void {
    if (!this.enabled) return;

    // Check filters
    if (!this.shouldReportError(error)) {
      return;
    }

    const report: ErrorReport = {
      error,
      errorInfo: context?.errorInfo,
      context: {
        ...this.globalContext,
        ...context?.context,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        viewport:
          typeof window !== 'undefined'
            ? {
                width: window.innerWidth,
                height: window.innerHeight,
              }
            : undefined,
      },
      timestamp: new Date().toISOString(),
      id: context?.id || crypto.randomUUID(),
      fingerprint: context?.fingerprint || this.generateFingerprint(error),
      level: context?.level || this.determineLevel(error),
      tags: { ...this.globalTags, ...context?.tags },
      user: this.user || undefined,
      extra: {
        ...context?.extra,
        breadcrumbs: this.breadcrumbs.slice(-10), // Last 10 breadcrumbs
      },
    };

    // Send to all reporters
    for (const reporter of this.reporters) {
      try {
        reporter.captureError(error, report);
      } catch (reporterError) {
        logger.error(
          'Error reporter failed',
          reporterError instanceof Error ? reporterError : new Error(String(reporterError)),
        );
      }
    }

    // Add to breadcrumbs
    this.addBreadcrumb({
      timestamp: report.timestamp,
      level: report.level,
      category: 'error',
      message: error.message,
      data: {
        errorName: error.name,
        stack: error.stack,
      },
    });
  }

  /**
   * Capture message
   */
  captureMessage(
    message: string,
    level: ErrorLevel = 'info',
    context?: Partial<ErrorReport>,
  ): void {
    if (!this.enabled) return;

    const report: ErrorReport = {
      error: new Error(message),
      context: {
        ...this.globalContext,
        ...context?.context,
      },
      timestamp: new Date().toISOString(),
      id: crypto.randomUUID(),
      level,
      tags: { ...this.globalTags, ...context?.tags },
      user: this.user || undefined,
      extra: context?.extra,
    };

    for (const reporter of this.reporters) {
      try {
        reporter.captureMessage(message, level, report);
      } catch (reporterError) {
        logger.error(
          'Error reporter failed',
          reporterError instanceof Error ? reporterError : new Error(String(reporterError)),
        );
      }
    }

    this.addBreadcrumb({
      timestamp: report.timestamp,
      level,
      category: 'message',
      message,
    });
  }

  /**
   * Set user context
   */
  setUser(user: UserContext | null): void {
    this.user = user;

    for (const reporter of this.reporters) {
      reporter.setUser(user);
    }
  }

  /**
   * Set global context
   */
  setContext(context: Partial<ErrorContext>): void {
    this.globalContext = { ...this.globalContext, ...context };

    for (const reporter of this.reporters) {
      reporter.setContext(context);
    }
  }

  /**
   * Set global tag
   */
  setTag(key: string, value: string): void {
    this.globalTags[key] = value;

    for (const reporter of this.reporters) {
      reporter.setTag(key, value);
    }
  }

  /**
   * Add breadcrumb
   */
  addBreadcrumb(breadcrumb: Breadcrumb): void {
    this.breadcrumbs.push(breadcrumb);

    // Trim breadcrumbs
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }

    for (const reporter of this.reporters) {
      reporter.addBreadcrumb(breadcrumb);
    }
  }

  /**
   * Add error filter
   */
  addFilter(filter: (error: Error) => boolean): void {
    this.errorFilters.push(filter);
  }

  /**
   * Check if error should be reported
   */
  private shouldReportError(error: Error): boolean {
    return this.errorFilters.every((filter) => filter(error));
  }

  /**
   * Generate error fingerprint for grouping
   */
  private generateFingerprint(error: Error): string {
    // Use error name and first line of stack
    const firstStackLine = error.stack?.split('\n')[1] || '';
    return `${error.name}:${firstStackLine.trim()}`;
  }

  /**
   * Determine error level
   */
  private determineLevel(error: Error): ErrorLevel {
    if (error.name === 'TypeError' || error.name === 'ReferenceError') {
      return 'error';
    }

    if (error.name === 'NetworkError') {
      return 'warning';
    }

    if (error.name === 'ValidationError') {
      return 'warning';
    }

    return 'error';
  }

  /**
   * Enable/disable error reporting
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Clear breadcrumbs
   */
  clearBreadcrumbs(): void {
    this.breadcrumbs = [];
  }

  /**
   * Get breadcrumbs
   */
  getBreadcrumbs(): Breadcrumb[] {
    return [...this.breadcrumbs];
  }
}

/**
 * Global error reporting instance
 */
export const errorReporter = new ErrorReportingSystem();

/**
 * Console error reporter (for development)
 */
export class ConsoleErrorReporter implements ErrorReporter {
  captureError(error: Error, context?: Partial<ErrorReport>): void {
    logger.error(`[Error Reporter] ${error.name}`, error, {
      componentStack: context?.errorInfo?.componentStack,
      ...context?.context,
      tags: context?.tags,
      user: context?.user,
    });
  }

  captureMessage(message: string, level?: ErrorLevel, context?: Partial<ErrorReport>): void {
    const logMessage = `[Error Reporter] ${level?.toUpperCase()}: ${message}`;

    switch (level) {
      case 'error':
      case 'fatal':
        logger.error(logMessage, undefined, context?.context);
        break;
      case 'warning':
        logger.warn(logMessage, context?.context);
        break;
      default:
        logger.info(logMessage, context?.context);
    }
  }

  setUser(user: UserContext | null): void {
    logger.info('[Error Reporter] User set', { user });
  }

  setContext(context: Partial<ErrorContext>): void {
    logger.info('[Error Reporter] Context set', { context });
  }

  setTag(key: string, value: string): void {
    logger.info(`[Error Reporter] Tag set: ${key}=${value}`);
  }

  addBreadcrumb(breadcrumb: Breadcrumb): void {
    logger.debug('[Error Reporter] Breadcrumb', { breadcrumb });
  }
}

/**
 * Logging-only error reporter (development / no external service)
 *
 * Logs errors via the internal logger. Replace with a real Sentry or
 * Datadog integration when an external error-tracking service is needed.
 */
export class LoggingErrorReporter implements ErrorReporter {
  captureError(error: Error, context?: Partial<ErrorReport>): void {
    logger.debug('[ErrorReporter] Error captured', {
      error: error.message,
      ...context,
    });
  }

  captureMessage(message: string, level?: ErrorLevel, context?: Partial<ErrorReport>): void {
    logger.debug('[ErrorReporter] Message captured', {
      message,
      level,
      ...context,
    });
  }

  setUser(_user: UserContext | null): void {
    // No-op  -  logging reporter only captures errors and messages
  }
  setContext(_context: Partial<ErrorContext>): void {
    // No-op  -  logging reporter only captures errors and messages
  }
  setTag(_key: string, _value: string): void {
    // No-op  -  logging reporter only captures errors and messages
  }
  addBreadcrumb(_breadcrumb: Breadcrumb): void {
    // No-op  -  logging reporter only captures errors and messages
  }
}

/**
 * HTTP error reporter (send to custom endpoint)
 */
export class HTTPErrorReporter implements ErrorReporter {
  constructor(private endpoint: string) {}

  async captureError(error: Error, context?: Partial<ErrorReport>): Promise<void> {
    try {
      await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'error',
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
          context,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (reportError) {
      logger.error(
        'Failed to report error',
        reportError instanceof Error ? reportError : new Error(String(reportError)),
      );
    }
  }

  async captureMessage(
    message: string,
    level?: ErrorLevel,
    context?: Partial<ErrorReport>,
  ): Promise<void> {
    try {
      await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'message',
          message,
          level,
          context,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (reportError) {
      logger.error(
        'Failed to report message',
        reportError instanceof Error ? reportError : new Error(String(reportError)),
      );
    }
  }

  setUser(_user: UserContext | null): void {
    // Not needed for HTTP reporter
  }

  setContext(_context: Partial<ErrorContext>): void {
    // Not needed for HTTP reporter
  }

  setTag(_key: string, _value: string): void {
    // Not needed for HTTP reporter
  }

  addBreadcrumb(_breadcrumb: Breadcrumb): void {
    // Not needed for HTTP reporter
  }
}

/**
 * Initialize error reporting
 */
export function initializeErrorReporting(config: {
  dsn?: string;
  environment?: string;
  release?: string;
  sampleRate?: number;
  ignoreErrors?: string[];
  beforeSend?: (report: ErrorReport) => ErrorReport | null;
}): void {
  // Set environment and release
  if (config.environment) {
    errorReporter.setContext({ environment: config.environment });
    errorReporter.setTag('environment', config.environment);
  }

  if (config.release) {
    errorReporter.setContext({ version: config.release });
    errorReporter.setTag('release', config.release);
  }

  // Add error filters
  if (config.ignoreErrors) {
    errorReporter.addFilter((error) => {
      return !config.ignoreErrors?.some((pattern) => error.message.includes(pattern));
    });
  }

  // Add sample rate filter
  if (config.sampleRate && config.sampleRate < 1) {
    errorReporter.addFilter(() => {
      const bytes = new Uint32Array(1);
      crypto.getRandomValues(bytes);
      return (bytes[0] ?? 0) / 0xffffffff < (config.sampleRate ?? 1);
    });
  }

  // Add reporters
  if (process.env.NODE_ENV === 'development') {
    errorReporter.addReporter(new ConsoleErrorReporter());
  }

  if (config.dsn) {
    // DSN is accepted for forward compatibility with external error services.
    // Currently routes to LoggingErrorReporter (structured log output).
    errorReporter.addReporter(new LoggingErrorReporter());
  }

  // Set up global error handlers
  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      errorReporter.captureError(event.error || new Error(event.message), {
        context: {
          url: event.filename,
        },
        extra: {
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));

      errorReporter.captureError(error, {
        level: 'error',
        tags: {
          type: 'unhandled_promise_rejection',
        },
      });
    });
  }
}

/**
 * Track user action as breadcrumb
 */
export function trackAction(action: string, data?: Record<string, unknown>): void {
  errorReporter.addBreadcrumb({
    timestamp: new Date().toISOString(),
    level: 'info',
    category: 'user-action',
    message: action,
    data,
  });
}

/**
 * Track navigation as breadcrumb
 */
export function trackNavigation(from: string, to: string): void {
  errorReporter.addBreadcrumb({
    timestamp: new Date().toISOString(),
    level: 'info',
    category: 'navigation',
    message: `Navigated from ${from} to ${to}`,
    data: { from, to },
  });
}

/**
 * Track API call as breadcrumb
 */
export function trackAPICall(
  method: string,
  url: string,
  status?: number,
  duration?: number,
): void {
  errorReporter.addBreadcrumb({
    timestamp: new Date().toISOString(),
    level: status && status >= 400 ? 'warning' : 'info',
    category: 'api',
    message: `${method} ${url}`,
    data: {
      method,
      url,
      status,
      duration,
    },
  });
}

/**
 * Common error filters
 */
export const ErrorFilters = {
  /**
   * Ignore browser extension errors
   */
  ignoreExtensions: (error: Error): boolean => {
    const extensionPatterns = ['chrome-extension://', 'moz-extension://', 'safari-extension://'];

    return !extensionPatterns.some((pattern) => error.stack?.includes(pattern));
  },

  /**
   * Ignore network errors
   */
  ignoreNetwork: (error: Error): boolean => {
    return error.name !== 'NetworkError';
  },

  /**
   * Ignore cancelled requests
   */
  ignoreCancelled: (error: Error): boolean => {
    return !(error.message.includes('cancelled') || error.message.includes('aborted'));
  },

  /**
   * Ignore specific error messages
   */
  ignoreMessages: (patterns: string[]): ((error: Error) => boolean) => {
    return (error: Error) => {
      return !patterns.some((pattern) => error.message.includes(pattern));
    };
  },
};
