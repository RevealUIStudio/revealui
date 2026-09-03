/**
 * Grok peer session-boundary hooks (control layer).
 *
 * Machine home `~/.grok/hooks/*.json` is Grok CLI's vendor attach point
 * (it always loads global hooks). Project materialize emits the JSON under
 * `.revealui/adapters/grok/hooks/` as the git SSOT. RevKit `rfg` / bootstrap
 * copies allowlisted files to the attach point. Do not author hardlines
 * under `~/.grok`.
 *
 * Design:
 * - SessionStart / SessionEnd: TRACKER + CURRENT-HANDOFF menu pointer +
 *   hotfix + temp-scripts + RevDev session.register / session.end
 *   (soft-optional when daemon socket down).
 * - SessionStart register also prints GAP-459 peer-context (WARN if down).
 * - Hotfix + tmpscript checks call `revealui-harnesses` (or monorepo dist)
 *   directly. Claude-home wrappers stay Claude-adapter only.
 * - Daemon boundary via `revealui-harnesses session register|end|peers`.
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

/**
 * Soft-optional control-layer CLI. Tries monorepo dist first, then PATH.
 * Always `|| true` so session hooks never block (missing dist, stale binary,
 * daemon down). Pending hotfix/tmpscript lines print on stdout.
 */
function controlLayerCmd(subcommand: string): string {
  return `node "$HOME/revfleet/revealui/packages/harnesses/dist/cli.js" ${subcommand} 2>/dev/null || revealui-harnesses ${subcommand} 2>/dev/null || true`;
}

const HOTFIX_CMD = controlLayerCmd('hotfix check');
const TMPSCRIPT_CMD = controlLayerCmd('tmpscript check');
const SESSION_REGISTER_CMD = controlLayerCmd('session register --backend grok');
const SESSION_END_CMD = controlLayerCmd('session end');

/**
 * PreToolUse must be able to DENY. The old
 * `hook grok 2>/dev/null || true` wrapper swallowed exit 2 and posted
 * public security-review essays. This entry runs
 * `public-security-comment-pretool.cjs`, which classifies first (works
 * without dist) then forwards stdin to `hook grok` and propagates exit 2.
 * Never wrap that forward in `|| true`.
 */
const HOOK_GROK_CMD =
  'node "$HOME/.local/share/revealui/hooks/public-security-comment-pretool.cjs"';

export const GROK_SESSION_START_HOOKS_JSON = hookFile('SessionStart', [
  {
    hooks: [
      {
        type: 'command',
        command:
          'printf \'%s\\n\' "[grok] adapter SessionStart → control layer (TRACKER + CURRENT-HANDOFF pointer + hotfix + temp-scripts + daemon session + peer-context)"',
        timeout: 5,
      },
      {
        type: 'command',
        command:
          'printf \'%s\\n\' "[menu] CURRENT-HANDOFF = session deltas; free surfaces = TRACKER.md; continue = /pickup"',
        timeout: 5,
      },
      { type: 'command', command: TRACKER_CMD, timeout: 12 },
      { type: 'command', command: HOTFIX_CMD, timeout: 15 },
      { type: 'command', command: TMPSCRIPT_CMD, timeout: 12 },
      // register prints GAP-459 peer panel (or WARN if daemon down)
      { type: 'command', command: SESSION_REGISTER_CMD, timeout: 25 },
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

/** Filenames under GROK_HOOK_TEMPLATE_DIR. RevKit copies the allowlist to `$GROK_HOME/hooks`. */
export const GROK_HOOK_FILES = {
  'session-start.json': GROK_SESSION_START_HOOKS_JSON,
  'session-end.json': GROK_SESSION_END_HOOKS_JSON,
  'pre-tool.json': GROK_PRE_TOOL_HOOKS_JSON,
} as const;
