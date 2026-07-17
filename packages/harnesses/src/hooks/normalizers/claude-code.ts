/**
 * Claude Code Hook Normalizer
 *
 * Maps Claude Code's native hook payload shape onto `HarnessHookEvent`
 * (multi-editor harness design doc §3-B). Covers the
 * `PreToolUse`/`PostToolUse`/`SessionStart`/`SessionEnd`/`UserPromptSubmit`/
 * `Stop` family -- every payload carries `session_id`, `transcript_path`,
 * `cwd`, `hook_event_name`; tool events additionally carry `tool_name` and
 * `tool_input`. Unlike Cursor, Claude Code's hook payload carries no
 * generation id or model id (Claude Code does not expose either to a hook
 * process), so `identity.generationId` / `identity.modelId` are always
 * `undefined` here -- an honest gap, not an oversight.
 */

import type {
  HarnessEnforcementTier,
  HarnessHookEvent,
  HarnessHookEventKind,
} from '../../types/hook-event.js';
import { asRecord, readString, readStringArray } from './raw-object.js';

/** Claude Code `hook_event_name` -> canonical kind. */
const CLAUDE_CODE_EVENT_KIND_MAP: ReadonlyMap<string, HarnessHookEventKind> = new Map([
  ['SessionStart', 'session-start'],
  ['SessionEnd', 'session-end'],
  ['UserPromptSubmit', 'prompt-submit'],
  ['PreToolUse', 'pre-tool'],
  ['PostToolUse', 'post-tool'],
  ['Stop', 'stop'],
]);

/** Tool names that represent a shell invocation rather than a generic tool call. */
const SHELL_TOOL_NAMES: ReadonlySet<string> = new Set(['Bash', 'BashOutput']);

/** Tool names that represent a file edit rather than a generic tool call. */
const FILE_EDIT_TOOL_NAMES: ReadonlySet<string> = new Set(['Edit', 'Write', 'NotebookEdit']);

/**
 * Normalize one Claude Code hook stdin payload into a `HarnessHookEvent`.
 * Total -- never throws. An unrecognized `hook_event_name` falls back to
 * `pre-tool` with `toolName` set to the raw event name, mirroring the
 * Cursor normalizer's fallback so both sources degrade the same way.
 */
export function normalizeClaudeCodeHookEvent(
  raw: unknown,
  enforcementTier: HarnessEnforcementTier,
): HarnessHookEvent {
  const rec = asRecord(raw);
  const eventName = readString(rec, 'hook_event_name') ?? 'unknown';
  const toolName = readString(rec, 'tool_name');
  const toolInput = asRecord(rec.tool_input);

  let kind = CLAUDE_CODE_EVENT_KIND_MAP.get(eventName) ?? 'pre-tool';
  if (toolName && SHELL_TOOL_NAMES.has(toolName)) {
    kind = eventName === 'PostToolUse' ? 'post-shell' : 'pre-shell';
  } else if (toolName && FILE_EDIT_TOOL_NAMES.has(toolName) && eventName === 'PostToolUse') {
    kind = 'file-edit';
  }

  const command = readString(toolInput, 'command');
  const filePath = readString(toolInput, 'file_path');

  return {
    kind,
    source: 'claude-code',
    timestamp: new Date().toISOString(),
    identity: {
      conversationId: readString(rec, 'session_id'),
      generationId: undefined,
      modelId: undefined,
    },
    toolName: toolName ?? (CLAUDE_CODE_EVENT_KIND_MAP.has(eventName) ? undefined : eventName),
    command,
    filePaths: filePath ? [filePath] : readStringArray(toolInput, 'file_paths'),
    enforcementTier,
    raw,
  };
}
