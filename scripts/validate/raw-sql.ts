#!/usr/bin/env tsx

/**
 * Raw-SQL Validator — Phase 2 of the raw-SQL migration plan.
 *
 * Blocks new raw-SQL usage across the codebase. Every pre-existing
 * violation is enumerated in raw-sql-allowlist.json with a reason and
 * (optionally) a migrationPhase tag pointing to the future phase that
 * will remove the exemption.
 *
 * See .jv/docs/raw-sql-migration-plan.md for the full plan.
 *
 * Rules (HARD BLOCK unless allowlisted or suppressed):
 *
 *   direct-import
 *     Import of pg / postgres / @neondatabase/serverless from
 *     anywhere outside packages/db/src/client/. All DB connections
 *     must route through the canonical Drizzle client.
 *
 *   rpc-call
 *     Any .rpc( call. Recon 2026-04-20 found zero runtime consumers.
 *     Production vector search uses Drizzle query builder with
 *     sql`` fragments for the pgvector <-> operator, not .rpc().
 *     Excluded dirs: packages/harnesses (string-content definitions),
 *     __tests__.
 *
 *   execute-sql-literal
 *     db.execute(sql`...`) where the template is a full
 *     SELECT/UPDATE/DELETE/INSERT/CREATE/DROP/ALTER/TRUNCATE
 *     statement. Excluded paths: tests, migration runners, setup
 *     scripts. Bare `sql`` fragments inside query-builder calls
 *     (.select, .where, .orderBy, etc.) are the idiomatic way to
 *     use pgvector operators and are never flagged — this rule
 *     only fires on .execute() with a literal DDL/DML payload.
 *
 *   sql-file-outside-migrations
 *     Any .sql file not under packages/db/migrations/. Catches
 *     hand-applied migrations that bypass drizzle-kit.
 *
 * Suppression: add `// drizzle-raw: <reason>` on the same line OR
 * the line immediately preceding the banned pattern. Reason is
 * required — empty reasons do not suppress.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// =============================================================================
// Constants
// =============================================================================

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');

const ALLOWLIST_PATH = join(REPO_ROOT, 'scripts/validate/raw-sql-allowlist.json');

// Directories scanned for source-code violations
const SCAN_ROOTS = ['apps', 'packages', 'scripts'];

// Source file extensions considered source code
const SOURCE_EXTS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);

// Directories skipped entirely during scan
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

// Rule: direct-import. The @revealui/db package is the canonical Drizzle
// client provider; imports within it are legitimate. Outside code must
// route through @revealui/db rather than pulling pg directly.
const DIRECT_IMPORT_ALLOWED_PREFIXES = ['packages/db/src/'];
const DIRECT_IMPORT_EXCLUDED_PATH_SEGMENTS = [
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
];

const DIRECT_IMPORT_MODULES = ['pg', 'postgres', '@neondatabase/serverless'];

// Rule: rpc-call. Paths here have been verified (2026-04-20) to contain
// only string-embedded examples or test connectivity probes — never
// runtime .rpc() usage.
const RPC_EXCLUDED_PATH_SEGMENTS = [
  'packages/harnesses/',
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
];

// Rule: execute-sql-literal. Legitimate hosts of .execute(sql`...`):
//   - test harnesses (teardown, schema bootstrapping)
//   - migration / setup scripts (DDL that drizzle-kit doesn't cover)
const EXECUTE_SQL_LITERAL_EXCLUDED_PATH_SEGMENTS = [
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
  'scripts/setup/',
  'scripts/db/',
  'packages/db/src/scripts/',
  'packages/test/src/',
  'packages/db/__tests__/',
  // Drizzle migration runner (official drizzle-orm pattern)
  'packages/db/src/migrate',
  // Validators describe the banned patterns and must not self-flag.
  'scripts/validate/',
];

// Rule: sql-file-outside-migrations. drizzle-kit writes SQL under this dir.
const SQL_MIGRATIONS_DIR = 'packages/db/migrations';

// Paths where bare .sql files are explicitly allowed (e.g., test fixtures).
// Individual out-of-band .sql files that need a documented exemption go in
// raw-sql-allowlist.json instead of this blanket list — they deserve a
// file-scoped reason and (where applicable) a migrationPhase tag.
const SQL_FILE_ALLOWED_PATH_SEGMENTS = [
  '__tests__/',
  'node_modules/',
  'dist/',
  '.turbo/',
  'coverage/',
];

// Suppression comment — must carry a non-empty reason after the colon.
const SUPPRESSION_PATTERN = /\/\/\s*drizzle-raw\s*:\s*\S/;

// =============================================================================
// Allowlist loading
// =============================================================================

type RuleId = 'direct-import' | 'rpc-call' | 'execute-sql-literal' | 'sql-file-outside-migrations';

interface AllowlistEntry {
  path: string;
  rules: RuleId[];
  reason: string;
  migrationPhase?: number;
}

interface AllowlistFile {
  version: number;
  entries?: AllowlistEntry[];
  [key: string]: unknown;
}

function loadAllowlist(): Map<string, Set<RuleId>> {
  if (!existsSync(ALLOWLIST_PATH)) {
    return new Map();
  }
  const raw = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8')) as AllowlistFile;
  const map = new Map<string, Set<RuleId>>();
  for (const entry of raw.entries ?? []) {
    if (!entry.reason?.trim()) {
      throw new Error(
        `raw-sql-allowlist.json: entry "${entry.path}" is missing a non-empty reason.`,
      );
    }
    map.set(entry.path, new Set(entry.rules));
  }
  return map;
}

function isAllowlisted(
  allowlist: Map<string, Set<RuleId>>,
  relPath: string,
  rule: RuleId,
): boolean {
  const normalized = relPath.split('\\').join('/');
  return allowlist.get(normalized)?.has(rule) ?? false;
}

// =============================================================================
// Suppression detection
// =============================================================================

/**
 * Returns true if the given line (or the line immediately preceding it)
 * carries a `// drizzle-raw: <reason>` comment with a non-empty reason.
 */
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
    out.push({ abs, rel: relative(REPO_ROOT, abs).split('\\').join('/'), ext });
  }
  return out;
}

