#!/usr/bin/env tsx
// console-allowed

/**
 * `audit_log` ONE DOOR — CI validator (GAP-355 Stage 2).
 *
 * The audit-receipt architecture (docs/decisions/2026-07-12-audit-receipt-architecture.md
 * §5) requires exactly ONE code path that writes `audit_log`, so that every
 * later integrity property (append-only enforcement, per-row signing, anchoring)
 * has a single chokepoint to attach to. Without a mechanical enforcer, "door
 * number seven reappears within a quarter" — which is exactly the state Stage 2
 * collapsed: seven writers, one signer, an unclosable chain.
 *
 * This validator fails CI on any `.insert(auditLog)` / `.insert(schema.auditLog)`
 * call outside the single door (`packages/db/src/audit-store.ts`,
 * `DrizzleAuditStore`). Every other writer routes through `DrizzleAuditStore.append`
 * / `.appendBatch`.
 *
 * Uses the TypeScript compiler API (`ts.createSourceFile` + `ts.forEachChild`),
 * mirroring scripts/validate/as-never-values.ts, rather than authored regex, per
 * the fleet's no-regex rule. This is a SYNTACTIC check with no type-checker: it
 * matches `.insert(` whose FIRST argument is the identifier `auditLog` (or a
 * property access ending in `.auditLog`). In this codebase the drizzle `auditLog`
 * table symbol is the only thing ever passed as `insert(auditLog)`, so the
 * syntactic match is exact in practice; a false match on an unrelated
 * `.insert(auditLog)` would still be a genuine reason to route through the store.
 *
 * Pre-existing exceptions (there should be none after Stage 2) are enumerated in
 * audit-log-single-door-allowlist.json with reasons (mirrors as-never-values.ts /
 * raw-sql.ts); new violations fail CI unless explicitly allowlisted.
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

const ALLOWLIST_PATH = join(REPO_ROOT, 'scripts/validate/audit-log-single-door-allowlist.json');

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

/**
 * The ONE DOOR. `insert(auditLog)` is permitted ONLY here. This is the built-in
 * allowance; the JSON allowlist is for documented, temporary exceptions only.
 */
const ALLOWED_DOOR_FILES = new Set(['packages/db/src/audit-store.ts']);

/**
 * Test files exercise the door directly (PGlite integration tests seed rows via
 * a raw insert to assert the store's own contract). They are not runtime writers
 * and are excluded, matching as-never-values.ts's test exclusion.
 */
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
        `audit-log-single-door-allowlist.json: entry "${entry.path}${entry.line ? `:${entry.line}` : ''}" is missing a non-empty reason.`,
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

export interface InsertAuditLogHit {
  line: number;
}

/**
 * Walk a source file's AST for `<expr>.insert(auditLog)` /
 * `<expr>.insert(schema.auditLog)` calls — the drizzle insert whose target
 * table is the `audit_log` table symbol.
 *
 * Matches a CallExpression whose callee is a `.insert` property access and whose
 * FIRST argument is either the identifier `auditLog` or a property access ending
 * in `.auditLog`. Syntactic only (no type-checker), the same trade-off
 * as-never-values.ts accepts.
 */
export function findInsertAuditLogCalls(sourceText: string, fileName: string): InsertAuditLogHit[] {
  const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
  const hits: InsertAuditLogHit[] = [];

  function isAuditLogArg(arg: ts.Expression): boolean {
    if (ts.isIdentifier(arg)) return arg.text === 'auditLog';
    if (ts.isPropertyAccessExpression(arg)) return arg.name.text === 'auditLog';
    return false;
  }

  function visit(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'insert' &&
      node.arguments.length > 0 &&
      isAuditLogArg(node.arguments[0])
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
  out('`audit_log` ONE DOOR — CI validator (GAP-355 Stage 2)');
  out(Sep);

  const allow = loadAllowlist();
  out(`Allowlist entries: ${[...allow.byPath.values()].reduce((n, v) => n + v.length, 0)}`);
  out(`Allowed door(s): ${[...ALLOWED_DOOR_FILES].join(', ')}`);

  const files: FoundFile[] = [];
  for (const root of SCAN_ROOTS) {
    const abs = join(REPO_ROOT, root);
    if (!existsSync(abs)) continue;
    if (!statSync(abs).isDirectory()) continue;
    collectFiles(abs, files);
  }

  out(`Scanning ${files.length} source files...`);
  out('\n→ insert(auditLog)-outside-the-door');

  const violations: string[] = [];
  for (const file of files) {
    if (ALLOWED_DOOR_FILES.has(file.rel)) continue;
    if (includesAnyPathSegment(file.rel, EXCLUDED_PATH_SEGMENTS)) continue;
    const content = readFileSync(file.abs, 'utf8');
    for (const hit of findInsertAuditLogCalls(content, file.abs)) {
      if (isAllowlisted(allow, file.rel, hit.line)) continue;
      violations.push(
        `  ${file.rel}:${hit.line}  insert(auditLog) outside the single door. Route this ` +
          'through DrizzleAuditStore.append/.appendBatch (@revealui/db) so every audit_log ' +
          'write shares one chokepoint (integrity, signing, anchoring). See GAP-355 Stage 2.',
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
  out(
    `Result: FAIL (${violations.length} writer${violations.length === 1 ? '' : 's'} outside the door)`,
  );
  out('');
  out('  Fix options:');
  out('    1. Route the write through DrizzleAuditStore.append/.appendBatch (preferred).');
  out('    2. Add an entry to scripts/validate/audit-log-single-door-allowlist.json');
  out('       with the file path (and optionally a line number) plus a reason.');
  out(Sep);
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
