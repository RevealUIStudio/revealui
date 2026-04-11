/**
 * DB Log Transport
 *
 * Returns an onLog handler compatible with the Logger class in @revealui/utils.
 * Persists warn/error/fatal entries to the `app_logs` NeonDB table.
 *
 * Only writes in production (NODE_ENV=production). All writes are fire-and-forget
 *  -  the handler never throws or blocks the caller.
 *
 * Usage (call once at app startup):
 *   import { createDbLogHandler } from '@revealui/db/log-transport'
 *   import { logger } from '@revealui/utils/logger'
 *
 *   if (process.env.NODE_ENV === 'production') {
 *     logger.addLogHandler(createDbLogHandler('api'))
 *   }
 */

import type { LogEntry } from '@revealui/utils/logger';
import { getClient } from './client/index.js';
import { appLogs } from './schema/app-logs.js';

const SHIP_LEVELS = new Set(['warn', 'error', 'fatal']);

export function createDbLogHandler(app: string): (entry: LogEntry) => void {
  return (entry: LogEntry): void => {
    if (!SHIP_LEVELS.has(entry.level)) return;
    if (process.env.NODE_ENV !== 'production') return;

    // Merge context + error into a single data object
    const data: Record<string, unknown> = {};
    if (entry.context && Object.keys(entry.context).length > 0) {
      Object.assign(data, entry.context);
    }
    if (entry.error) {
      data.error = entry.error;
    }

    const db = getClient();
    db.insert(appLogs)
      .values({
        level: entry.level,
        message: entry.message,
        app,
        environment: process.env.NODE_ENV ?? 'production',
        requestId: entry.context?.requestId ?? null,
        userId: entry.context?.userId ?? null,
        data: Object.keys(data).length > 0 ? data : null,
      })
      .catch(() => {
        // Intentionally empty  -  never throw back to the logger
      });
  };
}
