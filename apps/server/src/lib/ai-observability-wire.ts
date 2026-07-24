/**
 * GAP-406 WIRE phase 4 — opt-in `@revealui/ai/observability` mount for apps/server.
 *
 * `REVEALUI_AI_OBSERVABILITY=1` (or true/yes/on): creates an in-process
 * {@link AgentEventLogger} for agent-stream instrumentation.
 * Default (unset): null.
 *
 * @see docs/architecture/ADR-007-c11-unwired-subsystem-incubate.md
 * @see GAP-406
 */

import { AgentEventLogger } from '@revealui/ai/observability';
import { logger } from '@revealui/core/observability/logger';

const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);

export function isAiObservabilityWireEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.REVEALUI_AI_OBSERVABILITY?.trim().toLowerCase();
  return raw !== undefined && ENABLED_VALUES.has(raw);
}

/**
 * Create an agent event logger when enabled. Returns null when off.
 */
export function createAgentEventLoggerIfEnabled(
  env: NodeJS.ProcessEnv = process.env,
): AgentEventLogger | null {
  if (!isAiObservabilityWireEnabled(env)) {
    return null;
  }

  const eventLogger = new AgentEventLogger({ maxEvents: 1000 });
  logger.info('[ai-observability-wire] GAP-406 phase 4: AgentEventLogger ready (in-memory)');
  return eventLogger;
}
