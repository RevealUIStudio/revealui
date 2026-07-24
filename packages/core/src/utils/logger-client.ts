/**
 * Client-safe logger entry (ADR-008 D4)
 *
 * Re-exports `@revealui/utils/logger` (no Node async_hooks). Prefer
 * `@revealui/core/observability/logger` for packages that already depend on core.
 *
 * Package export: `@revealui/core/utils/logger/client`
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
