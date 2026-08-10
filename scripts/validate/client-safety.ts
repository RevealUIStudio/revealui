// console-allowed
/**
 * Client-Bundle Safety Validator
 *
 * Prevents the `node:crypto` client-bundle crash class (PR #1046) from silently
 * (re)appearing. Origin: `@revealui/core/richtext/rsc` imported URL helpers from
 * the `@revealui/security` barrel, which used to statically re-export auth.ts +
 * gdpr.ts (`node:crypto`) and ssrf.ts (`node:dns`). Pulling that into a browser /
 * RSC bundle dragged the node: graph in and blanked the route (e.g. marketing
 * /blog).
 *
 * The barrel is now client-safe: server-only modules live behind the explicit
 * `@revealui/security/server` subpath (and `@revealui/core/security`, which
 * re-exports it). This validator keeps it that way. Two rules, both hard-fail:
 *
 *   Rule 1 — client-reachable source must not statically import a server-only
 *   entry or a `node:*` builtin. Server-only entries are AUTO-DERIVED: every
 *   `@revealui/*` package whose `.` barrel statically reaches a `node:` import
 *   (ai, cli, config, harnesses, mcp, resilience, …) plus the explicit
 *   server-only subpaths (`@revealui/security/server`, `@revealui/core/security`).
 *   "Client-reachable" = declared client roots (richtext exports, presentation,
 *   the Vite SPA `app/` trees) PLUS any file with a `'use client'` directive.
 *   Type-only imports (erased) and dynamic `import()` (code-split) are allowed.
 *
 *   Rule 2 — every declared client-safe package entry (`@revealui/security` and
 *   `@revealui/security/sanitize`) must be free of STATIC `node:*` imports across
 *   its within-package eager (static) import closure. Catches the providing
 *   package silently regressing a client-safe entry (e.g. re-introducing a static
 *   node: import into the barrel). Lazy `await import('node:…')` is bundle-safe
 *   and allowed.
 *
 * No authored regex (fleet no-regex rule, M2): import detection uses the
 * TypeScript compiler API (AST), client-reachability uses path-prefix +
 * `Set` lookups + AST directive detection, and node: detection is a string
 * prefix check.
 *
 * Usage:
 *   pnpm tsx scripts/validate/client-safety.ts
 *   pnpm validate:client-safety        # same, via package.json
 *
 * Exit codes:
 *   0 = no client-bundle-safety violations
 *   1 = violations found (or a malformed allowlist)
 *
 * Escape hatch: scripts/validate/client-safety-allowlist.json — a path + rule +
 * non-empty reason. Reserved for files that are genuinely server-only yet live
 * under a scanned tree; not a way to ship a real client leak.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import ts from '@revealui/ts-strada';

// =============================================================================
// Configuration
// =============================================================================

const ROOT = resolve(import.meta.dirname, '../..');
const ALLOWLIST_PATH = join(ROOT, 'scripts/validate/client-safety-allowlist.json');

/**
 * Server-only SUBPATH entries that the barrel auto-derivation (see
 * `deriveServerOnlySpecifiers`) won't surface, because they aren't a package's
 * `.` barrel: `@revealui/security/server` (the security package's node:-bearing
 * entry) and `@revealui/core/security` (which re-exports it). Package `.`
 * barrels that reach `node:` (ai, cli, config, harnesses, mcp, resilience, …)
 * are derived automatically, so they are NOT listed here.
 */
const EXPLICIT_SERVER_ONLY = new Set<string>([
  '@revealui/security/server',
  '@revealui/core/security',
]);

/**
 * Directory trees that are bundled for the browser (Vite SPAs) or the RSC
 * client graph. Everything here is client-reachable. `richtext/exports`
 * includes the `server/` subdir on purpose: those RSC "server" files are
 * still bundled into the Vite marketing/docs SPAs (that is exactly how #1046
 * crashed). Next.js RSC client components elsewhere are covered by the
 * `'use client'` directive scan instead of a blanket app root, so server
 * components are not falsely flagged.
 */
