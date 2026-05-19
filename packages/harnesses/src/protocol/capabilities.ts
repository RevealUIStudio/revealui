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
 * Only `revealui-agent` ships an adapter today. Profile data for tools
 * that are spec'd but have no adapter implementation lives in
 * `./roadmap-profiles.ts` to make the spec-vs-shipped gap structurally
 * visible.
 *
 * If you're looking for the previous full set (claude-code, codex,
 * cursor, revealui-agent), import `ALL_KNOWN_PROFILES` from
 * `./roadmap-profiles.ts` which merges both.
 */
export const TOOL_PROFILES: Record<string, ProtocolCapabilities> = {
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
