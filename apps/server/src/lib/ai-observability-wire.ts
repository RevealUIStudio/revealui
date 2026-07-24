/**
 * GAP-406 WIRE phase 4 — opt-in `@revealui/ai/observability` mount for apps/server.
 *
 * `REVEALUI_AI_OBSERVABILITY=1` (or true/yes/on): creates an in-process
 * AgentEventLogger for agent-stream instrumentation.
 * Default (unset): null.
 *
 * Pro package is loaded via dynamic import (boundary: optional Fair Source).
 *
 * @see docs/architecture/ADR-007-c11-unwired-subsystem-incubate.md
 * @see GAP-406
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
    const eventLogger = new obs.AgentEventLogger({ maxEvents: 1000 });
    logger.info('[ai-observability-wire] GAP-406 phase 4: AgentEventLogger ready (in-memory)');
    return eventLogger;
  } catch (error) {
    logger.warn('[ai-observability-wire] failed to load @revealui/ai/observability', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
