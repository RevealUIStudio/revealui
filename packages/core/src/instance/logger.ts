/**
 * RevealUI Logger (instance API adapter)
 *
 * ADR-008 D2/D4: implementation is a thin adapter over `@revealui/utils/logger`.
 * The varargs `RevealUILogger` shape stays for `RevealUIInstance.logger` and
 * public re-exports from `revealui.ts`. Prefer structured imports for new code:
 *
 *   import { logger } from '@revealui/core/observability/logger'
 *
 * Production silencing: follows utils `LOG_LEVEL` (default `info`). Legacy
 * hard-silence of info/warn in production is intentionally retired (documented
 * in the D2 PR). setup/scripts CLI loggers are out of scope.
 */

import {
  createLogger as createUtilsLogger,
  logger as utilsLogger,
  type LogContext,
  type Logger as UtilsLogger,
} from '@revealui/utils/logger';

export interface RevealUILogger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}

function toMessageAndContext(args: unknown[]): {
  message: string;
  context?: LogContext;
  error?: Error;
} {
  if (args.length === 0) {
    return { message: '' };
  }

  const [first, ...rest] = args;
  const message =
    typeof first === 'string' ? first : first instanceof Error ? first.message : String(first);

  if (rest.length === 0) {
    if (first instanceof Error) {
      return { message, error: first };
    }
    return { message };
  }

  if (rest.length === 1) {
    const only = rest[0];
    if (only instanceof Error) {
      return { message, error: only };
    }
    if (only !== null && typeof only === 'object' && !Array.isArray(only)) {
      return { message, context: only as LogContext };
    }
    return { message, context: { detail: only } };
  }

  return { message, context: { args: rest } };
}

/**
 * Adapts structured utils logger to the historical varargs instance API.
 */
export class Logger implements RevealUILogger {
  private readonly backend: UtilsLogger;

  constructor(backend: UtilsLogger = utilsLogger) {
    this.backend = backend;
  }

  info(...args: unknown[]): void {
    const { message, context, error } = toMessageAndContext(args);
    if (error) {
      this.backend.info(message, { ...context, error: error.message, stack: error.stack });
      return;
    }
    this.backend.info(message, context);
  }

  warn(...args: unknown[]): void {
    const { message, context, error } = toMessageAndContext(args);
    if (error) {
      this.backend.warn(message, { ...context, error: error.message, stack: error.stack });
      return;
    }
    this.backend.warn(message, context);
  }

  error(...args: unknown[]): void {
    const { message, context, error } = toMessageAndContext(args);
    if (error) {
      this.backend.error(message, error, context);
      return;
    }
    this.backend.error(message, context);
  }

  debug(...args: unknown[]): void {
    const { message, context, error } = toMessageAndContext(args);
    if (error) {
      this.backend.debug(message, { ...context, error: error.message, stack: error.stack });
      return;
    }
    this.backend.debug(message, context);
  }
}

/**
 * Creates a new instance-shaped logger (utils-backed).
 */
export function createLogger(): RevealUILogger {
  return new Logger(createUtilsLogger({ component: 'revealui-instance' }));
}

/**
 * Default instance-shaped logger (utils-backed).
 *
 * @deprecated Prefer `import { logger } from '@revealui/core/observability/logger'`.
 */
export const defaultLogger: RevealUILogger = new Logger();
