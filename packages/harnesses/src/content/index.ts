/**
 * @revealui/harnesses/content — Canonical Content Layer
 *
 * Tool-agnostic definitions for AI guidance content (rules, commands, agents, skills).
 * Generators produce tool-specific output (Claude Code, Cursor, etc.) from canonical definitions.
 *
 * @example
 * ```ts
 * import { buildManifest, validateManifest, generateContent, diffContent } from '@revealui/harnesses/content';
 *
 * const manifest = buildManifest();
 * const validation = validateManifest(manifest);
 * const files = generateContent('claude-code', manifest, { projectRoot: '/path/to/project' });
 * ```
 */

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildManifest } from './definitions/index.js';
import { getGenerator, listGenerators } from './generators/index.js';
import type { DiffEntry, GeneratedFile } from './generators/types.js';
import type { ResolverContext } from './resolvers/types.js';
import { type Manifest, ManifestSchema } from './schemas/manifest.js';

export { buildManifest } from './definitions/index.js';
export { getGenerator, listGenerators, registerGenerator } from './generators/index.js';
export type { ContentGenerator, DiffEntry, GeneratedFile } from './generators/types.js';
export { listResolvers, registerResolver, resolveTemplate } from './resolvers/index.js';
export type { ResolverContext, ResolverFn } from './resolvers/types.js';
// Re-export everything consumers need
export type { Agent, Command, Manifest, PreambleTier, Rule, Skill } from './schemas/index.js';
export {
  AgentSchema,
  CommandSchema,
  ManifestSchema,
  PreambleTierSchema,
  RuleSchema,
  SkillSchema,
} from './schemas/index.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ContentSummary {
  rules: number;
  commands: number;
  agents: number;
  skills: number;
  preambles: number;
  total: number;
}

/** Validate a manifest object against the Zod schema. */
export function validateManifest(manifest: unknown): ValidationResult {
  const result = ManifestSchema.safeParse(manifest);
  if (result.success) {
    return { valid: true, errors: [] };
  }
  return {
    valid: false,
    errors: result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
  };
}

/** Generate content files for a specific generator. */
export function generateContent(
  generatorId: string,
  manifest: Manifest,
  ctx: ResolverContext,
): GeneratedFile[] {
  const generator = getGenerator(generatorId);
  if (!generator) {
    throw new Error(
      `Unknown generator "${generatorId}". Available: ${listGenerators().join(', ')}`,
    );
  }
  return generator.generateAll(manifest, ctx);
}

/** Compare generated content against existing files on disk. */
export function diffContent(
  generatorId: string,
  manifest: Manifest,
  ctx: ResolverContext,
  projectRoot: string,
): DiffEntry[] {
  const files = generateContent(generatorId, manifest, ctx);
  const entries: DiffEntry[] = [];

  for (const file of files) {
    const absolutePath = resolve(join(projectRoot, file.relativePath));
    let actual: string | undefined;
    try {
      actual = readFileSync(absolutePath, 'utf-8');
    } catch {
      // File doesn't exist
    }

    if (actual === undefined) {
      entries.push({ relativePath: file.relativePath, status: 'added', expected: file.content });
    } else if (actual === file.content) {
      entries.push({ relativePath: file.relativePath, status: 'unchanged' });
    } else {
      entries.push({
        relativePath: file.relativePath,
        status: 'modified',
        expected: file.content,
        actual,
      });
    }
  }

  return entries;
}

/** Get a summary of all content in the manifest. */
export function listContent(manifest?: Manifest): ContentSummary {
  const m = manifest ?? buildManifest();
  return {
    rules: m.rules.length,
    commands: m.commands.length,
    agents: m.agents.length,
    skills: m.skills.length,
    preambles: m.preambles.length,
    total: m.rules.length + m.commands.length + m.agents.length + m.skills.length,
  };
}
