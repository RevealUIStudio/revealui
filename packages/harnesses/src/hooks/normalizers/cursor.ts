/**
 * Cursor Hook Normalizer
 *
 * Maps Cursor's native `.cursor/hooks.json` payload shape onto
 * `HarnessHookEvent` (multi-editor harness design doc §2.3, §3-B).
 *
 * Verified 2026-07-17 against cursor.com/docs/agent/hooks: every hook
 * receives a common envelope over stdin --
 * `conversation_id, generation_id, model, model_id, hook_event_name,
 * cursor_version, workspace_roots, user_email, transcript_path` -- plus
 * per-event fields. Event-name coverage here matches design doc §2.3:
 * `preToolUse`/`postToolUse`, `beforeShellExecution`/`afterShellExecution`,
 * `beforeMCPExecution`/`afterMCPExecution`, `beforeReadFile`/`afterFileEdit`,
 * `sessionStart`/`sessionEnd`, subagent events, `stop`.
 *
 * `user_email` is read ONLY to prove the trust boundary: it is never copied
 * onto `HarnessHookIdentity` (design invariant I-1). It stays in `raw`.
 */

import type {
  HarnessEnforcementTier,
  HarnessHookEvent,
  HarnessHookEventKind,
} from '../../types/hook-event.js';
import { asRecord, readString, readStringArray } from './raw-object.js';

/**
 * Cursor `hook_event_name` -> canonical kind. `beforeReadFile` has no
 * distinct canonical read kind (the schema's eleven kinds cover file
 * EDITS, not reads) -- it normalizes to `pre-tool` with a synthetic
 * `toolName: 'Read'`, the same honest fallback Claude Code's own Read tool
 * gets. Subagent lifecycle events (`subagentStart`/`subagentStop`) map onto
 * `session-start`/`session-end`: a subagent run is a nested session in the
 * same sense a Claude Code subagent's transcript is nested under its
 * parent's.
 */
const CURSOR_EVENT_KIND_MAP: ReadonlyMap<string, HarnessHookEventKind> = new Map([
  ['sessionStart', 'session-start'],
  ['sessionEnd', 'session-end'],
  ['subagentStart', 'session-start'],
  ['subagentStop', 'session-end'],
  ['preToolUse', 'pre-tool'],
  ['postToolUse', 'post-tool'],
  ['beforeReadFile', 'pre-tool'],
  ['beforeShellExecution', 'pre-shell'],
  ['afterShellExecution', 'post-shell'],
  ['beforeMCPExecution', 'pre-mcp'],
  ['afterMCPExecution', 'post-mcp'],
  ['afterFileEdit', 'file-edit'],
  ['stop', 'stop'],
]);

/**
 * Normalize one Cursor hook stdin payload into a `HarnessHookEvent`.
 * Total -- never throws. An unrecognized `hook_event_name` falls back to
 * `pre-tool` with `toolName` set to the raw event name so the receipt
 * remains legible instead of silently dropping the event (design doc §3-B
 * "never drop events silently").
 */
export function normalizeCursorHookEvent(
  raw: unknown,
  enforcementTier: HarnessEnforcementTier,
): HarnessHookEvent {
  const rec = asRecord(raw);
  const eventName = readString(rec, 'hook_event_name') ?? 'unknown';
  const kind = CURSOR_EVENT_KIND_MAP.get(eventName) ?? 'pre-tool';

  const toolName =
    readString(rec, 'tool_name') ??
    (eventName === 'beforeReadFile' ? 'Read' : undefined) ??
    (CURSOR_EVENT_KIND_MAP.has(eventName) ? undefined : eventName);

  const filePath = readString(rec, 'file_path');

  return {
    kind,
    source: 'cursor',
    timestamp: new Date().toISOString(),
    identity: {
      conversationId: readString(rec, 'conversation_id'),
      generationId: readString(rec, 'generation_id'),
      modelId: readString(rec, 'model_id') ?? readString(rec, 'model'),
    },
    toolName,
    command: readString(rec, 'command'),
    filePaths: filePath ? [filePath] : readStringArray(rec, 'file_paths'),
    enforcementTier,
    raw,
  };
}