const CLIENT_ROOTS = [
  'packages/core/src/richtext/exports',
  'packages/presentation/src',
  'apps/marketing/app',
  'apps/docs/app',
];

/**
 * Declared client-safe package entry points (Rule 2). Each entry's source file
 * and its within-package relative-import closure must be free of `node:*`
 * imports. Extend as packages declare more client-safe subpaths.
 */
const CLIENT_SAFE_ENTRIES: { specifier: string; entry: string }[] = [
  { specifier: '@revealui/security', entry: 'packages/security/src/index.ts' },
  { specifier: '@revealui/security/sanitize', entry: 'packages/security/src/sanitize.ts' },
];

const SCAN_ROOTS = ['apps', 'packages'];

const SOURCE_EXTS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.next',
  '.turbo',
  'coverage',
  'playwright-report',
  'test-results',
  'opensrc',
  '.git',
]);

type RuleId = 'client-barrel-import' | 'client-node-builtin' | 'client-safe-entry-node';

export interface ClientSafetyIssue {
  rule: RuleId;
  file: string;
  line: number;
  specifier: string;
  detail: string;
}

// =============================================================================
// Path predicates (no regex — string ops + Set)
// =============================================================================

function toPosix(p: string): string {
  return p.split('\\').join('/');
}

function isTestPath(rel: string): boolean {
  return (
    rel.includes('__tests__/') ||
    rel.includes('__mocks__/') ||
    rel.includes('/fixtures/') ||
    rel.includes('.test.') ||
    rel.includes('.spec.') ||
    rel.includes('.e2e.')
  );
}

/**
 * Files that are server-only by naming convention (SSR entry, `*.server.*`).
 * Currently matches nothing in the Vite SPA trees — present so a future SSR
 * server entry dropped into a scanned `app/` tree is not falsely flagged.
 */
function isServerNamedFile(rel: string): boolean {
  const base = basename(rel);
  return (
    base.endsWith('.server.ts') || base.endsWith('.server.tsx') || base.startsWith('entry.server.')
  );
}

function isExcludedFromClientScan(rel: string): boolean {
  return isTestPath(rel) || isServerNamedFile(rel) || rel.endsWith('.d.ts');
}

function isUnderClientRoot(rel: string): boolean {
  return CLIENT_ROOTS.some((root) => rel === root || rel.startsWith(`${root}/`));
}

function isNodeBuiltinSpecifier(specifier: string): boolean {
  return specifier.startsWith('node:');
}

// =============================================================================
// TypeScript AST helpers (no regex)
// =============================================================================

interface ModuleRef {
  specifier: string;
  line: number;
  kind: 'import' | 'export' | 'dynamic';
}

