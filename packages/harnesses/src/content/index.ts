/**
 * @revealui/harnesses/content  -  Canonical Content Layer
 *
 * Tool-agnostic definitions for AI guidance content (rules, commands, agents, skills).
 * Generators produce tool-specific output from canonical definitions.
 *
 * Generators registered today:
 * - `claude-code` (**default** via `DEFAULT_CONTENT_GENERATOR_ID`) — full
 *   rules/commands/agents/skills under the **project manager** tree
 *   `.revealui/content/` (GAP-406). Not a vendor-private `.claude/` fork.
 * - `opencode` — agents + commands under `.opencode/`
 * - `cursor` — hooks.json only (vendor-native surface; policy still in manager)
 * - `vscode` — plugin.json hooks contribution only
 *
 * `manager materialize` runs `writeManagerAdapterContent` so Cursor/OpenCode
 * vendor surfaces are emitted on the **same path** as manager content (equal
 * adapters), not only as orphaned hooks-tree tooling.
 *
 * The adapter layer (`../adapters/`) ships `revealui-agent`, `opencode`, and
 * `cursor` — `vscode` has no adapter (no headless CLI to exec).
 *
 * @example
 * ```ts
 * import {
 *   buildManifest,
 *   validateManifest,
 *   generateContent,
 *   DEFAULT_CONTENT_GENERATOR_ID,
 * } from '@revealui/harnesses/content';
 *
 * const manifest = buildManifest();
 * const validation = validateManifest(manifest);
 * // Default sync lands under .revealui/content (manager tree)
 * const files = generateContent(DEFAULT_CONTENT_GENERATOR_ID, manifest, { projectRoot: '/path/to/project' });
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
export {
  ClaudeCodeGenerator,
  CursorGenerator,
  DEFAULT_CONTENT_GENERATOR_ID,
  getGenerator,
  listGenerators,
  MANAGER_CONTENT_OUTPUT,
  OpenCodeGenerator,
  registerGenerator,
  VSCodeGenerator,
} from './generators/index.js';
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
export type { SkillCatalogEntry, SkillCatalogSource } from './skill-catalog.js';
export { listSkillCatalog, skimSkillFrontmatter } from './skill-catalog.js';
export type { NativeWorkflowSkillId, SkillInvokeRequest } from './skill-invoke.js';
export {
  buildSkillInvokeRequest,
  classifySkillInvokeFailure,
  extractSkillInvokeText,
  isNativeWorkflowSkillId,
  NATIVE_WORKFLOW_SKILL_IDS,
  PHASE_C_INFERENCE_SNAP,
  parseSkillInvokeTimeoutOverride,
  resolveNativeWorkflowSkillId,
  skillInvokeTimeoutMs,
} from './skill-invoke.js';
export type {
  ContentSnapshot,
  ContentSnapshotFile,
  SnapshotCheckResult,
  SnapshotDrift,
} from './snapshot.js';
export {
  buildContentSnapshot,
  CONTENT_SNAPSHOT_VERSION,
  checkAllContentSnapshots,
  checkContentSnapshot,
  getContentSnapshotsDir,
  hashContent,
  loadContentSnapshot,
  snapshotPathFor,
  writeAllContentSnapshots,
  writeContentSnapshot,
} from './snapshot.js';
export type { WriteManagerAdapterContentResult } from './write-manager-adapters.js';
export {
  claudeRulePathForDefinitionId,
  MANAGER_MATERIALIZE_GENERATORS,
  writeManagerAdapterContent,
} from './write-manager-adapters.js';

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
