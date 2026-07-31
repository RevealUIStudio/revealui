/**
 * Write equal-rank adapter generator output as part of manager materialize (GAP-406).
 *
 * - `claude-code` (default) → `.revealui/content/` (policy SSOT on disk)
 * - `cursor` → `.cursor/hooks.json` (vendor-native hooks only)
 * - `opencode` → `.opencode/{agents,commands}/`
 * - GAP-421 phase 2: definition rules also mirrored to `.claude/rules/<id>.md`
 *   so Claude Code loads the same body as content (no hand duals).
 *
 * Vendor trees remain thin adapters; hardlines stay in package definitions +
 * manager content. Hooks/agents/commands that must live under vendor paths
 * still emit via this one materialize path so Cursor/OpenCode are not
 * "hooks-tree only" orphans outside the manager.
 *
 * Monorepo-only rules under `.claude/rules/` that are NOT definition ids
 * (e.g. git.md, coordination.md) are left alone.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { buildManifest } from './definitions/index.js';
import { getGenerator } from './generators/index.js';
import { DEFAULT_CONTENT_GENERATOR_ID, MANAGER_CONTENT_OUTPUT } from './generators/types.js';
import type { Manifest } from './schemas/manifest.js';

/**
 * Generators run by `manager materialize` for equal project-tree adapters.
 * Order: manager content first, then vendor-native surfaces.
 */
export const MANAGER_MATERIALIZE_GENERATORS: readonly string[] = [
  DEFAULT_CONTENT_GENERATOR_ID,
  'cursor',
  'opencode',
];

/** Content rules path prefix under the project (relative). */
const CONTENT_RULES_PREFIX = `${MANAGER_CONTENT_OUTPUT}/rules/`;

/**
 * Relative path for the Claude Code load surface for a definition rule id.
 * Not used for `00-revealui-manager.md` (adapter stub from materializeManager).
 */
export function claudeRulePathForDefinitionId(ruleId: string): string {
  return join('.claude', 'rules', `${ruleId}.md`);
}

export interface WriteManagerAdapterContentResult {
  byGenerator: Record<string, number>;
  total: number;
  paths: string[];
  /** Definition rules mirrored into `.claude/rules/` (GAP-421 phase 2). */
  claudeRuleMirrors: string[];
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
  const generatorIds = options?.generatorIds ?? MANAGER_MATERIALIZE_GENERATORS;
  const manifest = options?.manifest ?? buildManifest();
  const byGenerator: Record<string, number> = {};
  const paths: string[] = [];
  const claudeRuleMirrors: string[] = [];
  let total = 0;

  for (const id of generatorIds) {
    const generator = getGenerator(id);
    if (!generator) {
      throw new Error(
        `Unknown generator "${id}" during manager materialize. Available: check listGenerators()`,
      );
    }
    const files = generator.generateAll(manifest, { projectRoot });
    for (const file of files) {
      const absolutePath = join(projectRoot, file.relativePath);
      mkdirSync(dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, file.content, 'utf-8');
      paths.push(file.relativePath);

      // GAP-421 phase 2: same rule body under Claude's load path.
      if (
        id === DEFAULT_CONTENT_GENERATOR_ID &&
        file.relativePath.startsWith(CONTENT_RULES_PREFIX)
      ) {
        const ruleFile = basename(file.relativePath);
        if (!ruleFile.endsWith('.md') || ruleFile.startsWith('00-')) {
          continue;
        }
        const ruleId = ruleFile.slice(0, -'.md'.length);
        const claudeRel = claudeRulePathForDefinitionId(ruleId);
        const claudeAbs = join(projectRoot, claudeRel);
        mkdirSync(dirname(claudeAbs), { recursive: true });
        writeFileSync(claudeAbs, file.content, 'utf-8');
        claudeRuleMirrors.push(claudeRel);
        paths.push(claudeRel);
        total += 1;
      }
    }
    byGenerator[id] = files.length;
    total += files.length;
  }

  return { byGenerator, total, paths, claudeRuleMirrors };
}
