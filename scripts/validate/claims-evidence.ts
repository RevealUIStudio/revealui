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
 * Usage:
 *   tsx scripts/validate/claims-evidence.ts          # exit 1 on violations
 *   tsx scripts/validate/claims-evidence.ts --warn   # warn-only (exit 0)
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  CLAIMS,
  COVERED_FILES,
  NON_COPY_KEYS,
} from '../../apps/marketing/app/content/claims-evidence.js';

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
    node.forEach((item, i) => collectStrings(file, item, `${path}[${i}]`, key, out));
    return;
  }
  if (node !== null && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      collectStrings(file, v, path ? `${path}.${k}` : k, k, out);
    }
  }
}

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
        violations.push(`${claim.file} :: ${claim.exportPath} — evidence path missing: ${ev.ref}`);
      }
    } else if (ev.ref.trim() === '') {
      violations.push(`${claim.file} :: ${claim.exportPath} — empty evidence ref`);
    }
  }
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