function includesAnyPathSegment(path: string, segments: readonly string[]): boolean {
  return segments.some((seg) => path.includes(seg));
}

// =============================================================================
// Rule: direct-import
// =============================================================================

function checkDirectImport(
  file: FoundFile,
  content: string,
  allowlist: Map<string, Set<RuleId>>,
): string[] {
  if (!SOURCE_EXTS.has(file.ext)) return [];
  if (DIRECT_IMPORT_ALLOWED_PREFIXES.some((p) => file.rel.startsWith(p))) return [];
  if (includesAnyPathSegment(file.rel, DIRECT_IMPORT_EXCLUDED_PATH_SEGMENTS)) return [];

  const violations: string[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trimStart();
    // Fast path — skip anything not starting with import/export/require/from
    if (
      !trimmed.startsWith('import') &&
      !trimmed.startsWith('export') &&
      !trimmed.includes('require(')
    ) {
      continue;
    }
    for (const mod of DIRECT_IMPORT_MODULES) {
      // Only flag module specifiers in an import/require context — avoid
      // false positives on string literals like `'postgres' | 'positional'`.
      const specifiers = [
        `from '${mod}'`,
        `from "${mod}"`,
        `from \`${mod}\``,
        `from '${mod}/`,
        `from "${mod}/`,
        `require('${mod}')`,
        `require("${mod}")`,
        `require('${mod}/`,
        `require("${mod}/`,
      ];
      if (specifiers.some((s) => line.includes(s))) {
        if (isAllowlisted(allowlist, file.rel, 'direct-import')) return violations;
        if (isLineSuppressed(lines, i)) continue;
        violations.push(
          `  ${file.rel}:${i + 1}  imports ${mod} outside @revealui/db (route via packages/db/src/)`,
        );
      }
    }
  }

  return violations;
}

// =============================================================================
// Rule: rpc-call
// =============================================================================

const RPC_CALL_REGEX = /\.rpc\s*\(/;

function checkRpcCall(
  file: FoundFile,
  content: string,
  allowlist: Map<string, Set<RuleId>>,
): string[] {
  if (!SOURCE_EXTS.has(file.ext)) return [];
  if (includesAnyPathSegment(file.rel, RPC_EXCLUDED_PATH_SEGMENTS)) return [];

  const violations: string[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (!RPC_CALL_REGEX.test(line)) continue;
    if (isAllowlisted(allowlist, file.rel, 'rpc-call')) return violations;
    if (isLineSuppressed(lines, i)) continue;
    violations.push(
      `  ${file.rel}:${i + 1}  .rpc() call (use Drizzle query builder; see rag-vector-service.ts for pgvector pattern)`,
    );
  }

  return violations;
}

// =============================================================================
// Rule: execute-sql-literal
// =============================================================================

// Matches .execute(sql`<whitespace or newline>KEYWORD...` where KEYWORD is a
// DDL/DML verb. Multiline-aware via `[\s\S]`. The specific keywords guard
// against flagging short-form calls like .execute(sql`${fragment}`) that are
// interpolation-only (those are typically query-builder composition, not
// full statements).
const EXECUTE_SQL_LITERAL_REGEX =
  /\.execute\s*\(\s*sql\s*`\s*(?:--[^\n]*\n\s*)*(?:SELECT|UPDATE|DELETE|INSERT|CREATE|DROP|ALTER|TRUNCATE|GRANT|REVOKE|WITH|DO)\b/i;

function checkExecuteSqlLiteral(
  file: FoundFile,
  content: string,
  allowlist: Map<string, Set<RuleId>>,
): string[] {
  if (!SOURCE_EXTS.has(file.ext)) return [];
  if (includesAnyPathSegment(file.rel, EXECUTE_SQL_LITERAL_EXCLUDED_PATH_SEGMENTS)) return [];

  const violations: string[] = [];
  const lines = content.split('\n');

  // Multiline match at file scope — gives us the offset of each hit.
  // Then we translate offset to line and check suppression there.
  const globalPattern = new RegExp(EXECUTE_SQL_LITERAL_REGEX.source, 'gi');
  for (;;) {
    const match = globalPattern.exec(content);
    if (match === null) break;
    const offset = match.index;
    const lineIdx = content.slice(0, offset).split('\n').length - 1;
    if (isAllowlisted(allowlist, file.rel, 'execute-sql-literal')) return violations;
    if (isLineSuppressed(lines, lineIdx)) continue;
    violations.push(
      `  ${file.rel}:${lineIdx + 1}  db.execute(sql\`<literal DDL/DML>\`) — migrate to Drizzle query builder`,
    );
  }

  return violations;
}

