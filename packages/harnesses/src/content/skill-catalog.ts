/**
 * GAP-293 Phase B — read-only skill catalog.
 *
 * Lists skills a Claude user already sees: package definitions, materialized
 * `.revealui/content/skills`, and an optional revskills tree. Never executes
 * SKILL.md. RevDev consumes this list; it does not own a second pack.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildManifest } from './definitions/index.js';
import { MANAGER_CONTENT_OUTPUT } from './generators/types.js';

export type SkillCatalogSource = 'content' | 'revskills' | 'definitions';

export interface SkillCatalogEntry {
  id: string;
  name: string;
  description: string;
  path: string;
  source: SkillCatalogSource;
}

export interface ListSkillCatalogOptions {
  projectRoot?: string;
  revskillsRoot?: string;
  includeDefinitions?: boolean;
}

function isEnoent(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 'ENOENT'
  );
}

function unquote(raw: string): string {
  if (raw.length >= 2) {
    const a = raw[0];
    const b = raw[raw.length - 1];
    if ((a === '"' && b === '"') || (a === "'" && b === "'")) {
      return raw.slice(1, -1);
    }
  }
  return raw;
}

/** Line-oriented YAML frontmatter skim. No authored regex. */
export function skimSkillFrontmatter(text: string): { name: string; description: string } {
  const lines = text.split('\n');
  let inFm = false;
  let name = '';
  let description = '';
  for (const line of lines) {
    if (line === '---') {
      if (!inFm) {
        inFm = true;
        continue;
      }
      break;
    }
    if (!inFm) break;
    if (line.startsWith('name:')) name = unquote(line.slice(5).trim());
    else if (line.startsWith('description:')) description = unquote(line.slice(12).trim());
  }
  return { name, description };
}

function readSkillFile(filePath: string): string | null {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch (err) {
    if (isEnoent(err)) return null;
    throw err;
  }
}

function listSkillDir(skillsDir: string, source: SkillCatalogSource): SkillCatalogEntry[] {
  let names: string[];
  try {
    names = readdirSync(skillsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch (err) {
    if (isEnoent(err)) return [];
    throw err;
  }
  const out: SkillCatalogEntry[] = [];
  for (const id of names) {
    const path = join(skillsDir, id, 'SKILL.md');
    const text = readSkillFile(path);
    if (text === null) continue;
    const fields = skimSkillFrontmatter(text);
    out.push({
      id,
      name: fields.name || id,
      description: fields.description,
      path,
      source,
    });
  }
  return out;
}

/**
 * Union catalog. Disk content wins over revskills over definitions for the
 * same id so a materialized project tree is what RevDev reports first.
 */
export function listSkillCatalog(options: ListSkillCatalogOptions = {}): SkillCatalogEntry[] {
  const includeDefinitions = options.includeDefinitions !== false;
  const byId = new Map<string, SkillCatalogEntry>();

  if (includeDefinitions) {
    for (const skill of buildManifest().skills) {
      byId.set(skill.id, {
        id: skill.id,
        name: skill.name,
        description: skill.description,
        path: `${MANAGER_CONTENT_OUTPUT}/skills/${skill.id}/SKILL.md`,
        source: 'definitions',
      });
    }
  }

  if (options.revskillsRoot) {
    for (const entry of listSkillDir(join(options.revskillsRoot, 'skills'), 'revskills')) {
      byId.set(entry.id, entry);
    }
  }

  if (options.projectRoot) {
    const contentDir = join(options.projectRoot, MANAGER_CONTENT_OUTPUT, 'skills');
    for (const entry of listSkillDir(contentDir, 'content')) {
      byId.set(entry.id, entry);
    }
  }

  return [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
