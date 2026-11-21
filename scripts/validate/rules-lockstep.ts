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
 *      (run manager materialize). Its manifest source must declare harness ownership and its hash must match.
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
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { rules } from '../../packages/harnesses/src/content/definitions/rules/index.js';
import { claudeManagerStubText } from '../../packages/harnesses/src/manager/materialize.js';
import {
  contentRootRelative,
  loadManager,
  readManagedFile,
} from '../../packages/harnesses/src/manager/paths.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
export const MANIFEST_REL = path.posix.join('.claude', '.revcon-manifest.json');
export const MATERIALIZED_DIRS = [
  '.claude/rules',
  '.claude/agents',
  '.claude/skills',
  '.claude/workflows',
];
function contentRulesRelative(root: string): string {
  return path.posix.join(contentRootRelative(loadManager(root)), 'rules');
}
const MATERIALIZE_CMD = 'pnpm exec revealui-harnesses manager materialize';
const REAPPLY_CMD =
  'bash "$REVEALFLEET_ROOT/revcon/link.sh" --target "$PWD" --profile revealfleet --profile revealui --editor claude --mode copy';

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
  return createHash('sha256')
    .update(readManagedFile(path.dirname(filePath), path.basename(filePath)))
    .digest('hex');
}

export function loadManifest(root: string): Manifest | null {
  const manifestPath = path.join(root, MANIFEST_REL);
  let bytes: Buffer;
  try {
    bytes = readManagedFile(root, MANIFEST_REL);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
  const parsed: unknown = JSON.parse(bytes.toString('utf8'));
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`${manifestPath} is not a JSON object`);
  }
  return parsed as Manifest;
}

/** Package ownership comes from the canonical catalog, not native file presence. */
export function definitionRuleIds(): Set<string> {
  return new Set(rules.map((rule) => rule.id));
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
 * `definitionIds` is injected for tests; defaults to the package catalog when omitted.
 */
export function verifyLockstep(
  root: string,
  manifest: Manifest,
  trackedFiles: string[],
  definitionIds?: Set<string>,
): string[] {
  const problems: string[] = [];
  const defIds = definitionIds ?? definitionRuleIds();
  const contentRulesRel = contentRulesRelative(root);

  if (manifest.mode !== 'copy' || typeof manifest.files !== 'object' || manifest.files === null) {
    return [`${MANIFEST_REL} is malformed (expected mode "copy" with a files map)`];
  }

  const manifestRels = new Set<string>();

  for (const [rel, entry] of Object.entries(manifest.files)) {
    const fileRel = path.posix.join('.claude', rel);
    manifestRels.add(fileRel);
    let bytes: Buffer;
    try {
      bytes = readManagedFile(root, fileRel);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        problems.push(`${fileRel} - missing on disk (manifest source: ${entry.source})`);
      } else {
        problems.push(
          `${fileRel} - unsafe file or still a symlink; re-materialize with link.sh --mode copy`,
        );
      }
      continue;
    }
    const fileHash = createHash('sha256').update(bytes).digest('hex');

    if (fileRel === '.claude/rules/00-revealui-manager.md') {
      try {
        const canonical = readManagedFile(root, '.revealui/adapters/claude-code.md');
        const body = claudeManagerStubText(root);
        if (
          entry.source !== 'harnesses:adapters/claude-code.md' ||
          entry.sha256 !== fileHash ||
          bytes.toString('utf8') !== body ||
          canonical.toString('utf8') !== body
        ) {
          problems.push(
            `${fileRel} - stale or incorrect manager pointer ownership — run: ${MATERIALIZE_CMD}`,
          );
        }
      } catch {
        problems.push(
          `${fileRel} - missing or unsafe canonical manager pointer — run: ${MATERIALIZE_CMD}`,
        );
      }
      continue;
    }

    // Definition-owned rules: lock to content, not the revcon profile hash.
    if (isDefinitionClaudeRule(fileRel, defIds)) {
      if (entry.source !== `harnesses:${rel}` || fileHash !== entry.sha256) {
        problems.push(
          `${fileRel} - stale or incorrect harness ownership — run: ${MATERIALIZE_CMD}`,
        );
      }
      const id = path.posix.basename(fileRel, '.md');
      try {
        const twin = readManagedFile(root, `${contentRulesRel}/${id}.md`);
        if (fileHash !== createHash('sha256').update(twin).digest('hex')) {
          problems.push(
            `${fileRel} - dual drift vs ${contentRulesRel}/${id}.md (GAP-421 phase 2). Run: ${MATERIALIZE_CMD}`,
          );
        }
      } catch {
        problems.push(
          `${fileRel} - definition rule missing content twin or unsafe path ${contentRulesRel}/${id}.md — run: ${MATERIALIZE_CMD}`,
        );
      }
      continue;
    }

    if (entry.source.startsWith('harnesses:')) {
      problems.push(
        `${fileRel} - unknown harness-owned rule; use the canonical definition catalog`,
      );
      continue;
    }

    const have = fileHash;
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
    if (!manifestRels.has(tracked)) {
      problems.push(`${tracked} - missing harness ownership entry — run: ${MATERIALIZE_CMD}`);
    }
    const id = path.posix.basename(tracked, '.md');
    try {
      const native = readManagedFile(root, tracked);
      const twin = readManagedFile(root, `${contentRulesRel}/${id}.md`);
      if (!native.equals(twin)) {
        problems.push(
          `${tracked} - dual drift vs ${contentRulesRel}/${id}.md — run: ${MATERIALIZE_CMD}`,
        );
      }
    } catch {
      problems.push(
        `${tracked} - definition rule missing content twin or unsafe path — run: ${MATERIALIZE_CMD}`,
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
  const defIds = definitionRuleIds();
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