function scriptKindFor(file: string): ts.ScriptKind {
  if (file.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (file.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (file.endsWith('.js') || file.endsWith('.mjs') || file.endsWith('.cjs'))
    return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

export function parseSource(file: string, content: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    content,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    scriptKindFor(file),
  );
}

/** True when an import clause carries no runtime binding (fully type-only). */
function isImportClauseTypeOnly(clause: ts.ImportClause): boolean {
  if (clause.isTypeOnly) return true;
  if (clause.name) return false; // default binding = runtime
  const bindings = clause.namedBindings;
  if (!bindings) return false; // `import 'x'` (side-effect) is handled by the no-clause path
  if (ts.isNamespaceImport(bindings)) return false; // `import * as ns` = runtime
  if (ts.isNamedImports(bindings)) {
    if (bindings.elements.length === 0) return false; // `import {} from 'x'` = side-effect (runtime)
    return bindings.elements.every((el) => el.isTypeOnly);
  }
  return false;
}

/** True when a re-export names only type bindings (fully elided). */
function isExportClauseTypeOnly(decl: ts.ExportDeclaration): boolean {
  if (decl.isTypeOnly) return true;
  const clause = decl.exportClause;
  if (clause && ts.isNamedExports(clause)) {
    if (clause.elements.length === 0) return false;
    return clause.elements.every((el) => el.isTypeOnly);
  }
  return false; // `export * from 'x'` = runtime re-export
}

/** Leading `'use client'` directive in the prologue. */
export function hasUseClientDirective(sourceFile: ts.SourceFile): boolean {
  for (const stmt of sourceFile.statements) {
    if (ts.isExpressionStatement(stmt) && ts.isStringLiteralLike(stmt.expression)) {
      if (stmt.expression.text === 'use client') return true;
      continue; // still inside the directive prologue
    }
    break; // first real statement ends the prologue
  }
  return false;
}

/** All runtime (non-type-only) module specifiers referenced by a source file. */
export function runtimeModuleRefs(sourceFile: ts.SourceFile): ModuleRef[] {
  const refs: ModuleRef[] = [];
  const lineOf = (pos: number): number => sourceFile.getLineAndCharacterOfPosition(pos).line + 1;

  for (const stmt of sourceFile.statements) {
    if (ts.isImportDeclaration(stmt)) {
      if (!ts.isStringLiteral(stmt.moduleSpecifier)) continue;
      if (stmt.importClause && isImportClauseTypeOnly(stmt.importClause)) continue;
      refs.push({
        specifier: stmt.moduleSpecifier.text,
        line: lineOf(stmt.moduleSpecifier.getStart(sourceFile)),
        kind: 'import',
      });
    } else if (ts.isExportDeclaration(stmt)) {
      if (!(stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier))) continue;
      if (isExportClauseTypeOnly(stmt)) continue;
      refs.push({
        specifier: stmt.moduleSpecifier.text,
        line: lineOf(stmt.moduleSpecifier.getStart(sourceFile)),
        kind: 'export',
      });
    }
  }

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const arg = node.arguments[0];
      if (arg && ts.isStringLiteral(arg)) {
        refs.push({ specifier: arg.text, line: lineOf(arg.getStart(sourceFile)), kind: 'dynamic' });
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);

  return refs;
}

// =============================================================================
// File collection
// =============================================================================

interface FoundFile {
  abs: string;
  rel: string;
}

function collectSourceFiles(dir: string, out: FoundFile[] = []): FoundFile[] {
  let entries: import('node:fs').Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      collectSourceFiles(join(dir, entry.name), out);
      continue;
    }
    if (SOURCE_EXTS.has(extname(entry.name))) {
      const abs = join(dir, entry.name);
      out.push({ abs, rel: toPosix(relative(ROOT, abs)) });
    }
  }
  return out;
}

// =============================================================================
// Allowlist
// =============================================================================

interface AllowlistEntry {
  path: string;
  rules: RuleId[];
  reason: string;
}

function loadAllowlist(): Map<string, Set<RuleId>> {
  const map = new Map<string, Set<RuleId>>();
  if (!existsSync(ALLOWLIST_PATH)) return map;
  const raw = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8')) as { entries?: AllowlistEntry[] };
  for (const entry of raw.entries ?? []) {
    if (!entry.reason?.trim()) {
      throw new Error(
        `client-safety-allowlist.json: entry "${entry.path}" is missing a non-empty reason.`,
      );
    }
    map.set(toPosix(entry.path), new Set(entry.rules));
  }
  return map;
}

function isAllowlisted(allowlist: Map<string, Set<RuleId>>, rel: string, rule: RuleId): boolean {
  return allowlist.get(rel)?.has(rule) ?? false;
}

// =============================================================================
// Rule 1 — client-reachable source must not import server-only barrels / node:
// =============================================================================

