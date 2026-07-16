/**
 * Degradation Model
 *
 * When a tool does not emit a native event for a canonical protocol event,
 * the adapter applies one of three strategies.
 */

import type { ProtocolEvent } from './event-envelope.js';

/**
 * Degradation strategy applied when a tool lacks native support for an event.
 *
 * - polyfill: Adapter synthesizes the event from other signals (same semantics, higher latency)
 * - degrade: Partial functionality, weaker guarantee, explicitly documented
 * - absent: No meaningful approximation; capability is reported as missing
 */
export type DegradationStrategy = 'polyfill' | 'degrade' | 'absent';

/**
 * Degradation table: for a given tool and event, what strategy applies
 * when the tool lacks native support.
 *
 * Only entries where the tool does NOT natively support the event are listed.
 * If a tool natively supports an event, it is not degraded.
 */
const DEGRADATION_TABLE: Record<string, Partial<Record<ProtocolEvent, DegradationStrategy>>> = {
  'claude-code': {
    'session.crash': 'polyfill',
    'task.claimed': 'polyfill',
    'task.completed': 'polyfill',
    'agent.heartbeat': 'polyfill',
  },
  codex: {
    'session.crash': 'polyfill',
    'task.claimed': 'polyfill',
    'task.completed': 'polyfill',
    'agent.heartbeat': 'polyfill',
  },
  cursor: {
    'session.start': 'absent',
    'session.stop': 'absent',
    'session.crash': 'polyfill',
    'prompt.submit': 'absent',
    'tool.before': 'absent',
    'tool.after': 'absent',
    'tool.blocked': 'absent',
    'task.claimed': 'absent',
    'task.completed': 'absent',
    'agent.heartbeat': 'polyfill',
  },
  'revealui-agent': {
    // RevealUI Agent natively supports all 10 events; no degradation needed.
  },
  // No working adapter yet (GAP-371 Phase 0: data only). No hook system
  // (canBlock: false), so per-tool events have no source to polyfill from;
  // session/task/heartbeat events are synthesizable from process lifecycle
  // (headless + backgroundable via `opencode serve`).
  opencode: {
    'session.start': 'polyfill',
    'session.stop': 'polyfill',
    'session.crash': 'polyfill',
    'prompt.submit': 'polyfill',
    'tool.before': 'absent',
    'tool.after': 'absent',
    'tool.blocked': 'absent',
    'task.claimed': 'polyfill',
    'task.completed': 'polyfill',
    'agent.heartbeat': 'polyfill',
  },
};

/**
 * Returns the degradation strategy for a given tool and event.
 *
 * - Returns `undefined` if the tool natively supports the event (no degradation).
 * - Returns the strategy if the tool lacks native support.
 * - Returns `'absent'` for unknown tools (conservative default).
 */
export function getDegradationStrategy(
  toolName: string,
  event: ProtocolEvent,
): DegradationStrategy | undefined {
  const toolDegradations = DEGRADATION_TABLE[toolName];

  // Unknown tool: report absent for safety (conservative)
  if (!toolDegradations) return 'absent';

  // If no entry for this event, the tool supports it natively
  return toolDegradations[event];
}
