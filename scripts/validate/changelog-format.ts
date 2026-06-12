#!/usr/bin/env tsx

/**
 * Changelog Format Validator
 *
 * packages/*\/CHANGELOG.md are machine files owned by changesets, and
 * changesets' apply-release-plan PREPENDS each new version section by
 * replacing the file's FIRST newline. That only composes with the
 * changesets layout — line 1 is the `# <package>` H1 — so a changelog
 * that starts with anything else (most dangerously a `---`
 * docs-frontmatter fence) gets every new version section injected
 * INSIDE the leading block: the 2026-06-12 version run (#1377)
 * corrupted 18 of the 24 package changelogs that the #1293
 * docs-frontmatter sweep had stamped.
 *
 * This validator runs in the `quality` CI job on every PR (same
 * placement as validate:changesets) and hard-fails when any package
 * changelog:
 *   - does not start with a `# ` H1 on line 1 (a leading `---` gets a
 *     dedicated message), or
 *   - carries stranded docs-frontmatter keys (title:/description:/
 *     visibility:/status:/audience:) at column 0 outside fenced code —
 *     the signature of a half-corrupted or re-stamped file.
 *
 * The docs system derives anything it wants to say about a package
 * changelog (e.g. the package name from packages/*\/package.json)
 * instead of embedding frontmatter; see the exception in
 * docs/internal/documentation-system.md and the matching skip in
 * scripts/docs/apply-frontmatter.ts. Release-note extraction
 * (.github/scripts/create-github-releases.cjs) tolerates stray
 * non-changesets lines as section boundaries; with this validator in
 * place that tolerance is belt-and-suspenders, not load-bearing.
 *
 * No authored regex (M2 hardline) — line scans + startsWith only.
 *
 * Exit codes:
 *   0 — all package changelogs are changesets-shaped
 *   1 — one or more violations detected
 *   2 — filesystem error
 */

import type { Dirent } from 'node:fs';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..', '..');
const PACKAGES_DIR = join(REPO_ROOT, 'packages');

/** Docs-frontmatter keys the #1293 sweep stamped; stranded copies mark corruption. */
const FRONTMATTER_KEYS = ['title:', 'description:', 'visibility:', 'status:', 'audience:'];

export interface ChangelogViolation {
  file: string;
  line: number;
  problem: string;
}

interface ScanResult {
  checked: number;
  violations: ChangelogViolation[];
}

/** Structured stdout/stderr output — scripts/** cannot use the console object. */
function out(line: string): void {
  process.stdout.write(`${line}\n`);
}
function err(line: string): void {
  process.stderr.write(`${line}\n`);
}

/**
 * Check one changelog's text against the changesets-owned layout.
 * Exported for unit tests.
 */
export function checkChangelogText(text: string, file: string): ChangelogViolation[] {
  const violations: ChangelogViolation[] = [];
  const lines = text.split('\n');
  const first = lines[0] ?? '';

  if (first.trim() === '---') {
    violations.push({
      file,
      line: 1,
      problem:
        "starts with a frontmatter fence (---). changesets prepends new version sections by replacing the file's first newline, so frontmatter gets release sections injected inside it. Package changelogs must not carry frontmatter — see docs/internal/documentation-system.md.",
    });
  } else if (!first.startsWith('# ')) {
    violations.push({
      file,
      line: 1,
      problem: `must start with the package H1 ("# <package name>"); found ${JSON.stringify(first)}.`,
    });
  }

  let inFence = false;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    for (const key of FRONTMATTER_KEYS) {
      if (line.startsWith(key)) {
        violations.push({
          file,
          line: i + 1,
          problem: `stranded docs-frontmatter key at column 0 (${key} …) — the signature of a frontmatter block split by a changesets prepend.`,
        });
        break;
      }
    }
  }

  return violations;
}

function scanPackages(): ScanResult {
  let entries: Dirent[];
  try {
    entries = readdirSync(PACKAGES_DIR, { withFileTypes: true });
  } catch (e) {
    err(`[changelog-format] FATAL: could not read ${PACKAGES_DIR}: ${String(e)}`);
    process.exit(2);
  }

  const violations: ChangelogViolation[] = [];
  let checked = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const changelogPath = join(PACKAGES_DIR, entry.name, 'CHANGELOG.md');
    // A brand-new package has no changelog until its first changesets release.
    if (!existsSync(changelogPath)) continue;
    let content: string;
    try {
      content = readFileSync(changelogPath, 'utf8');
    } catch (e) {
      err(`[changelog-format] WARN: could not read ${changelogPath}: ${String(e)}`);
      continue;
    }
    checked++;
    violations.push(...checkChangelogText(content, `packages/${entry.name}/CHANGELOG.md`));
  }

  return { checked, violations };
}

function main(): void {
  const { checked, violations } = scanPackages();

  if (violations.length === 0) {
    out(
      `[changelog-format] OK: ${checked} package changelogs are changesets-shaped (no frontmatter).`,
    );
    return;
  }

  err('[changelog-format] FAIL: package CHANGELOG.md files are changesets-owned and must');
  err('                    start with their `# <package>` H1 — never a frontmatter block.');
  err("                    changesets prepends new version sections by replacing the file's");
  err('                    first newline, so anything above the H1 gets release sections');
  err('                    injected into it (this corrupted 18 changelogs on 2026-06-12).');
  err('                    Remove the frontmatter; the docs system derives changelog');
  err('                    metadata instead (docs/internal/documentation-system.md).');
  err('');
  for (const v of violations) {
    err(`  ${v.file}:${v.line}  ${v.problem}`);
  }
  err('');
  err(
    `Found ${violations.length} violation${violations.length === 1 ? '' : 's'} across ${checked} changelogs.`,
  );
  process.exit(1);
}

if (process.argv[1]?.endsWith('changelog-format.ts')) {
  main();
}
