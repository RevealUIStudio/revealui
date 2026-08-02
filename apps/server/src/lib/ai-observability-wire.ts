/**
 * GAP-406 WIRE phase 4 + GAP-411 residual — opt-in `@revealui/ai/observability`.
 *
 * `REVEALUI_AI_OBSERVABILITY=1` (or true/yes/on): creates an AgentEventLogger
 * for agent-stream instrumentation.
 * Default (unset): null.
 *
 * Durable storage (GAP-411 residual 3):
 * - `REVEALUI_AI_OBSERVABILITY_PATH` — filesystem path for JSON event store.
 *   When set, uses `FileSystemEventStorage` with auto-flush.
 * - `REVEALUI_AI_OBSERVABILITY_FLUSH_MS` — flush interval (default 5000).
 * - Without PATH: in-memory only (original phase-4 behavior).
 *
 * Pro package is loaded via dynamic import (boundary: optional Fair Source).
 *
 * @see docs/architecture/ADR-007-c11-unwired-subsystem-incubate.md
 * @see GAP-411
 */

import { logger } from '@revealui/core/observability/logger';

const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);

export function isAiObservabilityWireEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.REVEALUI_AI_OBSERVABILITY?.trim().toLowerCase();
  return raw !== undefined && ENABLED_VALUES.has(raw);
}

export interface AgentEventLoggerLike {
  logDecision(event: {
    timestamp: number;
    agentId: string;
    sessionId: string;
    reasoning: string;
    context?: Record<string, unknown>;
  }): void;
}

export function parseObservabilityFlushMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.REVEALUI_AI_OBSERVABILITY_FLUSH_MS?.trim();
  if (!raw) return 5000;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 100) return 5000;
  return Math.floor(n);
}

/**
 * Create an agent event logger when enabled. Returns null when off or package missing.
 */
export async function createAgentEventLoggerIfEnabled(
  env: NodeJS.ProcessEnv = process.env,
): Promise<AgentEventLoggerLike | null> {
  if (!isAiObservabilityWireEnabled(env)) {
    return null;
  }

  try {
    const obs = await import('@revealui/ai/observability');
    const storagePath = env.REVEALUI_AI_OBSERVABILITY_PATH?.trim();

    if (storagePath) {
      const storage = new obs.FileSystemEventStorage(storagePath);
      const flushIntervalMs = parseObservabilityFlushMs(env);
      const eventLogger = new obs.AgentEventLogger({
        maxEvents: 1000,
        storage,
        autoFlush: true,
        flushIntervalMs,
      });
      // Load any prior durable events into the circular buffer.
      await eventLogger.load();
      logger.info('[ai-observability-wire] GAP-411: AgentEventLogger ready (file storage)', {
        path: storagePath,
        flushIntervalMs,
      });
      return eventLogger;
    }

    const eventLogger = new obs.AgentEventLogger({ maxEvents: 1000 });
    logger.info(
      '[ai-observability-wire] GAP-406 phase 4: AgentEventLogger ready (in-memory; set REVEALUI_AI_OBSERVABILITY_PATH for durable storage)',
    );
    return eventLogger;
  } catch (error) {
    logger.warn('[ai-observability-wire] failed to load @revealui/ai/observability', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
