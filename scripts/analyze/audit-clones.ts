#!/usr/bin/env tsx
/**
 * Exact clone audit for packages/ (fleet-redundancy Phase 6 prevention).
 *
 * Optional clone detector: content-hash identical files under packages/
 * (excludes dist, generated, lockfiles, binary-ish assets). Near-duplicate
 * detection (classic jscpd token clones) is intentionally out of scope —
 * exact clones are the durable, dependency-free signal that half-sweeps
 * and copy-paste leave behind.
 *
 * Exit codes:
 *   0 — always by default (advisory). Use --fail to exit 1 when any clone group exists.
 *   2 — tool/setup error
 *
 * Usage:
 *   pnpm audit:clones
 *   pnpm audit:clones -- --fail
 *   pnpm audit:clones -- --min-bytes=80
 */

import { createHash } from 'node:crypto';
import { type Dirent, existsSync, readdirSync, readFileSync, type Stats, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO_ROOT = process.cwd();
const PACKAGES_ROOT = join(REPO_ROOT, 'packages');

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.turbo',
  '.git',
  'generated',
  '__snapshots__',
]);

const SKIP_FILE_SUFFIXES = [
  '.map',
  '.min.js',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.pdf',
  '.lock',
];

function parseArgs(argv: string[]): { fail: boolean; minBytes: number } {
  let fail = false;
  let minBytes = 40;
  for (const a of argv) {
    if (a === '--fail') fail = true;
    if (a.startsWith('--min-bytes=')) {
      const n = Number(a.slice('--min-bytes='.length));
      if (Number.isFinite(n) && n >= 0) minBytes = n;
    }
  }
  return { fail, minBytes };
}

function shouldSkipFile(name: string): boolean {
  const lower = name.toLowerCase();
  return SKIP_FILE_SUFFIXES.some((s) => lower.endsWith(s));
}

function walk(dir: string, out: string[]): void {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith('.') && e.name !== '.env.example') {
      // skip hidden dirs/files except explicit examples
      if (e.isDirectory()) continue;
    }
    if (e.isDirectory()) {
      if (SKIP_DIR_NAMES.has(e.name)) continue;
      walk(join(dir, e.name), out);
      continue;
    }
    if (shouldSkipFile(e.name)) continue;
    out.push(join(dir, e.name));
  }
}

function main(): void {
  const { fail, minBytes } = parseArgs(process.argv.slice(2));

  if (!existsSync(PACKAGES_ROOT)) {
    console.error('[audit-clones] packages/ missing');
    process.exit(2);
  }

  const files: string[] = [];
  walk(PACKAGES_ROOT, files);

  const byHash = new Map<string, string[]>();
  let scanned = 0;
  let skippedSmall = 0;

  for (const file of files) {
    let st: Stats;
    try {
      st = statSync(file);
    } catch {
      continue;
    }
    if (!st.isFile() || st.size < minBytes) {
      skippedSmall++;
      continue;
    }
    // Cap read size for pathological huge files
    if (st.size > 2_000_000) continue;

    let buf: Buffer;
    try {
      buf = readFileSync(file);
    } catch {
      continue;
    }
    // Skip likely-binary
    if (buf.includes(0)) continue;

    const hash = createHash('sha256').update(buf).digest('hex');
    const rel = relative(REPO_ROOT, file).replaceAll('\\', '/');
    const list = byHash.get(hash) ?? [];
    list.push(rel);
    byHash.set(hash, list);
    scanned++;
  }

  const groups: string[][] = [];
  for (const paths of byHash.values()) {
    if (paths.length >= 2) {
      groups.push(paths.sort());
    }
  }
  groups.sort((a, b) => {
    const byLen = b.length - a.length;
    if (byLen !== 0) return byLen;
    const a0 = a[0] ?? '';
    const b0 = b[0] ?? '';
    return a0.localeCompare(b0);
  });

  console.log('\n================================================================');
  console.log('  Exact clone audit (packages/) — Phase 6 prevention');
  console.log('================================================================');
  console.log(`  Scanned: ${scanned} files (≥ ${minBytes} bytes)`);
  console.log(`  Skipped small: ${skippedSmall}`);
  console.log(`  Clone groups: ${groups.length}`);

  const maxReport = 25;
  for (const g of groups.slice(0, maxReport)) {
    console.log(`\n  [${g.length}× identical]`);
    for (const p of g) {
      console.log(`    - ${p}`);
    }
  }
  if (groups.length > maxReport) {
    console.log(`\n  … ${groups.length - maxReport} more group(s) omitted`);
  }

  if (groups.length === 0) {
    console.log('\n  ✓ No exact multi-file clones under packages/');
  } else {
    console.log(
      '\n  Advisory: exact clones often mean extend-before-create debt. Prefer shared helpers over copy-paste.',
    );
  }
  console.log('================================================================\n');

  if (fail && groups.length > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main();