function checkClientReachable(
  allowlist: Map<string, Set<RuleId>>,
  serverOnly: ReadonlySet<string>,
): ClientSafetyIssue[] {
  const issues: ClientSafetyIssue[] = [];

  for (const root of SCAN_ROOTS) {
    for (const file of collectSourceFiles(join(ROOT, root))) {
      if (isExcludedFromClientScan(file.rel)) continue;

      const underRoot = isUnderClientRoot(file.rel);
      let content: string;
      try {
        content = readFileSync(file.abs, 'utf8');
      } catch {
        continue;
      }
      // Fast path: outside a declared client root, only files that mention the
      // directive can be 'use client'. Avoids parsing the whole tree.
      if (!(underRoot || content.includes('use client'))) continue;

      const sourceFile = parseSource(file.abs, content);
      const inScope = underRoot || hasUseClientDirective(sourceFile);
      if (!inScope) continue;

      for (const ref of runtimeModuleRefs(sourceFile)) {
        // A dynamic import() is code-split into its own chunk — it is not pulled
        // into the eager client bundle, so it cannot cause the load-time crash
        // this gate guards against. The static import that crashed in #1046 IS
        // flagged. (A lazy `await import('node:…')` is the bundle-safe escape.)
        if (ref.kind === 'dynamic') continue;
        if (serverOnly.has(ref.specifier)) {
          if (isAllowlisted(allowlist, file.rel, 'client-barrel-import')) continue;
          issues.push({
            rule: 'client-barrel-import',
            file: file.rel,
            line: ref.line,
            specifier: ref.specifier,
            detail: `${ref.kind} of server-only '${ref.specifier}' (pulls node:crypto/node:dns into the client bundle — import the client-safe '@revealui/security' barrel or '@revealui/security/sanitize' instead)`,
          });
        } else if (isNodeBuiltinSpecifier(ref.specifier)) {
          if (isAllowlisted(allowlist, file.rel, 'client-node-builtin')) continue;
          issues.push({
            rule: 'client-node-builtin',
            file: file.rel,
            line: ref.line,
            specifier: ref.specifier,
            detail: `${ref.kind} of node: builtin '${ref.specifier}' from client-reachable code (absent in the browser — move to a server module)`,
          });
        }
      }
    }
  }

  return issues;
}

// =============================================================================
// Rule 2 — declared client-safe entries must be node:-free (within-package)
// =============================================================================

function packageRootOf(rel: string): string {
  const parts = rel.split('/');
  return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : rel;
}

function resolveRelativeImport(fromFileAbs: string, specifier: string): string | null {
  const base = resolve(dirname(fromFileAbs), specifier);
  const candidates: string[] = [];
  // ESM imports reference compiled `.js`; the source is `.ts`/`.tsx`.
  if (specifier.endsWith('.js')) {
    const stem = base.slice(0, -3);
    candidates.push(`${stem}.ts`, `${stem}.tsx`);
  }
  candidates.push(
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.mts`,
    `${base}.cts`,
    `${base}.js`,
    `${base}.jsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
    join(base, 'index.js'),
  );
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // not this candidate
    }
  }
  return null;
}

