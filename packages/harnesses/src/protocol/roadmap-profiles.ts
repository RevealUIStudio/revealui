/**
 * Roadmap Capability Profiles
 *
 * Declared profiles for AI coding tools that the Harness Protocol spec
 * targets but which DO NOT have a working adapter in this package today.
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
 * `HarnessCoordinator.dispatchTask` consults both — registered capabilities
 * win, then `TOOL_PROFILES` (shipped), then `ROADMAP_PROFILES` (declared).
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

  // No working adapter yet (GAP-371 Phase 0: data only). Plugins exist in
  // OpenCode but no adapter wiring ships, so hooks stay honestly unsupported.
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
