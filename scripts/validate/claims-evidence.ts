#!/usr/bin/env tsx
/**
 * Claims-evidence gate — every prose sentence in the covered marketing
 * content files must carry an entry in claims-evidence.ts citing the code
 * that proves it (owner directive 2026-07-12; spec in the coordination hub:
 * lanes/frontend-excellence/messaging-rewrite-2026-07-12.md).
 *
 * Complements claim-drift.ts: that gate pins the NUMBERS marketing quotes;
 * this one pins the SENTENCES. Checks, in both directions:
 *   1. coverage — every qualifying string in a covered content module has an
 *      index entry (exact text match, or a `match: 'path'` entry for
 *      interpolated template literals);
 *   2. staleness — every index entry still matches the copy it indexes;
 *   3. evidence — every `code`/`metric` evidence ref resolves to a real
 *      repo path.
 *
 * A string qualifies as prose when its field name is not in NON_COPY_KEYS,
 * it is longer than 25 characters, contains a space, and is not a URL or
 * route. Zero authored regex (fleet no-regex rule): substring predicates and
 * Set lookups only.
 *
 * Two more checks back the public /claims page (frontend-excellence Phase 5):
 *   4. route map — every covered file has an entry in claims-routes.ts, so
 *      /claims always has a page to group its claims under;
 *   5. redaction rail — every `code` evidence ref resolves to a path
 *      TRACKED in the repo's git index, not merely present on the local
 *      filesystem. `existsSync` (check 3, above) passes for gitignored or
 *      unstaged local-only paths too; those would 404 on the public GitHub
 *      deep link this page renders for `code` refs.
 *
 * Usage:
 *   tsx scripts/validate/claims-evidence.ts          # exit 1 on violations
 *   tsx scripts/validate/claims-evidence.ts --warn   # warn-only (exit 0)
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  CLAIMS,
  type ClaimEntry,
  COVERED_FILES,
  type CoveredFile,
  NON_COPY_KEYS,
} from '../../apps/marketing/app/content/claims-evidence.js';
import { CONTENT_FILE_ROUTES } from '../../apps/marketing/app/content/claims-routes.js';

const warnOnly = process.argv.includes('--warn');
const repoRoot = join(import.meta.dirname, '..', '..');
const contentDir = join(repoRoot, 'apps', 'marketing', 'app', 'content');

const nonCopyKeys = new Set<string>(NON_COPY_KEYS);
const MIN_PROSE_LENGTH = 26;

interface CollectedString {
  readonly file: string;
  readonly path: string;
  readonly value: string;
}

function isProse(key: string, value: string): boolean {
  if (nonCopyKeys.has(key)) return false;
  if (value.length < MIN_PROSE_LENGTH) return false;
  if (!value.includes(' ')) return false;
  if (value.startsWith('http') || value.startsWith('/')) return false;
  return true;
}

function collectStrings(
  file: string,
  node: unknown,
  path: string,
  key: string,
  out: CollectedString[],
): void {
  if (typeof node === 'string') {
    if (isProse(key, node)) out.push({ file, path, value: node });
    return;
  }
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      collectStrings(file, node[i], `${path}[${i}]`, key, out);
    }
    return;
  }
  if (node !== null && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      collectStrings(file, v, path ? `${path}.${k}` : k, k, out);
    }
  }
}

/** Covered files with no entry in the file→route map. Pure; exported for tests. */
export function findMissingRouteEntries(
  covered: readonly CoveredFile[],
  routes: Readonly<Record<string, unknown>>,
): string[] {
  const missing: string[] = [];
  for (const c of covered) {
    if (!(c.file in routes)) missing.push(c.file);
  }
  return missing;
}

