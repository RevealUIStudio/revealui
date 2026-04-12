/**
 * VAUGHN Capability Model (Section 4 of VAUGHN.md)
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
 * Full capability declaration for a VAUGHN adapter.
 * Each adapter declares this statically at registration time.
 */
export interface VaughnCapabilities {
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
export function createDefaultCapabilities(): VaughnCapabilities {
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
 * Known capability profiles for supported tools (Section 4.2).
 * These are reference profiles; actual adapters may override.
 */
export const TOOL_PROFILES: Record<string, VaughnCapabilities> = {
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

  cursor: {
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
    maxContextTokens: 128_000,
    lifecycleEvents: [],
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
