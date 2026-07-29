/**
 * Grok peer session-boundary hooks (control layer).
 *
 * Machine home `~/.grok/hooks/*.json` is the runtime attach point (Grok always
 * loads global hooks). Project materialize emits the same JSON under
 * `.revealui/adapters/grok/hooks/` as the SSOT template so operators do not
 * invent a second hardline body under `~/.grok`.
 *
 * Design:
 * - SessionStart / SessionEnd only for this slice (lifecycle parity with Claude
 *   session-start + stop surfaces for hotfix / temp-script / TRACKER).
 * - Commands call existing thin control-layer adapters under `~/.claude`
 *   (hotfix.js / tmpscript.js / hooks/*-check.js) — same registry, no twin.
 * - TRACKER orientation via fleet `tracker-session-check.js` (shared with
 *   Claude SessionStart; GAP-406).
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

export const GROK_SESSION_START_HOOKS_JSON = hookFile('SessionStart', [
  {
    hooks: [
      {
        type: 'command',
        command:
          'printf \'%s\\n\' "[grok] adapter SessionStart → control layer (TRACKER + hotfix + temp-scripts); no full hardline mirrors"',
        timeout: 5,
      },
      { type: 'command', command: TRACKER_CMD, timeout: 12 },
      { type: 'command', command: HOTFIX_CMD, timeout: 15 },
      { type: 'command', command: TMPSCRIPT_CMD, timeout: 12 },
    ],
  },
]);

export const GROK_SESSION_END_HOOKS_JSON = hookFile('SessionEnd', [
  {
    hooks: [
      {
        type: 'command',
        command:
          'printf \'%s\\n\' "[grok] adapter SessionEnd → control layer (hotfix + temp-scripts)"',
        timeout: 5,
      },
      { type: 'command', command: HOTFIX_CMD, timeout: 15 },
      { type: 'command', command: TMPSCRIPT_CMD, timeout: 12 },
    ],
  },
]);

/** Install filenames under `~/.grok/hooks/` (and under GROK_HOOK_TEMPLATE_DIR). */
export const GROK_HOOK_FILES = {
  'session-start.json': GROK_SESSION_START_HOOKS_JSON,
  'session-end.json': GROK_SESSION_END_HOOKS_JSON,
} as const;
