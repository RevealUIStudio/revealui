#!/usr/bin/env tsx

/**
 * Mixed-Changeset Validator
 *
 * Changesets CLI hard-fails with "Found mixed changeset" when a single
 * .changeset/*.md file lists BOTH an ignored package (api, admin, docs,
 * marketing, test, revealcoin, @revealui/scripts, @revealui/dev — per
 * .changeset/config.json `ignore` array) AND a non-ignored package
 * (e.g., @revealui/mcp, @revealui/ai, @revealui/core).
 *
 * That failure happens deep inside the Release Canary workflow, long
 * after the offending PR has merged to `test`. By the time canary
 * fails, every subsequent push is already blocked from publishing,
 * and the fix requires a separate cleanup PR.
 *
 * This validator runs in the `quality` CI job on every PR, before
 * anything merges. It catches the exact same `getRelevantChangesets`
 * rejection pre-merge, with an error message that points the author
 * at the fix.
 *
 * Precedent: commit 19a5c73ff (PR #547, 2026-04-24) cleaned up three
 * mixed changesets (mcp-3-1, mcp-3-2, mcp-a1) that had been shipping
 * broken canary runs for 9 consecutive test pushes. Two more mixed
 * changesets (mcp-a2a, mcp-a2b) landed afterward despite the
 * precedent. The shape of the failure is recurring and worth
 * enforcing at PR time, not discovering at canary time.
 *
 * Exit codes:
 *   0 — all changesets are clean
 *   1 — one or more mixed changesets detected
 *   2 — config/parse error
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..', '..');
const CHANGESET_DIR = join(REPO_ROOT, '.changeset');
const CONFIG_PATH = join(CHANGESET_DIR, 'config.json');

interface ChangesetConfig {
  ignore?: string[];
}

interface MixedFinding {
  file: string;
  ignored: string[];
  nonIgnored: string[];
}

/** Structured stdout/stderr output — scripts/** cannot use the console object. */
function out(line: string): void {
  process.stdout.write(`${line}\n`);
}
function err(line: string): void {
  process.stderr.write(`${line}\n`);
}

function loadIgnoreList(): string[] {
  let raw: string;
  try {
    raw = readFileSync(CONFIG_PATH, 'utf8');
  } catch (e) {
    err(`[mixed-changesets] FATAL: could not read ${CONFIG_PATH}: ${String(e)}`);
    process.exit(2);
  }
  let config: ChangesetConfig;
  try {
    config = JSON.parse(raw) as ChangesetConfig;
  } catch (e) {
    err(`[mixed-changesets] FATAL: could not parse ${CONFIG_PATH}: ${String(e)}`);
    process.exit(2);
  }
  return config.ignore ?? [];
}

/**
 * Parse the YAML frontmatter of a changeset .md file and return the list
 * of package names declared there. Handles both single-quoted and
 * double-quoted package names. Skips files without a frontmatter block.
 */
function extractFrontmatterPackages(content: string): string[] {
  const match = /^---\n([\s\S]*?)\n---/.exec(content);
  if (!match) {
    return [];
  }
  const frontmatter = match[1] ?? '';
  const packages: string[] = [];
  for (const line of frontmatter.split('\n')) {
    // matches: 'pkg': level OR "pkg": level
    const pkgMatch = /^\s*['"]([^'"]+)['"]\s*:\s*\w+/.exec(line);
    if (pkgMatch?.[1]) {
      packages.push(pkgMatch[1]);
    }
  }
  return packages;
}

function scanChangesets(ignoreList: string[]): MixedFinding[] {
  const ignoreSet = new Set(ignoreList);
  let entries: string[];
  try {
    entries = readdirSync(CHANGESET_DIR);
  } catch (e) {
    err(`[mixed-changesets] FATAL: could not read ${CHANGESET_DIR}: ${String(e)}`);
    process.exit(2);
  }

  const findings: MixedFinding[] = [];

  for (const entry of entries) {
    if (!entry.endsWith('.md') || entry === 'README.md') {
      continue;
    }
    const filePath = join(CHANGESET_DIR, entry);
    let content: string;
    try {
      content = readFileSync(filePath, 'utf8');
    } catch (e) {
      err(`[mixed-changesets] WARN: could not read ${filePath}: ${String(e)}`);
      continue;
    }

    const packages = extractFrontmatterPackages(content);
    if (packages.length < 2) {
      // A single-package changeset can't be mixed; a zero-package file
      // is malformed but is a separate concern.
      continue;
    }

    const ignored: string[] = [];
    const nonIgnored: string[] = [];
    for (const pkg of packages) {
      if (ignoreSet.has(pkg)) {
        ignored.push(pkg);
      } else {
        nonIgnored.push(pkg);
      }
    }

    if (ignored.length > 0 && nonIgnored.length > 0) {
      findings.push({ file: entry, ignored, nonIgnored });
    }
  }

  return findings;
}

function main(): void {
  const ignoreList = loadIgnoreList();
  const findings = scanChangesets(ignoreList);

  if (findings.length === 0) {
    out('[mixed-changesets] OK: no mixed ignored+non-ignored changesets found.');
    process.exit(0);
  }

  err('[mixed-changesets] FAIL: the changesets CLI rejects any changeset that');
  err('                      lists BOTH an ignored package and a non-ignored one.');
  err('                      Fix each offender by removing the ignored-package');
  err('                      entries from the frontmatter (keep the body text');
  err('                      describing the wider change — it becomes part of the');
  err('                      non-ignored package’s changelog anyway).');
  err('');
  err(`Ignored packages per .changeset/config.json: ${ignoreList.join(', ')}`);
  err('');
  for (const finding of findings) {
    err(`  .changeset/${finding.file}`);
    err(`    ignored:     ${finding.ignored.join(', ')}`);
    err(`    non-ignored: ${finding.nonIgnored.join(', ')}`);
    err('');
  }
  err(`Found ${findings.length} mixed changeset${findings.length === 1 ? '' : 's'}.`);
  process.exit(1);
}

main();
