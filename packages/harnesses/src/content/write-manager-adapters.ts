/**
 * Write equal-rank adapter generator output as part of manager materialize (GAP-406).
 *
 * - `claude-code` (default) → `.revealui/content/` (policy SSOT on disk)
 * - `cursor` → `.cursor/hooks.json` (vendor-native hooks only)
 * - `opencode` → `.opencode/{agents,commands}/`
 *
 * Vendor trees remain thin adapters; hardlines stay in package definitions +
 * manager content. Hooks/agents/commands that must live under vendor paths
 * still emit via this one materialize path so Cursor/OpenCode are not
 * "hooks-tree only" orphans outside the manager.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { buildManifest } from './definitions/index.js';
import { getGenerator } from './generators/index.js';
import { DEFAULT_CONTENT_GENERATOR_ID } from './generators/types.js';
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

export interface WriteManagerAdapterContentResult {
  byGenerator: Record<string, number>;
  total: number;
  paths: string[];
}

/**
 * Generate + write files for each manager-materialize generator under projectRoot.
 */
export function writeManagerAdapterContent(
  projectRoot: string,
  options?: { generatorIds?: readonly string[]; manifest?: Manifest },
): WriteManagerAdapterContentResult {
  const generatorIds = options?.generatorIds ?? MANAGER_MATERIALIZE_GENERATORS;
  const manifest = options?.manifest ?? buildManifest();
  const byGenerator: Record<string, number> = {};
  const paths: string[] = [];
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
    }
    byGenerator[id] = files.length;
    total += files.length;
  }

  return { byGenerator, total, paths };
}
