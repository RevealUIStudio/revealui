/**
 * Grok Build Hook Normalizer
 *
 * Maps Grok's native hook payload onto `HarnessHookEvent`. Grok accepts both
 * its own event names and Cursor/Claude camelCase aliases (see Grok user guide
 * hooks.md). Native payload (documented 2026-07) uses camelCase fields on
 * stdin: hookEventName, sessionId, toolName, toolInput, cwd, workspaceRoot.
 * Claude-compat payloads may use hook_event_name / tool_name / tool_input.
 *
 * PreToolUse response contract (Grok): { decision: 'allow' | 'deny', reason? }.
 * Exit code 2 is also treated as deny by some editors; we emit both shapes
 * consistently via buildGrokResponse in run-hook.ts.
 */

import type {
  HarnessEnforcementTier,
  HarnessHookEvent,
  HarnessHookEventKind,
} from '../../types/hook-event.js';
import { asRecord, readString, readStringArray } from './raw-object.js';

/** Grok / Claude / Cursor event name aliases -> canonical kind. */
const GROK_EVENT_KIND_MAP: ReadonlyMap<string, HarnessHookEventKind> = new Map([
  // Grok snake (documented example pre_tool_use)
  ['session_start', 'session-start'],
  ['session_end', 'session-end'],
  ['user_prompt_submit', 'prompt-submit'],
  ['pre_tool_use', 'pre-tool'],
  ['post_tool_use', 'post-tool'],
  ['stop', 'stop'],
  // Grok Pascal / Claude
  ['SessionStart', 'session-start'],
  ['SessionEnd', 'session-end'],
  ['UserPromptSubmit', 'prompt-submit'],
  ['PreToolUse', 'pre-tool'],
  ['PostToolUse', 'post-tool'],
  ['Stop', 'stop'],
  // Cursor camel aliases Grok accepts
  ['sessionStart', 'session-start'],
  ['sessionEnd', 'session-end'],
  ['preToolUse', 'pre-tool'],
  ['postToolUse', 'post-tool'],
  ['beforeShellExecution', 'pre-shell'],
  ['afterShellExecution', 'post-shell'],
  ['beforeMCPExecution', 'pre-mcp'],
  ['afterMCPExecution', 'post-mcp'],
  ['beforeSubmitPrompt', 'prompt-submit'],
  ['afterFileEdit', 'file-edit'],
  ['subagentStart', 'session-start'],
  ['subagentStop', 'session-end'],
]);

/** Shell tools (Grok native + Claude aliases). */
const SHELL_TOOL_NAMES: ReadonlySet<string> = new Set([
  'run_terminal_command',
  'Bash',
  'BashOutput',
]);

/** File edit tools (Grok native + Claude aliases). */
const FILE_EDIT_TOOL_NAMES: ReadonlySet<string> = new Set([
  'search_replace',
  'write',
  'Edit',
  'Write',
  'MultiEdit',
  'NotebookEdit',
]);

function readEventName(rec: Record<string, unknown>): string {
  return (
    readString(rec, 'hookEventName') ??
    readString(rec, 'hook_event_name') ??
    readString(rec, 'event') ??
    'unknown'
  );
}

function readToolName(rec: Record<string, unknown>): string | undefined {
  return readString(rec, 'toolName') ?? readString(rec, 'tool_name');
}

function readToolInput(rec: Record<string, unknown>): Record<string, unknown> {
  const primary = asRecord(rec.toolInput);
  if (Object.keys(primary).length > 0) return primary;
  return asRecord(rec.tool_input);
}

function readConversationId(rec: Record<string, unknown>): string | undefined {
  return (
    readString(rec, 'sessionId') ??
    readString(rec, 'session_id') ??
    readString(rec, 'conversation_id')
  );
}

/**
 * Normalize one Grok hook stdin payload into a `HarnessHookEvent`.
 * Total — never throws. Unrecognized events fall back to `pre-tool`.
 */
export function normalizeGrokHookEvent(
  raw: unknown,
  enforcementTier: HarnessEnforcementTier,
): HarnessHookEvent {
  const rec = asRecord(raw);
  const eventName = readEventName(rec);
  const toolName = readToolName(rec);
  const toolInput = readToolInput(rec);

  let kind = GROK_EVENT_KIND_MAP.get(eventName) ?? 'pre-tool';
  if (toolName && SHELL_TOOL_NAMES.has(toolName)) {
    kind =
      eventName === 'PostToolUse' || eventName === 'post_tool_use' || eventName === 'postToolUse'
        ? 'post-shell'
        : 'pre-shell';
  } else if (
    toolName &&
    FILE_EDIT_TOOL_NAMES.has(toolName) &&
    (eventName === 'PostToolUse' ||
      eventName === 'post_tool_use' ||
      eventName === 'postToolUse' ||
      eventName === 'afterFileEdit')
  ) {
    kind = 'file-edit';
  }

  const command = readString(toolInput, 'command') ?? readString(rec, 'command') ?? undefined;
  const filePath =
    readString(toolInput, 'file_path') ??
    readString(toolInput, 'target_file') ??
    readString(toolInput, 'path') ??
    readString(rec, 'file_path');

  return {
    kind,
    source: 'grok',
    timestamp: new Date().toISOString(),
    identity: {
      conversationId: readConversationId(rec),
      generationId: readString(rec, 'generationId') ?? readString(rec, 'generation_id'),
      modelId: readString(rec, 'model') ?? readString(rec, 'modelId'),
    },
    toolName: toolName ?? (GROK_EVENT_KIND_MAP.has(eventName) ? undefined : eventName),
    command,
    filePaths: filePath
      ? [filePath]
      : (readStringArray(toolInput, 'file_paths') ?? readStringArray(rec, 'file_paths')),
    enforcementTier,
    raw,
  };
}
