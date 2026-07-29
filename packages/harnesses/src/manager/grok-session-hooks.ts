/**
 * Grok peer session-boundary hooks (control layer).
 *
 * Machine home `~/.grok/hooks/*.json` is the runtime attach point (Grok always
 * loads global hooks). Project materialize emits the same JSON under
 * `.revealui/adapters/grok/hooks/` as the SSOT template so operators do not
 * invent a second hardline body under `~/.grok`.
 *
 * Design:
 * - SessionStart / SessionEnd: TRACKER + hotfix + temp-scripts + RevDev
 *   session.register / session.end (soft-optional when daemon socket down).
 * - Hotfix/temp adapters under `~/.claude` call the same control registries.
 * - Daemon boundary via `revealui-harnesses session register|end` (this package).
 * - No full hardline prose; no OpenClaw; subscription OAuth never appears here.
 *
 * Credential topology: ADR 2026-07-29-provider-credential-topology-green-yellow-red
 * (yellow OK for dual-harness Studio; green on control registries).
 */

/** Relative paths under the project root after materialize. */
export const GROK_HOOK_TEMPLATE_DIR = '.revealui/adapters/grok/hooks';

interface GrokHookCommand {
  type: 'command';
  command: string;
  timeout: number;
}

interface GrokHookGroup {
  hooks: GrokHookCommand[];
}

function hookFile(event: string, groups: GrokHookGroup[]): string {
  return `${JSON.stringify({ hooks: { [event]: groups } }, null, 2)}\n`;
}

const TRACKER_CMD =
  'node "$HOME/revfleet/.jv/scripts/tracker-session-check.js" 2>/dev/null || true';
const HOTFIX_CMD = 'node "$HOME/.claude/hooks/hotfix-check.js" 2>/dev/null || true';
const TMPSCRIPT_CMD = 'node "$HOME/.claude/hooks/tmpscript-check.js" 2>/dev/null || true';

/**
 * Soft-optional daemon session boundary. Tries monorepo dist CLI first, then
 * PATH binary. Always `|| true` so hooks never block when daemon is down.
 */
const SESSION_REGISTER_CMD =
  'node "$HOME/revfleet/revealui/packages/harnesses/dist/cli.js" session register --backend grok 2>/dev/null || revealui-harnesses session register --backend grok 2>/dev/null || true';
const SESSION_END_CMD =
  'node "$HOME/revfleet/revealui/packages/harnesses/dist/cli.js" session end 2>/dev/null || revealui-harnesses session end 2>/dev/null || true';

/** Policy + receipt spool for tool events (stdin JSON from Grok → control layer). */
const HOOK_GROK_CMD =
  'node "$HOME/revfleet/revealui/packages/harnesses/dist/cli.js" hook grok 2>/dev/null || revealui-harnesses hook grok 2>/dev/null || true';

export const GROK_SESSION_START_HOOKS_JSON = hookFile('SessionStart', [
  {
    hooks: [
      {
        type: 'command',
        command:
          'printf \'%s\\n\' "[grok] adapter SessionStart → control layer (TRACKER + hotfix + temp-scripts + daemon session)"',
        timeout: 5,
      },
      { type: 'command', command: TRACKER_CMD, timeout: 12 },
      { type: 'command', command: HOTFIX_CMD, timeout: 15 },
      { type: 'command', command: TMPSCRIPT_CMD, timeout: 12 },
      { type: 'command', command: SESSION_REGISTER_CMD, timeout: 20 },
    ],
  },
]);

export const GROK_SESSION_END_HOOKS_JSON = hookFile('SessionEnd', [
  {
    hooks: [
      {
        type: 'command',
        command:
          'printf \'%s\\n\' "[grok] adapter SessionEnd → control layer (daemon session.end + hotfix + temp-scripts)"',
        timeout: 5,
      },
      { type: 'command', command: SESSION_END_CMD, timeout: 20 },
      { type: 'command', command: HOTFIX_CMD, timeout: 15 },
      { type: 'command', command: TMPSCRIPT_CMD, timeout: 12 },
    ],
  },
]);

/** PreToolUse: normalize + policy + spool receipt (same plane as Cursor/Claude). */
export const GROK_PRE_TOOL_HOOKS_JSON = hookFile('PreToolUse', [
  {
    hooks: [{ type: 'command', command: HOOK_GROK_CMD, timeout: 15 }],
  },
]);

/** Install filenames under `~/.grok/hooks/` (and under GROK_HOOK_TEMPLATE_DIR). */
export const GROK_HOOK_FILES = {
  'session-start.json': GROK_SESSION_START_HOOKS_JSON,
  'session-end.json': GROK_SESSION_END_HOOKS_JSON,
  'pre-tool.json': GROK_PRE_TOOL_HOOKS_JSON,
} as const;
