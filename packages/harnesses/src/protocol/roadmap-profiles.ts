/**
 * Roadmap Capability Profiles
 *
 * Declared profiles for AI coding tools that the Harness Protocol spec
 * targets but which DO NOT have a working adapter in this package today.
 * (`opencode` graduated to `./capabilities.ts` `TOOL_PROFILES` when
 * `OpenCodeAdapter` shipped -- see `../adapters/opencode-adapter.ts`.
 * `cursor` graduated the same way when `CursorAdapter` shipped -- see
 * `../adapters/cursor-adapter.ts`.)
 *
 * These entries describe what those tools support natively, useful for:
 *  - The degradation table in `./degradation-strategies.ts` (which knows
 *    how to fall back when a tool can't emit a canonical event).
 *  - Future adapter implementations — when an adapter is wired up for one
 *    of these tools, its profile graduates to `./capabilities.ts`
 *    `TOOL_PROFILES` and the entry is removed from this file.
 *  - Documentation / planning surfaces that want to enumerate "what we've
 *    declared profiles for" vs "what we actually ship."
 *
 * The separation from `TOOL_PROFILES` is structural: it surfaces the
 * spec-vs-shipped gap as a code-level distinction instead of a comment.
 * A capability-aware dispatcher would consult both, in priority order:
 * registered capabilities win, then `TOOL_PROFILES` (shipped), then
 * `ROADMAP_PROFILES` (declared). No such dispatcher ships in this package
 * today — the coordination runtime lives in the RevDev daemon (see the
 * daemon-ownership ADR, 2026-07-25).
 */

import type { ProtocolCapabilities } from './capabilities.js';
import { TOOL_PROFILES } from './capabilities.js';

export const ROADMAP_PROFILES: Record<string, ProtocolCapabilities> = {
  'claude-code': {
    dispatch: {
      generateCode: false,
      analyzeCode: false,
      applyEdit: false,
      executeCommand: false,
    },
    readWorkboard: true,
    writeWorkboard: true,
    claimTasks: true,
    reportConflicts: true,
    headless: true,
    resumable: false,
    forkable: false,
    backgroundable: true,
    hooks: { supported: true, granularity: 'all-tools', canBlock: true },
    sandbox: { supported: false, modes: [] },
    supportsWorktrees: true,
    supportsSkills: true,
    supportsMcp: true,
    memory: { supported: false, backend: 'none' },
    maxContextTokens: 200_000,
    lifecycleEvents: [
      'session.start',
      'session.stop',
      'prompt.submit',
      'tool.before',
      'tool.after',
      'tool.blocked',
    ],
  },

  codex: {
    dispatch: {
      generateCode: false,
      analyzeCode: false,
      applyEdit: false,
      executeCommand: false,
    },
    readWorkboard: true,
    writeWorkboard: true,
    claimTasks: true,
    reportConflicts: false,
    headless: true,
    resumable: true,
    forkable: true,
    backgroundable: true,
    hooks: { supported: true, granularity: 'bash-only', canBlock: true },
    sandbox: { supported: true, modes: ['read-only', 'workspace-write', 'full-access'] },
    supportsWorktrees: false,
    supportsSkills: true,
    supportsMcp: true,
    memory: { supported: true, backend: 'sqlite' },
    maxContextTokens: 200_000,
    lifecycleEvents: [
      'session.start',
      'session.stop',
      'prompt.submit',
      'tool.before',
      'tool.after',
      'tool.blocked',
    ],
  },

  // VS Code's agent-plugin hook system IS real and shipped this phase
  // (`../hooks/normalizers/vscode.ts`, `../content/generators/vscode.ts`) --
  // unlike every other entry in this file, `hooks.supported: true` here is
  // backed by working code, not an aspiration. It stays in ROADMAP_PROFILES
  // rather than graduating to `TOOL_PROFILES` because that promotion (per
  // this file's module doc) tracks a working `HarnessAdapter`
  // (dispatch/execute), and VS Code has no documented headless CLI to exec
  // an agent turn against (verified 2026-07-17; Copilot CLI is a separate
  // product from the `code` editor binary). `dispatch`/`headless`/
  // `resumable`/`forkable`/`backgroundable` are honestly `false` for the
  // same reason. `maxContextTokens: 0` is the BYO sentinel documented on
  // `ProtocolCapabilities.maxContextTokens` -- Copilot agent mode's context
  // window depends on the user's configured model, not a fixed VS Code
  // capability.
  vscode: {
    dispatch: {
      generateCode: false,
      analyzeCode: false,
      applyEdit: false,
      executeCommand: false,
    },
    readWorkboard: false,
    writeWorkboard: false,
    claimTasks: false,
    reportConflicts: false,
    headless: false,
    resumable: false,
    forkable: false,
    backgroundable: false,
    hooks: { supported: true, granularity: 'all-tools', canBlock: true },
    sandbox: { supported: false, modes: [] },
    supportsWorktrees: false,
    supportsSkills: true,
    supportsMcp: true,
    memory: { supported: false, backend: 'none' },
    maxContextTokens: 0,
    lifecycleEvents: [
      'session.start',
      'prompt.submit',
      'tool.before',
      'tool.after',
      'tool.blocked',
    ],
  },

  /**
   * Zed as an ACP *client*. RevealUI is the ACP agent server
   * (`revealui-harnesses acp`, GAP-381 Phase D). No headless Zed adapter;
   * dispatch stays false. MCP can be forwarded to agents per ACP.
   */
  zed: {
    dispatch: {
      generateCode: false,
      analyzeCode: false,
      applyEdit: false,
      executeCommand: false,
    },
    readWorkboard: false,
    writeWorkboard: false,
    claimTasks: false,
    reportConflicts: false,
    headless: false,
    resumable: false,
    forkable: false,
    backgroundable: false,
    hooks: { supported: false, granularity: 'none', canBlock: false },
    sandbox: { supported: false, modes: [] },
    supportsWorktrees: true,
    supportsSkills: false,
    supportsMcp: true,
    memory: { supported: false, backend: 'none' },
    maxContextTokens: 0,
    lifecycleEvents: ['session.start', 'session.stop', 'prompt.submit'],
  },
} as const;

/**
 * Merged view of shipped + roadmap profiles. Use when you want capability
 * data for any known tool ID regardless of adapter-implementation status.
 *
 * Consumers that need to distinguish shipped from roadmap should import
 * `TOOL_PROFILES` and `ROADMAP_PROFILES` separately.
 */
export const ALL_KNOWN_PROFILES: Record<string, ProtocolCapabilities> = {
  ...ROADMAP_PROFILES,
  ...TOOL_PROFILES,
} as const;
