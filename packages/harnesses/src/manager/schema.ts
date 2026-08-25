import { z } from 'zod';

/**
 * Project manager manifest (`.revealui/manager.json`).
 *
 * Equal vendor authority: Claude, Grok, Cursor, OpenCode, VSCode, RevDev all
 * *reference* this tree; none is the policy SSOT (GAP-406 / GAP-293).
 */
export const ManagerSchema = z.object({
  version: z.literal(1).default(1),
  /** Human-readable project name */
  name: z.string().min(1).default('RevealUI project'),
  /** Relative content root under .revealui */
  contentRoot: z.string().default('content'),
  /** Day-to-day free surfaces (fleet uses .jv TRACKER; products may override) */
  tracker: z
    .object({
      path: z.string().default('docs/TRACKER.md'),
      note: z.string().optional(),
    })
    .default({ path: 'docs/TRACKER.md' }),
  /** Adapters that may materialize thin stubs pointing here */
  adapters: z
    .array(
      z.object({
        id: z.enum([
          'claude-code',
          'cursor',
          'opencode',
          'vscode',
          'grok',
          'revealui-agent',
          'revdev',
        ]),
        /** Vendor tree relative to project root (null = consume .revealui/content) */
        projectTree: z.string().nullable().default(null),
        /** Equal rank — no adapter is more authoritative than another */
        rank: z.literal('equal').default('equal'),
      }),
    )
    .default([
      { id: 'claude-code', projectTree: '.claude', rank: 'equal' },
      { id: 'cursor', projectTree: '.cursor', rank: 'equal' },
      { id: 'opencode', projectTree: '.opencode', rank: 'equal' },
      { id: 'vscode', projectTree: null, rank: 'equal' },
      { id: 'grok', projectTree: '.grok', rank: 'equal' },
      { id: 'revealui-agent', projectTree: null, rank: 'equal' },
      { id: 'revdev', projectTree: null, rank: 'equal' },
    ]),
  mcp: z
    .object({
      /** Path to mcp config with env-var token refs only (never secrets) */
      configPath: z.string().default('mcp.json'),
    })
    .default({ configPath: 'mcp.json' }),
  /** Package that owns definitions (build-time SSOT) */
  contentPackage: z.string().default('@revealui/harnesses'),
});

export type ManagerConfig = z.infer<typeof ManagerSchema>;

export const MANAGER_DIR = '.revealui';
export const MANAGER_FILE = 'manager.json';
export const MANAGER_CONTENT_DIR = 'content';
