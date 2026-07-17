/**
 * VS Code Agent Hook Normalizer
 *
 * Maps VS Code's native agent-hook payload shape onto `HarnessHookEvent`
 * (multi-editor harness design doc §2.3, §3-B).
 *
 * Verified 2026-07-17 against code.visualstudio.com/docs/agents/reference/hooks-reference
 * and code.visualstudio.com/docs/agent-customization/hooks (VS Code's agent
 * hooks are in Preview; re-verify at each future build touching this file --
 * the design doc's own audit flags a high release cadence). Confirmed facts:
 *  - Event names: `SessionStart`, `UserPromptSubmit`, `PreToolUse`,
 *    `PostToolUse`, `PreCompact`, `SubagentStart`, `SubagentStop`, `Stop`.
 *    Notably NO `SessionEnd` (unlike Cursor and Claude Code).
 *  - Every hook receives a JSON payload over stdin with common fields
 *    `timestamp`, `cwd`, `session_id`, `hook_event_name`, `transcript_path`
 *    (snake_case), plus event-specific fields; `PreToolUse`/`PostToolUse`
 *    additionally carry `tool_name`, `tool_input`, `tool_use_id`.
 *  - The field-name casing (snake_case, matching Claude Code's own payload
 *    shape rather than VS Code's usual camelCase JSON conventions) was
 *    corroborated by two independent doc fetches; VS Code's own plugin
 *    manifest docs reuse the `${CLAUDE_PLUGIN_ROOT}` token verbatim, which
 *    reads as a deliberate wire-format convergence with Claude Code's plugin
 *    system, not a coincidence. Confidence: high on event names and the
 *    common envelope, medium on the exact field list (doc excerpts were
 *    AI-summarized, not read byte-for-byte).
 *  - VS Code does not document a per-hook editor-identity field analogous to
 *    Cursor's `user_email` / `CURSOR_USER_EMAIL`. No such field is read here;
 *    per design invariant I-1, if one exists it stays in `raw` only and is
 *    never promoted onto `HarnessHookIdentity` regardless.
 *  - `tool_name` values for the shell/file-edit refinement below
 *    (`runInTerminal`/`runTask` for shell, `editFiles`/`createFile`/
 *    `createDirectory` for file edits) come from VS Code's documented
 *    built-in Copilot agent-mode tool set (code.visualstudio.com/docs/copilot/agents/agent-tools),
 *    not from the hooks reference itself -- best-effort, same posture as
 *    Cursor's `beforeReadFile` -> synthetic `Read` toolName fallback.
 */

import type {
  HarnessEnforcementTier,
  HarnessHookEvent,
  HarnessHookEventKind,
} from '../../types/hook-event.js';
import { asRecord, readString, readStringArray } from './raw-object.js';

/** VS Code `hook_event_name` -> canonical kind. */
const VSCODE_EVENT_KIND_MAP: ReadonlyMap<string, HarnessHookEventKind> = new Map([
  ['SessionStart', 'session-start'],
  ['UserPromptSubmit', 'prompt-submit'],
  ['PreToolUse', 'pre-tool'],
  ['PostToolUse', 'post-tool'],
  ['SubagentStart', 'session-start'],
  ['SubagentStop', 'session-end'],
  ['Stop', 'stop'],
]);

/** Built-in VS Code Copilot agent-mode tool names that represent a terminal/shell invocation. */
const SHELL_TOOL_NAMES: ReadonlySet<string> = new Set(['runInTerminal', 'runTask', 'runTests']);

/** Built-in VS Code Copilot agent-mode tool names that represent a file edit. */
const FILE_EDIT_TOOL_NAMES: ReadonlySet<string> = new Set([
  'editFiles',
  'createFile',
  'createDirectory',
]);

/**
 * Normalize one VS Code hook stdin payload into a `HarnessHookEvent`. Total
 * -- never throws. An unrecognized `hook_event_name` (including the
 * documented `PreCompact`, which has no matching kind in the eleven-kind
 * schema -- a compaction event is neither a tool call nor a session
 * boundary) falls back to `pre-tool` with `toolName` set to the raw event
 * name, mirroring the Cursor and Claude Code normalizers' fallback so every
 * source degrades the same honest way instead of silently dropping the
 * event (design doc §3-B "never drop events silently").
 */
export function normalizeVSCodeHookEvent(
  raw: unknown,
  enforcementTier: HarnessEnforcementTier,
): HarnessHookEvent {
  const rec = asRecord(raw);
  const eventName = readString(rec, 'hook_event_name') ?? 'unknown';
  const toolName = readString(rec, 'tool_name');
  const toolInput = asRecord(rec.tool_input);

  let kind = VSCODE_EVENT_KIND_MAP.get(eventName) ?? 'pre-tool';
  if (toolName && SHELL_TOOL_NAMES.has(toolName)) {
    kind = eventName === 'PostToolUse' ? 'post-shell' : 'pre-shell';
  } else if (toolName && FILE_EDIT_TOOL_NAMES.has(toolName) && eventName === 'PostToolUse') {
    kind = 'file-edit';
  }

  const command = readString(toolInput, 'command');
  const filePath = readString(toolInput, 'file_path') ?? readString(toolInput, 'filePath');

  return {
    kind,
    source: 'vscode',
    timestamp: new Date().toISOString(),
    identity: {
      conversationId: readString(rec, 'session_id'),
      generationId: undefined,
      modelId: undefined,
    },
    toolName: toolName ?? (VSCODE_EVENT_KIND_MAP.has(eventName) ? undefined : eventName),
    command,
    filePaths: filePath ? [filePath] : readStringArray(toolInput, 'files'),
    enforcementTier,
    raw,
  };
}
