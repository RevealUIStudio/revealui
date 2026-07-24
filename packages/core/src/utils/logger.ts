/**
 * Logger barrel (client-safe) — ADR-008 D4
 *
 * Re-exports `@revealui/utils/logger`. Prefer
 * `@revealui/core/observability/logger` for new core-dependent code.
 *
 * Server + request-id: `@revealui/core/server` or
 * `@revealui/core/utils/logger/server`.
 */

export type {
  LogContext,
  LogEntry,
  LoggerConfig,
  LogLevel,
} from '@revealui/utils/logger';

export {
  createLogger,
  Logger,
  logAudit,
  logError,
  logger,
  logQuery,
} from '@revealui/utils/logger';
