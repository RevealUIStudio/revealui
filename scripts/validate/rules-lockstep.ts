/**
 * Rules Lockstep Gate
 *
 * The `.claude/` config surface (rules/, agents/, skills/) is MATERIALIZED
 * into this repo by revcon (`link.sh --mode copy`) from its profile sources,
 * with a manifest at `.claude/.revcon-manifest.json` recording each file's
 * profile source and sha256. The copies are git-tracked so fresh clones,
 * worktrees, and CI all see the same rules; this gate keeps them in lockstep:
 *
 *   1. Every manifest entry must exist on disk with a matching sha256
 *      (a mismatch means a local hand-edit: edit the revcon profile
 *      instead, then re-run link.sh --mode copy).
 *   2. Every git-tracked file under the materialized dirs must appear in
 *      the manifest (a stray means a hand-added file bypassing revcon).
 *
 * Sibling of the SECRETS.md lockstep test (scripts/sync/__tests__/
 * secret-paths-lockstep.test.ts): same derived-view pattern, different
 * surface. Staleness relative to the CURRENT revcon profiles is checked on
 * the revcon side (`status.sh`) and at session start, not here: CI for this
 * repo verifies only self-consistency, so it needs no sibling checkout.
 *
 * Usage:
 *   pnpm validate:rules-lockstep
 *
 * Exit codes:
 *   0 = manifest present, all hashes match, no strays
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
 */
export function verifyLockstep(root: string, manifest: Manifest, trackedFiles: string[]): string[] {
  const problems: string[] = [];

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
    const have = sha256OfFile(abs);
    if (have !== entry.sha256) {
      problems.push(
        `${fileRel} - content differs from the manifest (locally edited?). ` +
          `Edit the revcon profile (${entry.source}) instead, then re-run link.sh --mode copy.`,
      );
    }
  }

  for (const tracked of trackedFiles) {
    if (!manifestRels.has(tracked)) {
      problems.push(
        `${tracked} - tracked but not in the manifest (hand-added?). ` +
          'Add it to the revcon profile and re-run link.sh --mode copy, or untrack it.',
      );
    }
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

  const problems = verifyLockstep(ROOT, manifest, gitTrackedMaterializedFiles(ROOT));

  if (problems.length > 0) {
    console.error(`✗ ${problems.length} rules-lockstep violation(s):`);
    for (const p of problems) {
      console.error(`  ${p}`);
    }
    console.error('');
    console.error(`  Re-apply from profiles: ${REAPPLY_CMD}`);
    return 1;
  }

  const count = Object.keys(manifest.files).length;
  console.log(
    `✓ rules lockstep: ${count} materialized file(s) match the manifest (profiles: ${manifest.profiles.join(', ')}); no strays`,
  );
  return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