function checkClientSafeEntries(serverOnly: ReadonlySet<string>): ClientSafetyIssue[] {
  const issues: ClientSafetyIssue[] = [];

  for (const { specifier, entry } of CLIENT_SAFE_ENTRIES) {
    const entryAbs = join(ROOT, entry);
    if (!existsSync(entryAbs)) {
      issues.push({
        rule: 'client-safe-entry-node',
        file: entry,
        line: 0,
        specifier,
        detail: `declared client-safe entry source '${entry}' does not exist (stale CLIENT_SAFE_ENTRIES config)`,
      });
      continue;
    }

    const pkgRoot = packageRootOf(entry);
    const visited = new Set<string>([entryAbs]);
    const queue: string[] = [entryAbs];

    while (queue.length > 0) {
      const current = queue.pop() as string;
      const rel = toPosix(relative(ROOT, current));
      let content: string;
      try {
        content = readFileSync(current, 'utf8');
      } catch {
        continue;
      }
      const sourceFile = parseSource(current, content);

      for (const ref of runtimeModuleRefs(sourceFile)) {
        // Dynamic import() is code-split into a separate chunk: it neither pulls
        // node: into the entry's eager bundle nor extends the eager closure.
        // audit.ts's `await import('node:crypto')` is the canonical bundle-safe
        // example — flagging it (or following it) would be a false positive.
        if (ref.kind === 'dynamic') continue;
        if (isNodeBuiltinSpecifier(ref.specifier)) {
          issues.push({
            rule: 'client-safe-entry-node',
            file: rel,
            line: ref.line,
            specifier: ref.specifier,
            detail: `node: builtin '${ref.specifier}' is reachable from the client-safe entry '${specifier}' (would crash the browser bundle)`,
          });
          continue;
        }
        if (serverOnly.has(ref.specifier)) {
          issues.push({
            rule: 'client-safe-entry-node',
            file: rel,
            line: ref.line,
            specifier: ref.specifier,
            detail: `server-only entry '${ref.specifier}' is reachable from the client-safe entry '${specifier}'`,
          });
          continue;
        }
        if (ref.specifier.startsWith('.')) {
          const target = resolveRelativeImport(current, ref.specifier);
          if (
            target &&
            toPosix(relative(ROOT, target)).startsWith(`${pkgRoot}/`) &&
            !visited.has(target)
          ) {
            visited.add(target);
            queue.push(target);
          }
        }
      }
    }
  }

  return issues;
}

// =============================================================================
// Server-only specifier derivation (auto-derived, not hand-maintained)
// =============================================================================

/** Reverse-map a package's `.` export (`./dist/X.js`) to its source barrel (`src/X.ts`). */
export function packageBarrelSource(
  pkgDir: string,
): { specifier: string; entryAbs: string } | null {
  let pkg: { name?: string; exports?: Record<string, unknown> };
  try {
    pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
  } catch {
    return null;
  }
  const dot = pkg.exports?.['.'];
  let distImport: string | undefined;
  if (typeof dot === 'string') {
    distImport = dot;
  } else if (dot && typeof dot === 'object' && 'import' in dot && typeof dot.import === 'string') {
    distImport = dot.import;
  }
  if (!(pkg.name && distImport?.startsWith('./dist/') && distImport.endsWith('.js'))) {
    return null;
  }
  const stem = distImport.slice('./dist/'.length, -'.js'.length);
  for (const ext of ['.ts', '.tsx']) {
    const abs = join(pkgDir, 'src', `${stem}${ext}`);
    if (existsSync(abs)) return { specifier: pkg.name, entryAbs: abs };
  }
  return null;
}

/**
 * Cheap pre-filter: does any non-test source file in the package statically
 * import `node:`? A package with none cannot have a node:-bearing barrel, so we
 * skip the (costlier) AST closure walk for pure client-safe packages.
 */
function packageStaticallyUsesNode(pkgDir: string): boolean {
  for (const file of collectSourceFiles(join(pkgDir, 'src'))) {
    if (isTestPath(file.rel)) continue;
    let content: string;
    try {
      content = readFileSync(file.abs, 'utf8');
    } catch {
      continue;
    }
    if (content.includes("from 'node:") || content.includes('from "node:')) return true;
  }
  return false;
}

/** True if the package `.` barrel reaches a STATIC `node:` import in its within-package closure. */
export function barrelReachesNodeBuiltin(entryAbs: string, pkgDirAbs: string): boolean {
  const containingRoot = toPosix(pkgDirAbs);
  const visited = new Set<string>([entryAbs]);
  const queue: string[] = [entryAbs];
  while (queue.length > 0) {
    const current = queue.pop() as string;
    let content: string;
    try {
      content = readFileSync(current, 'utf8');
    } catch {
      continue;
    }
    for (const ref of runtimeModuleRefs(parseSource(current, content))) {
      if (ref.kind === 'dynamic') continue; // lazy import() is code-split — bundle-safe
      if (isNodeBuiltinSpecifier(ref.specifier)) return true;
      if (ref.specifier.startsWith('.')) {
        const target = resolveRelativeImport(current, ref.specifier);
        if (target && toPosix(target).startsWith(`${containingRoot}/`) && !visited.has(target)) {
          visited.add(target);
          queue.push(target);
        }
      }
    }
  }
  return false;
}

