/**
 * Harness Protocol Capability Model
 *
 * Defines the full superset of capabilities an adapter can declare.
 * Adapters degrade gracefully when a tool lacks a feature.
 */

/** Available sandbox isolation modes. */
export type SandboxMode = 'read-only' | 'workspace-write' | 'full-access';

/** Hook granularity levels. */
export type HookGranularity = 'none' | 'bash-only' | 'all-tools';

/** Memory backend types. */
export type MemoryBackend = 'none' | 'sqlite' | 'crdt' | 'file';

/**
 * Full capability declaration for a protocol adapter.
 * Each adapter declares this statically at registration time.
 */
export interface ProtocolCapabilities {
  /** Dispatch operations: can the adapter programmatically invoke these? */
  dispatch: {
    /** Adapter can send a prompt and get code back */
    generateCode: boolean;
    /** Adapter can request code analysis */
    analyzeCode: boolean;
    /** Adapter can send a diff to apply */
    applyEdit: boolean;
    /** Adapter can invoke shell commands */
    executeCommand: boolean;
  };

  /** Coordination capabilities */
  readWorkboard: boolean;
  writeWorkboard: boolean;
  claimTasks: boolean;
  reportConflicts: boolean;

  /** Lifecycle capabilities */
  headless: boolean;
  resumable: boolean;
  forkable: boolean;
  backgroundable: boolean;

  /** Safety: hook system */
  hooks: {
    supported: boolean;
    granularity: HookGranularity;
    canBlock: boolean;
  };

  /** Safety: OS-level sandboxing */
  sandbox: {
    supported: boolean;
    modes: SandboxMode[];
    writablePaths?: string[];
  };

  supportsWorktrees: boolean;

  /** Context capabilities */
  supportsSkills: boolean;
  supportsMcp: boolean;
  memory: {
    supported: boolean;
    backend: MemoryBackend;
  };
  /**
   * Maximum context window the tool exposes, in tokens.
   *
   * `0` has two distinct meanings depending on context: `createDefaultCapabilities()`
   * uses it as the "everything disabled" default, and BYO-model tools (e.g.
   * `opencode`, which brings the user's own provider/model rather than a fixed
   * one) also declare `0` because the effective window depends on whichever
   * model the user configured, not a fixed capability of the tool. Do not treat
   * `0` as "unsupported" when the tool's other dispatch capabilities are `true`
   * -- check `dispatch`/`headless` instead.
   */
  maxContextTokens: number;

  /** Which lifecycle events the tool emits natively */
  lifecycleEvents: string[];
}

/** Creates a default capabilities object with all features disabled. */
export function createDefaultCapabilities(): ProtocolCapabilities {
  return {
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
    supportsWorktrees: false,
    supportsSkills: false,
    supportsMcp: false,
    memory: { supported: false, backend: 'none' },
    maxContextTokens: 0,
    lifecycleEvents: [],
  };
}

/**
 * Capability profiles for tools that have working adapters in this package.
 *
 * `revealui-agent`, `opencode`, and `cursor` ship adapters today
 * (`OpenCodeAdapter` / `CursorAdapter`, `src/adapters/*.ts`). Profile data
 * for tools that are spec'd but have no adapter implementation lives in
 * `./roadmap-profiles.ts` to make the spec-vs-shipped gap structurally
 * visible.
 *
 * If you're looking for the previous full set (claude-code, codex,
 * cursor, revealui-agent, opencode), import `ALL_KNOWN_PROFILES` from
 * `./roadmap-profiles.ts` which merges both.
 */
export const TOOL_PROFILES: Record<string, ProtocolCapabilities> = {
  // OpenCode brings its own model (BYO via models.dev/AI-SDK) and has no
  // in-loop hook system today -- an OpenCode plugin could add one later,
  // but until a plugin ships, `hooks.supported` stays honestly false.
  // `maxContextTokens: 0` is the BYO sentinel documented on the interface
  // field above, not a capability defect.
  opencode: {
    dispatch: {
      generateCode: true,
      analyzeCode: true,
      applyEdit: false,
      executeCommand: true,
    },
    readWorkboard: false,
    writeWorkboard: false,
    claimTasks: false,
    reportConflicts: false,
    headless: true,
    resumable: true,
    forkable: true,
    backgroundable: true,
    hooks: { supported: false, granularity: 'none', canBlock: false },
    sandbox: { supported: false, modes: [] },
    supportsWorktrees: false,
    supportsSkills: true,
    supportsMcp: true,
    memory: { supported: false, backend: 'none' },
    maxContextTokens: 0,
    lifecycleEvents: [],
  },

  // Cursor's `.cursor/hooks.json` (multi-editor harness design doc §2.3,
  // verified 2026-07-17) is nearly isomorphic to Claude Code's own hook
  // system -- command-based hooks over stdio JSON, allow/deny/ask
  // decisions, exit code 2 blocks -- so `hooks.supported: true` here is
  // backed by a real adapter + CLI subcommand
  // (`../adapters/cursor-adapter.ts`, `../../hooks/`), not aspirational.
  // `maxContextTokens: 128_000` carries the value the roadmap profile
  // already declared (see `./roadmap-profiles.ts`'s prior `cursor` entry,
  // now removed on promotion) -- a real number, not the `0` BYO sentinel
  // documented on `maxContextTokens` above, so it is kept rather than
  // invented. Cursor bundles multiple first-party models with differing
  // real context windows (including Grok 4.5); 128k is the conservative
  // floor across that pool, not a per-model ceiling.
  cursor: {
    dispatch: {
      generateCode: true,
      analyzeCode: true,
      applyEdit: false,
      executeCommand: true,
    },
    readWorkboard: false,
    writeWorkboard: false,
    claimTasks: false,
    reportConflicts: false,
    headless: true,
    resumable: false,
    forkable: false,
    backgroundable: true,
    hooks: { supported: true, granularity: 'all-tools', canBlock: true },
    sandbox: { supported: false, modes: [] },
    supportsWorktrees: false,
    supportsSkills: false,
    supportsMcp: true,
    memory: { supported: false, backend: 'none' },
    maxContextTokens: 128_000,
    lifecycleEvents: [
      'session.start',
      'session.stop',
      'prompt.submit',
      'tool.before',
      'tool.after',
      'tool.blocked',
    ],
  },

  'revealui-agent': {
    dispatch: {
      generateCode: true,
      analyzeCode: true,
      applyEdit: true,
      executeCommand: true,
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
    memory: { supported: true, backend: 'crdt' },
    maxContextTokens: 200_000,
    lifecycleEvents: [
      'session.start',
      'session.stop',
      'session.crash',
      'prompt.submit',
      'tool.before',
      'tool.after',
      'tool.blocked',
      'task.claimed',
      'task.completed',
      'agent.heartbeat',
    ],
  },
} as const;