/** Every path (or `-z`-terminated NUL-separated line) `git ls-files` reports for `repoRoot`. */
export function loadTrackedFiles(repoRootPath: string): Set<string> {
  const raw = execFileSync('git', ['ls-files', '-z'], {
    cwd: repoRootPath,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return new Set(raw.split('\0').filter((f) => f.length > 0));
}

/**
 * True when `ref` is itself a tracked file, or (directory-shaped ref) at
 * least one tracked file lives under it. Pure; exported for tests.
 */
export function isTrackedPath(tracked: ReadonlySet<string>, ref: string): boolean {
  const clean = ref.endsWith('/') ? ref.slice(0, -1) : ref;
  if (tracked.has(clean)) return true;
  const prefix = `${clean}/`;
  for (const file of tracked) {
    if (file.startsWith(prefix)) return true;
  }
  return false;
}

export interface UntrackedCodeEvidence {
  readonly file: string;
  readonly exportPath: string;
  readonly ref: string;
}

/** `code`-kind evidence refs across `claims` not tracked in `tracked`. Pure; exported for tests. */
export function findUntrackedCodeEvidence(
  claims: readonly ClaimEntry[],
  tracked: ReadonlySet<string>,
): UntrackedCodeEvidence[] {
  const uniqueRefs = new Set<string>();
  for (const claim of claims) {
    for (const ev of claim.evidence) {
      if (ev.kind === 'code') uniqueRefs.add(ev.ref);
    }
  }
  const untrackedRefs = new Set<string>();
  for (const ref of uniqueRefs) {
    if (!isTrackedPath(tracked, ref)) untrackedRefs.add(ref);
  }
  if (untrackedRefs.size === 0) return [];

  const results: UntrackedCodeEvidence[] = [];
  for (const claim of claims) {
    for (const ev of claim.evidence) {
      if (ev.kind === 'code' && untrackedRefs.has(ev.ref)) {
        results.push({ file: claim.file, exportPath: claim.exportPath, ref: ev.ref });
      }
    }
  }
  return results;
}

async function run(): Promise<void> {
  const violations: string[] = [];

  for (const covered of COVERED_FILES) {
    const modulePath = join(contentDir, covered.file);
    if (!existsSync(modulePath)) {
      violations.push(`covered file missing: apps/marketing/app/content/${covered.file}`);
      continue;
    }
    const mod = (await import(modulePath)) as Record<string, unknown>;

    const collected: CollectedString[] = [];
    for (const [exportName, value] of Object.entries(mod)) {
      if (covered.exportPrefix && !exportName.startsWith(covered.exportPrefix)) continue;
      collectStrings(covered.file, value, exportName, exportName, collected);
    }

    const fileClaims = CLAIMS.filter((c) => c.file === covered.file);
    const textEntries = new Set(
      fileClaims.filter((c) => (c.match ?? 'text') === 'text').map((c) => c.text),
    );
    const pathEntries = new Set(
      fileClaims.filter((c) => c.match === 'path').map((c) => c.exportPath),
    );

    // 1. Coverage: every collected prose string is indexed.
    for (const s of collected) {
      if (textEntries.has(s.value)) continue;
      if (pathEntries.has(s.path)) continue;
      violations.push(
        `${covered.file} :: ${s.path} — prose with no claims-evidence entry: "${s.value.slice(0, 80)}"`,
      );
    }

    // 2. Staleness: every index entry still matches the module.
    const collectedValues = new Set(collected.map((s) => s.value));
    const collectedPaths = new Set(collected.map((s) => s.path));
    for (const claim of fileClaims) {
      if (claim.match === 'path') {
        if (!collectedPaths.has(claim.exportPath)) {
          violations.push(
            `${covered.file} :: ${claim.exportPath} — path-matched entry resolves to no prose string (copy moved or field renamed)`,
          );
        }
        continue;
      }
      if (!collectedValues.has(claim.text)) {
        violations.push(
          `${covered.file} :: ${claim.exportPath} — entry text no longer matches the copy: "${claim.text.slice(0, 80)}"`,
        );
      }
    }
  }

  // 3. Evidence: cited repo paths exist.
  for (const claim of CLAIMS) {
    for (const ev of claim.evidence) {
      if (ev.kind === 'code' || ev.kind === 'metric') {
        if (!existsSync(join(repoRoot, ev.ref))) {
          violations.push(
            `${claim.file} :: ${claim.exportPath} — evidence path missing: ${ev.ref}`,
          );
        }
      } else if (ev.ref.trim() === '') {
        violations.push(`${claim.file} :: ${claim.exportPath} — empty evidence ref`);
      }
    }
  }

  // 4. Route map: every covered file must resolve to a public route so
  // /claims always has a page to group its section under.
  for (const file of findMissingRouteEntries(COVERED_FILES, CONTENT_FILE_ROUTES)) {
    violations.push(
      `${file} — no entry in claims-routes.ts CONTENT_FILE_ROUTES (add one so /claims can group its claims by page)`,
    );
  }

  // 5. Redaction rail: every `code` evidence ref must resolve to a path
  // tracked in the repo's git index, not merely present on the local
  // filesystem (see the file-header comment for why `existsSync` is not
  // enough on its own).
  const trackedFiles = loadTrackedFiles(repoRoot);
  for (const untracked of findUntrackedCodeEvidence(CLAIMS, trackedFiles)) {
    violations.push(
      `${untracked.file} :: ${untracked.exportPath} — code evidence path is not tracked in the repo (would 404 on GitHub): ${untracked.ref}`,
    );
  }

  const coveredCount = CLAIMS.length;
  if (violations.length === 0) {
    console.log(
      `claims-evidence: ${coveredCount} indexed claims across ${COVERED_FILES.length} covered files, all matched, all evidence paths present.`,
    );
    process.exit(0);
  }

  console.error(`claims-evidence: ${violations.length} violation(s):`);
  for (const v of violations) {
    console.error(`  ✗ ${v}`);
  }
  console.error(
    '\nFix: index the sentence in apps/marketing/app/content/claims-evidence.ts with the code that proves it, update the stale entry, or restore the cited path. Copy with no proof does not ship.',
  );
  process.exit(warnOnly ? 0 : 1);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
const selfPath = resolve(import.meta.dirname, 'claims-evidence.ts');
if (invokedPath === selfPath) {
  void run();
}
