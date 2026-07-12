#!/usr/bin/env tsx
// console-allowed

/**
 * `as never` on a drizzle `.values()` call — CI validator.
 *
 * RevealUI audit-remediation Stage 0 finding: two audit-log writers
 * (apps/admin/src/app/api/setup/route.ts, scripts/admin/bootstrap.ts) insert
 * columns that do not exist on the `audit_log` table (`event`/`actor`/`meta`
 * instead of the real `event_type`/`agent_id`/`payload`), silenced with
 * `as never` on the `.values()` argument. Both writers have NEVER succeeded
 * in any environment — `as never` is exactly the mechanism that let a
 * permanently-broken insert pass typecheck, CI, and code review.
 *
 * This validator makes that specific pattern un-mergeable going forward:
 * `as never` used to cast the argument of any `.values(...)` call (the
 * drizzle insert/update payload shape). Uses the TypeScript compiler API
 * (mirrors `scripts/validate/doc-currency.ts`'s `extractStringLiterals` —
 * `ts.createSourceFile` + `ts.forEachChild`) rather than authored regex, per
 * the fleet's no-regex rule.
 *
 * This is a syntactic check (no type-checker/Program construction), so it
 * cannot confirm the receiver is actually a drizzle query builder rather
 * than some unrelated `.values(...)` method — the same trade-off
 * doc-currency.ts's literal-extraction walk already accepts for its own
 * scan. In practice `.values(` called WITH an argument is a drizzle-only
 * shape in this codebase (Map/Set/FormData/URLSearchParams `.values()` take
 * no arguments; `Object.values(x)` takes an argument but casting it
 * `as never` would be equally suspicious).
 *
 * Pre-existing violations are enumerated in as-never-values-allowlist.json
 * with reasons (mirrors raw-sql.ts / empty-catch.ts); new violations fail
 * CI unless explicitly allowlisted.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

function out(line: string): void {
  process.stdout.write(`${line}\n`);
}

// =============================================================================
// Constants
// =============================================================================

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');

const ALLOWLIST_PATH = join(REPO_ROOT, 'scripts/validate/as-never-values-allowlist.json');

const SCAN_ROOTS = ['apps', 'packages', 'scripts'];

const SOURCE_EXTS = new Set(['.ts', '.tsx', '.mts', '.cts']);

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

// Test files routinely cast mock clients `as never` for reasons unrelated to
// this rule (see e.g. apps/server/src/lib/__tests__/downgrade-cap.test.ts —
// `db as never` casts a mock DB CLIENT, not a `.values()` payload). Excluded
// the same way empty-catch.ts excludes test files from its scan.
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
  'scripts/validate/',
  '/generated/',
];

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
        `as-never-values-allowlist.json: entry "${entry.path}${entry.line ? `:${entry.line}` : ''}" is missing a non-empty reason.`,
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
  for (const entry of entries) {
    if (entry.line === undefined) return true;
    if (entry.line === line) return true;
  }
  return false;
}

// =============================================================================
// File collection
// =============================================================================

interface FoundFile {
  abs: string;
  rel: string;
}

function collectFiles(dir: string, acc: FoundFile[] = []): FoundFile[] {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      collectFiles(abs, acc);
      continue;
    }
    if (!SOURCE_EXTS.has(extname(entry.name))) continue;
    acc.push({ abs, rel: relative(REPO_ROOT, abs).split('\\').join('/') });
  }
  return acc;
}

function includesAnyPathSegment(path: string, segments: readonly string[]): boolean {
  return segments.some((seg) => path.includes(seg));
}

// =============================================================================
// AST rule
// =============================================================================

export interface AsNeverValuesHit {
  line: number;
}

/**
 * Walk a source file's AST for `<expr>.values(...)` calls whose argument
 * (or an element of an array-literal argument) is `as never`.
 */
export function findAsNeverValuesCalls(sourceText: string, fileName: string): AsNeverValuesHit[] {
  const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
  const hits: AsNeverValuesHit[] = [];

  function isAsNever(node: ts.Node): boolean {
    return ts.isAsExpression(node) && node.type.kind === ts.SyntaxKind.NeverKeyword;
  }

  function argHasAsNever(arg: ts.Expression): boolean {
    if (isAsNever(arg)) return true;
    if (ts.isArrayLiteralExpression(arg)) {
      return arg.elements.some((el) => isAsNever(el));
    }
    return false;
  }

  function visit(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'values' &&
      node.arguments.some(argHasAsNever)
    ) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      hits.push({ line: line + 1 });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return hits;
}

// =============================================================================
// Main
// =============================================================================

const Sep = '='.repeat(72);

function main(): void {
  out(Sep);
  out('`as never` on drizzle .values() — CI validator');
  out(Sep);

  const allow = loadAllowlist();
  out(`Allowlist entries: ${[...allow.byPath.values()].reduce((n, v) => n + v.length, 0)}`);

  const files: FoundFile[] = [];
  for (const root of SCAN_ROOTS) {
    const abs = join(REPO_ROOT, root);
    if (!existsSync(abs)) continue;
    if (!statSync(abs).isDirectory()) continue;
    collectFiles(abs, files);
  }

  out(`Scanning ${files.length} source files...`);
  out('\n→ as-never-on-values-call');

  const violations: string[] = [];
  for (const file of files) {
    if (includesAnyPathSegment(file.rel, EXCLUDED_PATH_SEGMENTS)) continue;
    const content = readFileSync(file.abs, 'utf8');
    for (const hit of findAsNeverValuesCalls(content, file.abs)) {
      if (isAllowlisted(allow, file.rel, hit.line)) continue;
      violations.push(
        `  ${file.rel}:${hit.line}  \`as never\` on a .values() call — this is the exact ` +
          'mechanism that let a wrong-shaped drizzle insert/update pass typecheck ' +
          'silently. Fix the value shape or add an allowlist entry with a reason.',
      );
    }
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
  out('    1. Fix the value shape so it matches the real column set (preferred).');
  out('    2. Add an entry to scripts/validate/as-never-values-allowlist.json');
  out('       with the file path (and optionally a line number) plus a reason.');
  out(Sep);
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
