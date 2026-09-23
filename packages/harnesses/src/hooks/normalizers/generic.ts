/**
 * Thin-adapter normalizer.
 *
 * Used when a vendor has no dedicated normalizer. Maps the common
 * hook field names onto the control-layer event. Source is `generic`
 * so vendor-specific policy rules do not apply; unsourced control-layer
 * rules still do.
 */

import type {
  HarnessEnforcementTier,
  HarnessHookEvent,
  HarnessHookEventKind,
} from '../../types/hook-event.js';
import { asRecord, readString } from './raw-object.js';

const EVENT_KIND: ReadonlyMap<string, HarnessHookEventKind> = new Map([
  ['session_start', 'session-start'],
  ['session_end', 'session-end'],
  ['SessionStart', 'session-start'],
  ['SessionEnd', 'session-end'],
  ['sessionStart', 'session-start'],
  ['sessionEnd', 'session-end'],
  ['pre_tool_use', 'pre-tool'],
  ['post_tool_use', 'post-tool'],
  ['PreToolUse', 'pre-tool'],
  ['PostToolUse', 'post-tool'],
  ['preToolUse', 'pre-tool'],
  ['postToolUse', 'post-tool'],
  ['beforeShellExecution', 'pre-shell'],
  ['afterShellExecution', 'post-shell'],
  ['stop', 'stop'],
  ['Stop', 'stop'],
]);

export function normalizeGenericHookEvent(
  raw: unknown,
  enforcementTier: HarnessEnforcementTier,
): HarnessHookEvent {
  const rec = asRecord(raw);
  const eventName =
    readString(rec, 'hookEventName') ??
    readString(rec, 'hook_event_name') ??
    readString(rec, 'event') ??
    'pre_tool_use';
  const toolName = readString(rec, 'toolName') ?? readString(rec, 'tool_name');
  const kind = EVENT_KIND.get(eventName) ?? 'pre-tool';
  return {
    kind,
    source: 'generic',
    timestamp: new Date().toISOString(),
    identity: {
      conversationId: readString(rec, 'sessionId') ?? readString(rec, 'session_id'),
    },
    toolName,
    command: readString(rec, 'command'),
    enforcementTier,
    raw,
  };
}
