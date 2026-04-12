/**
 * VAUGHN Degradation Model (Section 5.3 of VAUGHN.md)
 *
 * When a tool does not emit a native event for a VAUGHN event,
 * the adapter applies one of three strategies.
 */

import type { VaughnEvent } from './event-envelope.js';

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
const DEGRADATION_TABLE: Record<string, Partial<Record<VaughnEvent, DegradationStrategy>>> = {
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
  event: VaughnEvent,
): DegradationStrategy | undefined {
  const toolDegradations = DEGRADATION_TABLE[toolName];

  // Unknown tool: report absent for safety (conservative)
  if (!toolDegradations) return 'absent';

  // If no entry for this event, the tool supports it natively
  return toolDegradations[event];
}
