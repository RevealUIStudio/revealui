/**
 * Messaging Coverage Tracker
 *
 * Computes the ratio of typed-error throws to raw `throw new Error(...)`
 * across production source files, persists the result to a committed
 * snapshot, and fails when coverage regresses by more than a small
 * tolerance.
 *
 * "Typed" means the thrown class name isn't the bare `Error` — custom
 * error classes (`ValidationError`, `AccessError`, `StripeError`, etc.)
 * carry a display-ready message and usually a discriminant code, so
 * they are what the plan calls a "user-friendly message." Raw
 * `throw new Error('...')` leaks an implementation detail to the
 * user with no contract.
 *
 * Usage:
 *   pnpm validate:messaging          # check coverage vs snapshot
 *   pnpm validate:messaging --json
 *   UPDATE=1 pnpm validate:messaging # rebaseline the snapshot
 *
 * Exit codes:
 *   0 = coverage ≥ snapshot − tolerance
 *   1 = coverage regressed (or UPDATE=1 wrote a new baseline — still 0)
 *
 * Scope:
 * - Scans each workspace's src/ under packages/ and apps/ (.ts / .tsx).
 * - Skips test files (*.test, *.spec, __tests__/, *.example, *.e2e).
 * - Skips node_modules, dist, build, .turbo.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SNAPSHOT_PATH = path.join(ROOT, 'docs/reference/messaging-coverage.snapshot.json');
const TOLERANCE_PCT = 0.5; // regression tolerance (in percentage points)

const SOURCE_ROOTS = ['packages', 'apps'];
const EXCLUDE_DIRS = new Set(['node_modules', 'dist', 'build', '.turbo', '__tests__', 'examples']);
const EXCLUDE_FILE_PATTERNS = [
  /\.test\.(ts|tsx|js|jsx)$/,
  /\.spec\.(ts|tsx|js|jsx)$/,
  /\.example\.(ts|tsx|js|jsx)$/,
  /\.e2e\.(ts|tsx|js|jsx)$/,
];

const RAW_THROW = /\bthrow\s+new\s+Error\s*\(/g;
const TYPED_THROW = /\bthrow\s+new\s+([A-Z][A-Za-z0-9_]*Error)\s*\(/g;

interface CoverageResult {
  totalThrows: number;
  rawThrows: number;
  typedThrows: number;
  coveragePercent: number;
  topRawThrowFiles: Array<{ file: string; count: number }>;
  typedClassHistogram: Array<{ name: string; count: number }>;
}

function shouldIncludeFile(abs: string): boolean {
  if (!(abs.endsWith('.ts') || abs.endsWith('.tsx'))) return false;
  const base = path.basename(abs);
  for (const pat of EXCLUDE_FILE_PATTERNS) {
    if (pat.test(base)) return false;
  }
  return true;
}

function walk(dir: string, acc: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), acc);
    } else if (entry.isFile()) {
      const full = path.join(dir, entry.name);
      if (shouldIncludeFile(full)) acc.push(full);
    }
  }
}

function collectFiles(): string[] {
  const out: string[] = [];
  for (const rootName of SOURCE_ROOTS) {
    const rootDir = path.join(ROOT, rootName);
    if (!fs.existsSync(rootDir)) continue;
    for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      // Only scan each workspace's src/ — never its dist/ or test dirs.
      const src = path.join(rootDir, entry.name, 'src');
      if (fs.existsSync(src)) walk(src, out);
    }
  }
  return out;
}

export function computeCoverage(files: string[]): CoverageResult {
  const rawPerFile = new Map<string, number>();
  const typedClassCounts = new Map<string, number>();
  let totalRaw = 0;
  let totalTyped = 0;

  for (const file of files) {
    let content: string;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    // Count typed first — matches `throw new FooError(` and advances the
    // index past the match, so the raw regex won't double-count.
    let typedInFile = 0;
    TYPED_THROW.lastIndex = 0;
    for (const m of content.matchAll(TYPED_THROW)) {
      const name = m[1] ?? 'UnknownError';
      typedClassCounts.set(name, (typedClassCounts.get(name) ?? 0) + 1);
      typedInFile++;
    }

    let rawInFile = 0;
    RAW_THROW.lastIndex = 0;
    for (const _ of content.matchAll(RAW_THROW)) {
      rawInFile++;
    }

    totalRaw += rawInFile;
    totalTyped += typedInFile;
    if (rawInFile > 0) rawPerFile.set(file, rawInFile);
  }

  const totalThrows = totalRaw + totalTyped;
  const coveragePercent = totalThrows === 0 ? 100 : (totalTyped / totalThrows) * 100;

  const topRawThrowFiles = [...rawPerFile.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([file, count]) => ({ file: path.relative(ROOT, file), count }));

  const typedClassHistogram = [...typedClassCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, count]) => ({ name, count }));

  return {
    totalThrows,
    rawThrows: totalRaw,
    typedThrows: totalTyped,
    coveragePercent: Math.round(coveragePercent * 100) / 100,
    topRawThrowFiles,
    typedClassHistogram,
  };
}

function readSnapshot(): CoverageResult | null {
  if (!fs.existsSync(SNAPSHOT_PATH)) return null;
  return JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8')) as CoverageResult;
}

function writeSnapshot(result: CoverageResult): void {
  fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
  fs.writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}

function main(): void {
  const jsonOutput = process.argv.includes('--json');
  const files = collectFiles();
  const actual = computeCoverage(files);

  if (process.env.UPDATE === '1') {
    writeSnapshot(actual);
    console.log(`✓ Wrote snapshot: ${path.relative(ROOT, SNAPSHOT_PATH)}`);
    console.log(
      `  ${actual.typedThrows}/${actual.totalThrows} typed throws (${actual.coveragePercent}%)`,
    );
    return;
  }

  if (jsonOutput) {
    console.log(JSON.stringify(actual, null, 2));
    return;
  }

  const expected = readSnapshot();
  const scanned = files.length;
  console.log(`· Scanned ${scanned} source file(s)`);
  console.log(
    `· Messaging coverage: ${actual.typedThrows}/${actual.totalThrows} typed (${actual.coveragePercent}%)`,
  );

  if (!expected) {
    console.error('✗ Snapshot missing. Run `UPDATE=1 pnpm validate:messaging` to create it.');
    process.exit(1);
  }

  const delta = actual.coveragePercent - expected.coveragePercent;
  const deltaStr = `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}pp`;
  console.log(`· Baseline: ${expected.coveragePercent}%  (delta: ${deltaStr})`);

  if (delta < -TOLERANCE_PCT) {
    console.error(
      `✗ Messaging coverage regressed by ${(-delta).toFixed(2)}pp (tolerance ${TOLERANCE_PCT}pp).`,
    );
    console.error('  Top files with raw `throw new Error(...)`:');
    for (const f of actual.topRawThrowFiles.slice(0, 8)) {
      console.error(`    ${f.file} — ${f.count}`);
    }
    console.error('');
    console.error('  Fix options:');
    console.error('    (a) replace raw throws with a typed error class (preferred), or');
    console.error(
      '    (b) justify the regression and rebaseline with `UPDATE=1 pnpm validate:messaging`',
    );
    process.exit(1);
  }

  if (delta > TOLERANCE_PCT) {
    console.log('✓ Messaging coverage improved — consider rebaselining the snapshot:');
    console.log('  UPDATE=1 pnpm validate:messaging');
  } else {
    console.log('✓ Messaging coverage within tolerance');
  }
}

// Only run when invoked directly (not when imported by tests).
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const selfPath = path.resolve(import.meta.dirname, 'messaging-coverage.ts');
if (invokedPath === selfPath) {
  main();
}
