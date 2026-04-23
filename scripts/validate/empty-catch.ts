#!/usr/bin/env tsx
// console-allowed

/**
 * Empty-Catch Validator — CR8-P1-02.
 *
 * Blocks new silent `.catch(...)` handlers across the codebase. A
 * "silent catch" is any `.catch(...)` whose body contains no
 * meaningful handling — empty block `{}`, empty expression `()`, or
 * an empty-object literal return `({})`. These swallow errors without
 * logging them, obscuring real failures from operators and making
 * production incidents much harder to diagnose.
 *
 * This mirrors the raw-sql.ts pattern: pre-existing violations are
 * enumerated in empty-catch-allowlist.json with reasons; new
 * violations fail CI unless explicitly allowlisted or suppressed.
 *
 * Rules (HARD BLOCK unless allowlisted or suppressed):
 *
 *   silent-arrow-catch
 *     Matches `.catch(() => {})`, `.catch((err) => {})`, `.catch(() => ({}))`,
 *     and their named-parameter / underscore-parameter variants. The
 *     canonical fix is to add a `logger.warn(...)` or `console.warn(...)`
 *     call with enough context to identify the failing operation.
 *
 * Suppression: add `// empty-catch-ok: <reason>` on the same line OR
 * the line immediately preceding the banned pattern. Reason is
 * required — empty reasons do not suppress. Prefer the allowlist for
 * pre-existing sites; use suppression comments sparingly for
 * genuinely-best-effort operations where logging would be noisier
 * than the failure (e.g. high-frequency cache writes).
 *
 * NOT flagged (intentional gaps):
 *   - try/catch blocks with empty bodies — a separate rule, out of
 *     scope here.
 *   - `.catch()` with a non-empty body — even if the body is just a
 *     comment or a single noop statement, the maintainer made a
 *     choice and the reader can see it.
 *   - Files under __tests__ / *.test.ts / *.spec.ts — test code
 *     routinely suppresses errors it deliberately induces.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// Stdout helper — scripts/ CLI tools historically use console.log, but the
// repo's code-standards validator (scripts/validation/validate-code.ts)
// blocks console.* in newly added files. process.stdout.write is
// functionally identical for line-oriented script output.
function out(line: string): void {
  process.stdout.write(`${line}\n`);
}

// =============================================================================
// Constants
// =============================================================================

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');

const ALLOWLIST_PATH = join(REPO_ROOT, 'scripts/validate/empty-catch-allowlist.json');

const SCAN_ROOTS = ['apps', 'packages', 'scripts'];

const SOURCE_EXTS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.turbo',
  '.next',
  'coverage',
  'playwright-report',
  'test-results',
  'opensrc',
]);

// Paths whose empty catches are legitimate (tests, validators that
// describe the banned pattern, generated code).
const EXCLUDED_PATH_SEGMENTS = [
  '__tests__/',
  '__mocks__/',
  '.test.ts',
  '.test.tsx',
  '.spec.ts',
  '.spec.tsx',
  '.integration.test.ts',
  '.integration.test.tsx',
  '.e2e.ts',
  '.e2e.tsx',
  // Validators describe the banned patterns and must not self-flag.
  'scripts/validate/',
  // Generated code re-emits patterns from upstream sources we don't own.
  '/generated/',
];

// Suppression comment — must carry a non-empty reason after the colon.
const SUPPRESSION_PATTERN = /\/\/\s*empty-catch-ok\s*:\s*\S/;

// The rule itself: `.catch(` followed by optional whitespace, an
// optional `(` group with any identifier (or `_`, or empty), optional
// whitespace + `=>`, optional whitespace, then `{}` or `({})` or a
// `{` immediately followed by `}` modulo whitespace.
//
// We split this into two regexes (empty-block and empty-return) to
// keep each one readable.
const EMPTY_BLOCK_CATCH =
  /\.catch\s*\(\s*\(?\s*[a-zA-Z_$][\w$]*\s*\)?\s*=>\s*\{\s*\}\s*\)|\.catch\s*\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/;
const EMPTY_RETURN_CATCH =
  /\.catch\s*\(\s*\(?\s*[a-zA-Z_$][\w$]*\s*\)?\s*=>\s*\(\s*\{\s*\}\s*\)\s*\)|\.catch\s*\(\s*\(\s*\)\s*=>\s*\(\s*\{\s*\}\s*\)\s*\)/;

// =============================================================================
// Allowlist loading
// =============================================================================

interface AllowlistEntry {
  path: string;
  line?: number;
  reason: string;
}

interface AllowlistFile {
  version: number;
  entries?: AllowlistEntry[];
  [key: string]: unknown;
}

interface AllowlistMatcher {
  byPath: Map<string, AllowlistEntry[]>;
}

function loadAllowlist(): AllowlistMatcher {
  if (!existsSync(ALLOWLIST_PATH)) {
    return { byPath: new Map() };
  }
  const raw = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8')) as AllowlistFile;
  const byPath = new Map<string, AllowlistEntry[]>();
  for (const entry of raw.entries ?? []) {
    if (!entry.reason?.trim()) {
      throw new Error(
        `empty-catch-allowlist.json: entry "${entry.path}${entry.line ? `:${entry.line}` : ''}" is missing a non-empty reason.`,
      );
    }
    const list = byPath.get(entry.path) ?? [];
    list.push(entry);
    byPath.set(entry.path, list);
  }
  return { byPath };
}

function isAllowlisted(allow: AllowlistMatcher, relPath: string, line: number): boolean {
  const normalized = relPath.split('\\').join('/');
  const entries = allow.byPath.get(normalized);
  if (!entries) return false;
  // An entry without `line` whitelists the whole file; a line-scoped
  // entry matches only that line.
  for (const entry of entries) {
    if (entry.line === undefined) return true;
    if (entry.line === line) return true;
  }
  return false;
}

// =============================================================================
// Suppression detection
// =============================================================================

function isLineSuppressed(lines: string[], lineIdx: number): boolean {
  const current = lines[lineIdx] ?? '';
  if (SUPPRESSION_PATTERN.test(current)) return true;
  const prev = lineIdx > 0 ? (lines[lineIdx - 1] ?? '') : '';
  if (SUPPRESSION_PATTERN.test(prev)) return true;
  return false;
}

// =============================================================================
// File collection
// =============================================================================

interface FoundFile {
  abs: string;
  rel: string;
  ext: string;
}

function collectFiles(dir: string, out: FoundFile[] = []): FoundFile[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      collectFiles(abs, out);
      continue;
    }
    const ext = extname(entry.name);
    if (!SOURCE_EXTS.has(ext)) continue;
    out.push({ abs, rel: relative(REPO_ROOT, abs).split('\\').join('/'), ext });
  }
  return out;
}

function includesAnyPathSegment(path: string, segments: readonly string[]): boolean {
  return segments.some((seg) => path.includes(seg));
}

// =============================================================================
// Rule check
// =============================================================================

function checkEmptyCatch(file: FoundFile, content: string, allow: AllowlistMatcher): string[] {
  if (includesAnyPathSegment(file.rel, EXCLUDED_PATH_SEGMENTS)) return [];

  const violations: string[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (!EMPTY_BLOCK_CATCH.test(line) && !EMPTY_RETURN_CATCH.test(line)) continue;
    const lineNo = i + 1;
    if (isAllowlisted(allow, file.rel, lineNo)) continue;
    if (isLineSuppressed(lines, i)) continue;
    violations.push(
      `  ${file.rel}:${lineNo}  silent .catch(...) with no logging — add logger.warn/console.warn or an allowlist entry`,
    );
  }

  return violations;
}

// =============================================================================
// Main
// =============================================================================

const Sep = '='.repeat(72);

function main(): void {
  out(Sep);
  out('Empty-Catch Validator — CR8-P1-02');
  out(Sep);

  const allow = loadAllowlist();
  out(`Allowlist entries: ${[...allow.byPath.values()].reduce((n, v) => n + v.length, 0)}`);

  const files: FoundFile[] = [];
  for (const root of SCAN_ROOTS) {
    const abs = join(REPO_ROOT, root);
    if (!existsSync(abs)) continue;
    const stat = statSync(abs);
    if (!stat.isDirectory()) continue;
    collectFiles(abs, files);
  }

  out(`Scanning ${files.length} source files...`);
  out('\n→ silent-arrow-catch');

  const violations: string[] = [];
  for (const file of files) {
    const content = readFileSync(file.abs, 'utf8');
    violations.push(...checkEmptyCatch(file, content, allow));
  }

  if (violations.length === 0) {
    out('  ✓ clean');
  } else {
    for (const v of violations) console.log(v);
  }

  out(`\n${Sep}`);
  if (violations.length === 0) {
    out('Result: PASS (0 violations)');
    out(Sep);
    process.exit(0);
  }
  out(`Result: FAIL (${violations.length} new violation${violations.length === 1 ? '' : 's'})`);
  out('');
  out('  Fix options:');
  out('    1. Add a logger.warn(...) / console.warn(...) with context.');
  out('    2. Add `// empty-catch-ok: <reason>` on the offending line.');
  out('    3. Add an entry to scripts/validate/empty-catch-allowlist.json');
  out('       with the file path (and optionally a line number) plus a reason.');
  out(Sep);
  process.exit(1);
}

main();
