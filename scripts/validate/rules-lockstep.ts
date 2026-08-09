/**
 * Rules Lockstep Gate
 *
 * The `.claude/` config surface has two owners (GAP-421 phase 2):
 *
 *   A) **revcon-owned** files (agents, skills, monorepo-only rules) are
 *      MATERIALIZED by revcon (`link.sh --mode copy`) with a manifest at
 *      `.claude/.revcon-manifest.json` recording each file's profile source
 *      and sha256.
 *   B) **definition-owned** rules under `.claude/rules/<id>.md` that also
 *      exist as `.revealui/content/rules/<id>.md` are mirrored by
 *      `revealui-harnesses manager materialize` from package definitions.
 *      Those must match content byte-for-byte (not the revcon profile copy).
 *
 * Gate rules:
 *   1. Every revcon-manifest entry that is NOT a definition-owned rule must
 *      exist with a matching sha256 (edit the revcon profile + re-link).
 *   2. Every definition-owned `.claude/rules/<id>.md` must match content
 *      (run manager materialize). Manifest hash for those ids is ignored.
 *   3. Every other git-tracked file under the materialized dirs must appear
 *      in the revcon manifest (stray hand-add).
 *
 * Usage:
 *   pnpm validate:rules-lockstep
 *
 * Exit codes:
 *   0 = consistent
 *   1 = drift detected (list printed) or manifest missing
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '../..');
export const MANIFEST_REL = path.posix.join('.claude', '.revcon-manifest.json');
export const MATERIALIZED_DIRS = ['.claude/rules', '.claude/agents', '.claude/skills'];
const CONTENT_RULES_REL = path.posix.join('.revealui', 'content', 'rules');
const MATERIALIZE_CMD = 'pnpm exec revealui-harnesses manager materialize';
const REAPPLY_CMD =
  'bash ~/revfleet/revcon/link.sh --target ~/revfleet/revealui --profile revfleet --profile revealui --editor claude --mode copy';

export interface ManifestEntry {
  source: string;
  sha256: string;
}

export interface Manifest {
  mode: string;
  editor: string;
  profiles: string[];
  files: Record<string, ManifestEntry>;
}

export function sha256OfFile(filePath: string): string {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export function loadManifest(root: string): Manifest | null {
  const manifestPath = path.join(root, MANIFEST_REL);
  if (!fs.existsSync(manifestPath)) return null;
  const parsed: unknown = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`${manifestPath} is not a JSON object`);
  }
  return parsed as Manifest;
}

/**
 * Basenames (without .md) of definition-backed rules present under content.
 * Empty when the content tree is absent (caller still fails manager check).
 */
export function definitionRuleIdsFromContent(root: string): Set<string> {
  const dir = path.join(root, CONTENT_RULES_REL);
  const ids = new Set<string>();
  if (!fs.existsSync(dir)) return ids;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.md') || name.startsWith('00-')) continue;
    ids.add(name.slice(0, -'.md'.length));
  }
  return ids;
}

/** True when `rel` is `.claude/rules/<definition-id>.md`. */
export function isDefinitionClaudeRule(rel: string, definitionIds: Set<string>): boolean {
  const prefix = '.claude/rules/';
  if (!(rel.startsWith(prefix) && rel.endsWith('.md'))) return false;
  const base = rel.slice(prefix.length, -'.md'.length);
  if (base.includes('/') || base.startsWith('00-')) return false;
  return definitionIds.has(base);
}

function gitTrackedMaterializedFiles(root: string): string[] {
  const out = execFileSync('git', ['ls-files', '--', ...MATERIALIZED_DIRS], {
    cwd: root,
    encoding: 'utf8',
  });
  return out.split('\n').filter((line) => line.length > 0);
}

/**
 * Pure verification core: returns one human-readable problem line per
 * violation. `trackedFiles` is the repo-relative list of git-tracked files
 * under MATERIALIZED_DIRS (injected so tests need no git repo).
 * `definitionIds` is injected for tests; defaults from content tree when omitted.
 */
