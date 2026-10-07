/**
 * Write equal-rank adapter generator output as part of manager materialize (GAP-406).
 *
 * - `claude-code` (default) → `.revealui/content/` (policy SSOT on disk)
 * - `cursor` → `.cursor/hooks.json` (vendor-native hooks only)
 * - `opencode` → `.opencode/{agents,commands}/`
 * - `grok` → `.grok/rules/` (preamble tier 1) + on-demand rule skills + commands + agents
 * - GAP-421 phase 2: definition rules also mirrored to `.claude/rules/<id>.md`
 *   so Claude Code loads the same body as content (no hand duals). Grok does
 *   not scan `.revealui/content/`; the grok generator is its load path.
 *
 * Vendor trees remain thin adapters; hardlines stay in package definitions +
 * manager content. Hooks/agents/commands that must live under vendor paths
 * still emit via this one materialize path so Cursor/OpenCode are not
 * "hooks-tree only" orphans outside the manager.
 *
 * Monorepo-only rules under `.claude/rules/` that are NOT definition ids
 * (e.g. git.md, coordination.md) are left alone.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { z } from 'zod';
import { materializeCodexSkills } from '../manager/codex.js';
import { assertManagedDestination, contentRootRelative, loadManager } from '../manager/paths.js';
import { RelativeManagerPathSchema } from '../manager/schema.js';
import { buildManifest } from './definitions/index.js';
import { generateContent } from './generators/index.js';
import { DEFAULT_CONTENT_GENERATOR_ID, type GeneratedFile } from './generators/types.js';
import type { Manifest } from './schemas/manifest.js';

/**
 * Generators run by `manager materialize` for equal project-tree adapters.
 * Order: manager content first, then vendor-native surfaces.
 */
export const MANAGER_MATERIALIZE_GENERATORS: readonly string[] = [
  DEFAULT_CONTENT_GENERATOR_ID,
  'cursor',
  'opencode',
  'grok',
];

/**
 * Relative path for the Claude Code load surface for a definition rule id.
 * Not used for `00-revealui-manager.md` (adapter stub from materializeManager).
 */
export function claudeRulePathForDefinitionId(ruleId: string): string {
  return join('.claude', 'rules', `${ruleId}.md`);
}

const ClaudeOwnershipSchema = z
  .object({
    mode: z.literal('copy'),
    editor: z.literal('claude'),
    profiles: z.array(z.string()),
    files: z.record(
      RelativeManagerPathSchema,
      z
        .object({
          source: z.string().min(1),
          sha256: z.string().length(64),
        })
        .passthrough(),
    ),
  })
  .passthrough();

/** One existing ledger records each file's actual owner; profile entries survive. */
function claudeOwnershipFile(projectRoot: string, mirrors: GeneratedFile[]): GeneratedFile {
  const relativePath = '.claude/.revcon-manifest.json';
  assertManagedDestination(projectRoot, relativePath);
  const absolutePath = join(projectRoot, relativePath);
  const ownership = existsSync(absolutePath)
    ? ClaudeOwnershipSchema.parse(JSON.parse(readFileSync(absolutePath, 'utf8')))
    : { mode: 'copy' as const, editor: 'claude' as const, profiles: [], files: {} };
  const entries = { ...ownership.files };
  for (const file of mirrors) {
    const rel = file.relativePath.slice('.claude/'.length);
    entries[rel] = {
      source: `harnesses:${rel}`,
      sha256: createHash('sha256').update(file.content).digest('hex'),
    };
  }
  ownership.files = Object.fromEntries(
    Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)),
  );
  return { relativePath, content: `${JSON.stringify(ownership, null, 2)}\n` };
}

export interface WriteManagerAdapterContentResult {
  byGenerator: Record<string, number>;
  total: number;
  paths: string[];
  /** Definition rules mirrored into `.claude/rules/` (GAP-421 phase 2). */
  claudeRuleMirrors: string[];
  codexPaths: string[];
}

/**
 * Generate + write files for each manager-materialize generator under projectRoot.
 * Also mirrors definition-backed rule bodies into `.claude/rules/` so Claude Code
 * cannot drift from definitions (ADR 2026-07-25 phase 2).
 */
export function writeManagerAdapterContent(
  projectRoot: string,
  options?: { generatorIds?: readonly string[]; manifest?: Manifest },
): WriteManagerAdapterContentResult {
  const config = loadManager(projectRoot);
  const registered = new Set<string>(config.adapters.map((adapter) => adapter.id));
  const generatorIds =
    options?.generatorIds ??
    MANAGER_MATERIALIZE_GENERATORS.filter(
      (id) => id === DEFAULT_CONTENT_GENERATOR_ID || registered.has(id),
    );
  const manifest = options?.manifest ?? buildManifest();
  const byGenerator: Record<string, number> = {};
  const paths: string[] = [];
  const claudeRuleMirrors: string[] = [];
  const contentRulesPrefix = `${contentRootRelative(config)}/rules/`;
  const planned: GeneratedFile[] = [];
  let total = 0;

  for (const id of generatorIds) {
    const files = generateContent(id, manifest, { projectRoot });
    for (const file of files) {
      planned.push(file);
      paths.push(file.relativePath);

      // GAP-421 phase 2: same rule body under Claude's load path.
      if (
        id === DEFAULT_CONTENT_GENERATOR_ID &&
        registered.has('claude-code') &&
        file.relativePath.startsWith(contentRulesPrefix)
      ) {
        const ruleFile = basename(file.relativePath);
        if (!ruleFile.endsWith('.md') || ruleFile.startsWith('00-')) {
          continue;
        }
        const ruleId = ruleFile.slice(0, -'.md'.length);
        const claudeRel = claudeRulePathForDefinitionId(ruleId);
        planned.push({ relativePath: claudeRel, content: file.content });
        claudeRuleMirrors.push(claudeRel);
        paths.push(claudeRel);
        total += 1;
      }
    }
    byGenerator[id] = files.length;
    total += files.length;
  }

  for (const file of planned) assertManagedDestination(projectRoot, file.relativePath);
  if (claudeRuleMirrors.length) {
    const mirrors = planned.filter((file) => claudeRuleMirrors.includes(file.relativePath));
    const ledger = claudeOwnershipFile(projectRoot, mirrors);
    planned.push(ledger);
    paths.push(ledger.relativePath);
    total += 1;
  }
  const codexPaths = config.adapters.some((adapter) => adapter.id === 'codex')
    ? materializeCodexSkills(projectRoot, manifest)
    : [];
  for (const file of planned) {
    const absolutePath = join(projectRoot, file.relativePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, file.content, 'utf-8');
  }
  paths.push(...codexPaths);
  total += codexPaths.length;
  return { byGenerator, total, paths, claudeRuleMirrors, codexPaths };
}