// =============================================================================
// Rule: sql-file-outside-migrations
// =============================================================================

function checkSqlFileOutsideMigrations(
  file: FoundFile,
  allowlist: Map<string, Set<RuleId>>,
): string[] {
  if (file.ext !== '.sql') return [];
  if (file.rel.startsWith(`${SQL_MIGRATIONS_DIR}/`)) return [];
  if (includesAnyPathSegment(file.rel, SQL_FILE_ALLOWED_PATH_SEGMENTS)) return [];
  if (isAllowlisted(allowlist, file.rel, 'sql-file-outside-migrations')) return [];

  return [
    `  ${file.rel}  .sql file outside ${SQL_MIGRATIONS_DIR}/ (apply via drizzle-kit or allowlist with reason)`,
  ];
}

// =============================================================================
// Main
// =============================================================================

function collectAllFiles(): FoundFile[] {
  const all: FoundFile[] = [];
  for (const root of SCAN_ROOTS) {
    const abs = join(REPO_ROOT, root);
    if (existsSync(abs) && statSync(abs).isDirectory()) {
      collectFiles(abs, all);
    }
  }
  return all;
}

function main(): void {
  const Sep = '='.repeat(64);
  console.log(`\n${Sep}`);
  console.log('Raw-SQL Validator');
  console.log(Sep);

  const allowlist = loadAllowlist();
  const files = collectAllFiles();
  console.log(`\n  Scanning ${files.length} files across ${SCAN_ROOTS.join(', ')}`);
  console.log(`  Allowlist entries: ${allowlist.size}`);

  const sourceFiles = files.filter((f) => SOURCE_EXTS.has(f.ext));
  const sqlFiles = files.filter((f) => f.ext === '.sql');

  const allViolations: string[] = [];

  console.log('\n→ direct-import  (pg / postgres / @neondatabase/serverless)');
  let ruleViolations: string[] = [];
  for (const file of sourceFiles) {
    const content = readFileSync(file.abs, 'utf8');
    ruleViolations.push(...checkDirectImport(file, content, allowlist));
  }
  if (ruleViolations.length === 0) {
    console.log('  ✓ clean');
  } else {
    for (const v of ruleViolations) console.log(v);
    allViolations.push(...ruleViolations);
  }

  console.log('\n→ rpc-call');
  ruleViolations = [];
  for (const file of sourceFiles) {
    const content = readFileSync(file.abs, 'utf8');
    ruleViolations.push(...checkRpcCall(file, content, allowlist));
  }
  if (ruleViolations.length === 0) {
    console.log('  ✓ clean');
  } else {
    for (const v of ruleViolations) console.log(v);
    allViolations.push(...ruleViolations);
  }

  console.log('\n→ execute-sql-literal');
  ruleViolations = [];
  for (const file of sourceFiles) {
    const content = readFileSync(file.abs, 'utf8');
    ruleViolations.push(...checkExecuteSqlLiteral(file, content, allowlist));
  }
  if (ruleViolations.length === 0) {
    console.log('  ✓ clean');
  } else {
    for (const v of ruleViolations) console.log(v);
    allViolations.push(...ruleViolations);
  }

  console.log('\n→ sql-file-outside-migrations');
  ruleViolations = [];
  for (const file of sqlFiles) {
    ruleViolations.push(...checkSqlFileOutsideMigrations(file, allowlist));
  }
  if (ruleViolations.length === 0) {
    console.log('  ✓ clean');
  } else {
    for (const v of ruleViolations) console.log(v);
    allViolations.push(...ruleViolations);
  }

  console.log(`\n${Sep}`);
  if (allViolations.length === 0) {
    console.log('Result: PASS (0 violations)');
    console.log(Sep);
    process.exit(0);
  }
  console.log(
    `Result: FAIL (${allViolations.length} violation${allViolations.length === 1 ? '' : 's'})`,
  );
  console.log('');
  console.log('  Fix options:');
  console.log('    1. Migrate to Drizzle query builder (preferred).');
  console.log('    2. Add an entry to scripts/validate/raw-sql-allowlist.json');
  console.log('       with a non-empty reason and (ideally) a migrationPhase.');
  console.log('    3. Add `// drizzle-raw: <reason>` on the offending line.');
  console.log(Sep);
  process.exit(1);
}

main();