export function verifyLockstep(
  root: string,
  manifest: Manifest,
  trackedFiles: string[],
  definitionIds?: Set<string>,
): string[] {
  const problems: string[] = [];
  const defIds = definitionIds ?? definitionRuleIdsFromContent(root);

  if (manifest.mode !== 'copy' || typeof manifest.files !== 'object' || manifest.files === null) {
    return [`${MANIFEST_REL} is malformed (expected mode "copy" with a files map)`];
  }

  const manifestRels = new Set<string>();

  for (const [rel, entry] of Object.entries(manifest.files)) {
    const fileRel = path.posix.join('.claude', rel);
    manifestRels.add(fileRel);
    const abs = path.join(root, '.claude', rel);
    if (!fs.existsSync(abs)) {
      problems.push(`${fileRel} - missing on disk (manifest source: ${entry.source})`);
      continue;
    }
    if (fs.lstatSync(abs).isSymbolicLink()) {
      problems.push(`${fileRel} - still a symlink; re-materialize with link.sh --mode copy`);
      continue;
    }

    // Definition-owned rules: lock to content, not the revcon profile hash.
    if (isDefinitionClaudeRule(fileRel, defIds)) {
      const id = path.posix.basename(fileRel, '.md');
      const contentAbs = path.join(root, CONTENT_RULES_REL, `${id}.md`);
      if (!fs.existsSync(contentAbs)) {
        problems.push(
          `${fileRel} - definition rule missing content twin ${CONTENT_RULES_REL}/${id}.md — run: ${MATERIALIZE_CMD}`,
        );
        continue;
      }
      if (sha256OfFile(abs) !== sha256OfFile(contentAbs)) {
        problems.push(
          `${fileRel} - dual drift vs ${CONTENT_RULES_REL}/${id}.md (GAP-421 phase 2). ` +
            `Run: ${MATERIALIZE_CMD}`,
        );
      }
      continue;
    }

    const have = sha256OfFile(abs);
    if (have !== entry.sha256) {
      problems.push(
        `${fileRel} - content differs from the manifest (locally edited?). ` +
          `Edit the revcon profile (${entry.source}) instead, then re-run link.sh --mode copy.`,
      );
    }
  }

  // Definition mirrors not in the revcon manifest still must match content.
  for (const tracked of trackedFiles) {
    if (!isDefinitionClaudeRule(tracked, defIds)) continue;
    const id = path.posix.basename(tracked, '.md');
    const abs = path.join(root, tracked);
    const contentAbs = path.join(root, CONTENT_RULES_REL, `${id}.md`);
    if (!fs.existsSync(abs)) continue;
    if (!fs.existsSync(contentAbs)) {
      problems.push(`${tracked} - definition rule missing content twin — run: ${MATERIALIZE_CMD}`);
      continue;
    }
    if (sha256OfFile(abs) !== sha256OfFile(contentAbs)) {
      problems.push(
        `${tracked} - dual drift vs ${CONTENT_RULES_REL}/${id}.md — run: ${MATERIALIZE_CMD}`,
      );
    }
  }

  for (const tracked of trackedFiles) {
    if (manifestRels.has(tracked)) continue;
    if (isDefinitionClaudeRule(tracked, defIds)) continue; // owned by materialize
    problems.push(
      `${tracked} - tracked but not in the manifest (hand-added?). ` +
        'Add it to the revcon profile and re-run link.sh --mode copy, or untrack it.',
    );
  }

  return problems;
}

export function main(): number {
  const manifest = loadManifest(ROOT);
  if (manifest === null) {
    console.error(`✗ Missing ${MANIFEST_REL}`);
    console.error('  The .claude config surface must be materialized by revcon:');
    console.error(`    ${REAPPLY_CMD}`);
    return 1;
  }

  const tracked = gitTrackedMaterializedFiles(ROOT);
  const defIds = definitionRuleIdsFromContent(ROOT);
  const problems = verifyLockstep(ROOT, manifest, tracked, defIds);

  if (problems.length > 0) {
    console.error(`✗ ${problems.length} rules-lockstep violation(s):`);
    for (const p of problems) {
      console.error(`  ${p}`);
    }
    console.error('');
    console.error(`  Revcon-owned: ${REAPPLY_CMD}`);
    console.error(`  Definition-owned: ${MATERIALIZE_CMD}`);
    return 1;
  }

  const count = Object.keys(manifest.files).length;
  console.log(
    `✓ rules lockstep: ${count} revcon-manifest file(s) (profiles: ${manifest.profiles.join(', ')}); ` +
      `${defIds.size} definition rule(s) match content; no strays`,
  );
  return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
