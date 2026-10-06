#!/usr/bin/env tsx
// console-allowed

/**
 * Ban new `role === 'admin'` (and !=, ==, !==) literals outside the
 * platform role helper.
 *
 * The admin decision lives in packages/utils/src/validation/platform-roles.ts
 * (`isAdmin` / `hasRole`). A fresh comparison against the string 'admin' on
 * a `.role` access splits that decision again: owner and super-admin fall
 * out, and the same user gets a different answer per route.
 *
 * Uses the TypeScript compiler API (`ts.createSourceFile` + `ts.forEachChild`),
 * not an authored regex, per the fleet no-regex rule. The walk is syntactic
 * (no Program), same trade-off as scripts/validate/as-never-values.ts.
 *
 * Not flagged:
 *   - the helper module itself
 *   - tests
 *   - comments and string-only mentions that are not a comparison
 *   - `roles.includes('admin')` (a different shape; the ladder helper owns it)
 *   - allowlisted files whose `.role` is a different plane (site collaborator ACL)
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from '@revealui/ts-strada';

function out(line: string): void {
  process.stdout.write(`${line}\n`);
}

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');

const ALLOWLIST_PATH = join(REPO_ROOT, 'scripts/validate/admin-role-literal-allowlist.json');

const HELPER_MODULE = 'packages/utils/src/validation/platform-roles.ts';

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

const EQUALITY_OPS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
]);

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
  if (!existsSync(ALLOWLIST_PATH)) return { byPath: new Map() };
  const raw = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8')) as AllowlistFile;
  const byPath = new Map<string, AllowlistEntry[]>();
  for (const entry of raw.entries ?? []) {
    if (!entry.reason?.trim()) {
      throw new Error(
        `admin-role-literal-allowlist.json: entry "${entry.path}" is missing a non-empty reason.`,
      );
    }
    const list = byPath.get(entry.path) ?? [];
    list.push(entry);
    byPath.set(entry.path, list);
  }
  return { byPath };
}

function isAllowlisted(allow: AllowlistMatcher, relPath: string, line: number): boolean {
  const entries = allow.byPath.get(relPath.split('\\').join('/'));
  if (!entries) return false;
  for (const entry of entries) {
    if (entry.line === undefined || entry.line === line) return true;
  }
  return false;
}

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

export interface AdminRoleLiteralHit {
  line: number;
}

function unwrap(node: ts.Expression): ts.Expression {
  let current = node;
  while (ts.isParenthesizedExpression(current)) current = current.expression;
  return current;
}

function isAdminString(expr: ts.Expression): boolean {
  const value = unwrap(expr);
  return ts.isStringLiteral(value) && value.text === 'admin';
}

function isRoleAccess(expr: ts.Expression): boolean {
  const value = unwrap(expr);
  if (ts.isIdentifier(value) && value.text === 'role') return true;
  if (ts.isPropertyAccessExpression(value) && value.name.text === 'role') return true;
  if (
    ts.isElementAccessExpression(value) &&
    value.argumentExpression &&
    ts.isStringLiteral(value.argumentExpression) &&
    value.argumentExpression.text === 'role'
  ) {
    return true;
  }
  return false;
}

/**
 * Comparisons of a role access against the literal 'admin'.
 * Either side may hold the literal (`role === 'admin'` or `'admin' === role`).
 */
export function findAdminRoleLiterals(sourceText: string, fileName: string): AdminRoleLiteralHit[] {
  const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
  const hits: AdminRoleLiteralHit[] = [];

  function visit(node: ts.Node): void {
    if (
      ts.isBinaryExpression(node) &&
      EQUALITY_OPS.has(node.operatorToken.kind) &&
      ((isRoleAccess(node.left) && isAdminString(node.right)) ||
        (isAdminString(node.left) && isRoleAccess(node.right)))
    ) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      hits.push({ line: line + 1 });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return hits;
}

const Sep = '='.repeat(72);

function main(): void {
  out(Sep);
  out('admin role literal: CI validator');
  out(Sep);

  const allow = loadAllowlist();
  const files: FoundFile[] = [];
  for (const root of SCAN_ROOTS) {
    const abs = join(REPO_ROOT, root);
    if (!(existsSync(abs) && statSync(abs).isDirectory())) continue;
    collectFiles(abs, files);
  }

  out(`Scanning ${files.length} source files...`);

  const violations: string[] = [];
  for (const file of files) {
    if (file.rel === HELPER_MODULE) continue;
    if (includesAnyPathSegment(file.rel, EXCLUDED_PATH_SEGMENTS)) continue;
    const content = readFileSync(file.abs, 'utf8');
    for (const hit of findAdminRoleLiterals(content, file.abs)) {
      if (isAllowlisted(allow, file.rel, hit.line)) continue;
      violations.push(
        `  ${file.rel}:${hit.line}  role compared to 'admin'. Use isAdmin() or hasRole() from @revealui/utils/validation.`,
      );
    }
  }

  if (violations.length === 0) {
    out('  clean');
  } else {
    for (const violation of violations) out(violation);
  }

  out(`\n${Sep}`);
  if (violations.length === 0) {
    out('Result: PASS (0 violations)');
    out(Sep);
    process.exit(0);
  }
  out(`Result: FAIL (${violations.length} violation${violations.length === 1 ? '' : 's'})`);
  out(Sep);
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
