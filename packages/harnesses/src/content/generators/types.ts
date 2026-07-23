import type { ResolverContext } from '../resolvers/types.js';
import type { Agent, Command, Manifest, Rule, Skill } from '../schemas/index.js';

/**
 * Default generator for `content sync|diff|pull` and `manager materialize`.
 *
 * Id remains `claude-code` for registry stability, but emit target is the
 * **project manager** tree (`.revealui/content/`), not a vendor-private
 * `.claude/` fork (GAP-406).
 */
export const DEFAULT_CONTENT_GENERATOR_ID = 'claude-code';

/** On-disk manager content root (relative to project root). */
export const MANAGER_CONTENT_OUTPUT = '.revealui/content';

export interface GeneratedFile {
  /** Relative path from project root (e.g. '.revealui/content/rules/biome.md') */
  relativePath: string;
  content: string;
}

export interface DiffEntry {
  relativePath: string;
  status: 'added' | 'modified' | 'deleted' | 'unchanged';
  expected?: string;
  actual?: string;
}

export interface ContentGenerator {
  readonly id: string;
  readonly outputDir: string;

  generateRule(rule: Rule, ctx: ResolverContext): GeneratedFile[];
  generateCommand(cmd: Command, ctx: ResolverContext): GeneratedFile[];
  generateAgent(agent: Agent, ctx: ResolverContext): GeneratedFile[];
  generateSkill(skill: Skill, ctx: ResolverContext): GeneratedFile[];
  generateAll(manifest: Manifest, ctx: ResolverContext): GeneratedFile[];
}