/**
 * Auto-derive the server-only specifier set: every `@revealui/*` package whose
 * `.` barrel statically reaches a `node:*` import, UNIONed with the explicit
 * server-only subpaths. No hand-maintained denylist — a package that adds (or
 * removes) a node: import reachable from its barrel is reclassified on the next
 * gate run.
 */
export function deriveServerOnlySpecifiers(): Set<string> {
  const set = new Set<string>(EXPLICIT_SERVER_ONLY);
  const packagesDir = join(ROOT, 'packages');
  let entries: import('node:fs').Dirent[];
  try {
    entries = readdirSync(packagesDir, { withFileTypes: true });
  } catch {
    return set;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const pkgDir = join(packagesDir, entry.name);
    if (!packageStaticallyUsesNode(pkgDir)) continue; // pre-filter: no node: anywhere -> safe
    const barrel = packageBarrelSource(pkgDir);
    if (!barrel) continue;
    if (barrelReachesNodeBuiltin(barrel.entryAbs, pkgDir)) {
      set.add(barrel.specifier);
    }
  }
  return set;
}

// =============================================================================
// Public API + CLI
// =============================================================================

export function findClientSafetyIssues(
  serverOnly: ReadonlySet<string> = deriveServerOnlySpecifiers(),
): ClientSafetyIssue[] {
  const allowlist = loadAllowlist();
  return [...checkClientReachable(allowlist, serverOnly), ...checkClientSafeEntries(serverOnly)];
}

function run(): void {
  const sep = '='.repeat(64);
  console.log(`\n${sep}`);
  console.log('Client-Bundle Safety Validator');
  console.log(sep);
  const serverOnly = deriveServerOnlySpecifiers();
  console.log(
    `\n  Server-only entries guarded (auto-derived): ${[...serverOnly].sort().join(', ')}`,
  );
  console.log(`  Client roots: ${CLIENT_ROOTS.join(', ')}`);
  console.log(`  Client-safe entries: ${CLIENT_SAFE_ENTRIES.map((e) => e.specifier).join(', ')}`);

  const issues = findClientSafetyIssues(serverOnly);

  if (issues.length === 0) {
    console.log(`\n  ✓ clean — no client-bundle-safety violations`);
    console.log(`\n${sep}`);
    console.log('Result: PASS (0 violations)');
    console.log(sep);
    process.exit(0);
  }

  console.log('');
  for (const issue of issues) {
    const at = issue.line > 0 ? `${issue.file}:${issue.line}` : issue.file;
    console.log(`  ✗ [${issue.rule}] ${at}`);
    console.log(`      ${issue.detail}`);
  }

  console.log(`\n${sep}`);
  console.log(`Result: FAIL (${issues.length} violation${issues.length === 1 ? '' : 's'})`);
  console.log('');
  console.log('  Why this matters: a node:-bearing @revealui/* barrel/entry pulled into a');
  console.log('  client bundle drags the node: graph in and crashes the browser silently');
  console.log('  (the PR #1046 class). The server-only set is auto-derived from the barrels.');
  console.log('');
  console.log('  Fix options:');
  console.log("    1. Import the client-safe '@revealui/security' barrel or '/sanitize'.");
  console.log('    2. Move the code to a genuinely server-only module.');
  console.log('    3. If the file is server-only but lives under a scanned tree, add an');
  console.log('       entry to scripts/validate/client-safety-allowlist.json with a reason.');
  console.log(sep);
  process.exit(1);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
const selfPath = resolve(import.meta.dirname, 'client-safety.ts');
if (invokedPath === selfPath) {
  run();
}
