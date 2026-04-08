import type { ResolverContext } from '../resolvers/types.js';
import type { Agent, Command, Manifest, Rule, Skill } from '../schemas/index.js';

export interface GeneratedFile {
  /** Relative path from project root (e.g. '.claude/rules/biome.md') */
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
