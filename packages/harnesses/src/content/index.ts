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
 * - `grok` — preamble tier 1 under `.grok/rules/`, remaining rules as on-demand
 *   skills, content commands under `.grok/commands/`, content agents, spawn map
 *   (Grok does not scan `.revealui/content`)
 *
 * `manager materialize` runs `writeManagerAdapterContent` so Cursor/OpenCode/Grok
 * vendor surfaces are emitted on the **same path** as manager content (equal
 * adapters), not only as orphaned hooks-tree tooling.
 *
 * The adapter layer (`../adapters/`) ships `revealui-agent`, `codex`, `opencode`,
 * `cursor`, and `grok` — `vscode` has no adapter (no headless CLI to exec).
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

import { lstatSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildManifest } from './definitions/index.js';
import { generateContent } from './generators/index.js';
import type { DiffEntry } from './generators/types.js';
import type { ResolverContext } from './resolvers/types.js';
import { type Manifest, ManifestSchema } from './schemas/manifest.js';

export { buildManifest } from './definitions/index.js';
export {
  ClaudeCodeGenerator,
  CursorGenerator,
  DEFAULT_CONTENT_GENERATOR_ID,
  GROK_MANAGER_RULE_PATH,
  GROK_OUTPUT_DIR,
  GROK_SPAWN_MAP,
  GROK_SPAWN_MAP_PATH,
  GrokGenerator,
  generateContent,
  getGenerator,
  grokCommandPath,
  grokRulePathForDefinitionId,
  listGenerators,
  MANAGER_CONTENT_OUTPUT,
  OpenCodeGenerator,
  registerGenerator,
  VSCodeGenerator,
} from './generators/index.js';
export type { ContentGenerator, DiffEntry, GeneratedFile } from './generators/types.js';
export { alwaysOnRuleIds } from './preamble-ids.js';
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
export type {
  NativeWorkflowSkillId,
  NativeWorkflowToolName,
  SkillInvokeCompletionBody,
  SkillInvokeMessage,
  SkillInvokeRequest,
  SkillInvokeToolCall,
  SkillInvokeToolDefinition,
  SkillSuitabilityAssessment,
} from './skill-invoke.js';
export {
  buildSkillInvokeRequest,
  classifySkillInvokeFailure,
  extractSkillInvokeText,
  extractSkillInvokeToolCalls,
  isNativeWorkflowSkillId,
  isNativeWorkflowToolName,
  mapNativeToolsToCodingInclude,
  NATIVE_TO_CODING_TOOL,
  NATIVE_WORKFLOW_SKILL_IDS,
  NATIVE_WORKFLOW_TOOL_NAMES,
  nativeWorkflowToolDefinitions,
  PHASE_C_INFERENCE_SNAP,
  parseNativeWorkflowTools,
  parseSkillInvokeTimeoutOverride,
  resolveNativeWorkflowSkillId,
  SKILL_INVOKE_MAX_COMPLETION_TOKENS,
  SKILL_INVOKE_MAX_TOOL_ROUNDS,
  SkillSuitabilityAssessmentSchema,
  skillInvokeCompletionBody,
  skillInvokeTimeoutMs,
} from './skill-invoke.js';
export type {
  RunNativeSkillInvokeOptions,
  RunNativeSkillInvokeResult,
} from './skill-invoke-runtime.js';
export { collectSkillInvokeOutput, runNativeSkillInvoke } from './skill-invoke-runtime.js';
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

/** Export selected canonical rules to declared, existing profile rule directories. */
export function writeRuleProfileExports(
  manifest: Manifest,
  directories: string[],
  ruleIds: string[],
): number {
  if (directories.length === 0) return 0;
  if (ruleIds.length === 0)
    throw new Error('Profile rule export requires explicit --rule-id selection');
  const selected = [...new Set(ruleIds)].map((id) => {
    const rule = manifest.rules.find((candidate) => candidate.id === id);
    if (!(rule && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))) {
      throw new Error(`Unknown canonical rule: ${id}`);
    }
    return rule;
  });
  const destinations = [...new Set(directories.map((directory) => resolve(directory)))].flatMap(
    (directory) => {
      if (!lstatSync(directory).isDirectory() || realpathSync(directory) !== directory) {
        throw new Error('Profile rule directory must be a real, existing directory');
      }
      return selected.map((rule) => {
        const destination = join(directory, `${rule.id}.md`);
        try {
          if (!lstatSync(destination).isFile() || lstatSync(destination).isSymbolicLink()) {
            throw new Error('Profile rule destination must be a regular file');
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
        return { destination, content: rule.content };
      });
    },
  );
  for (const { destination, content } of destinations) writeFileSync(destination, content, 'utf8');
  return destinations.length;
}

/** Canonical export replaces obsolete tier copies instead of retaining parallel definitions. */
export function writeCanonicalDefinition(
  outputDir: string,
  kind: 'rules' | 'commands' | 'agents' | 'skills',
  item: { id: string; tier?: 'oss' | 'pro'; content: string },
): void {
  const tier = item.tier ?? 'oss';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id))
    throw new Error('Invalid canonical definition id');
  const stale = join(outputDir, kind, tier === 'oss' ? 'pro' : 'oss', `${item.id}.md`);
  try {
    if (!lstatSync(stale).isFile() || lstatSync(stale).isSymbolicLink()) {
      throw new Error('Obsolete tier destination must be a regular file');
    }
    rmSync(stale);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const directory = join(outputDir, kind, tier);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, `${item.id}.md`), item.content, 'utf8');
}
