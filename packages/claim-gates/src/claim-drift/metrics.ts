// console-allowed
/**
 * Filesystem walkers and monorepo metric collectors.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ts from '@revealui/ts-strada';
import { scanState } from './state.js';

// ---------------------------------------------------------------------------
// Walker exclusions + tracked-file counts
//
// Whole-repo METRICS (test files) prefer `git ls-files` (see countTestFiles /
// countTrackedFiles) so nested agent worktrees under `.wt/` never inflate
// counts (GAP-399). Filesystem walkers remain for fixtures, git-less trees,
// and scoped collectors (packages/, apps/, presentation components, mcp
// servers, db schema) which only readdir a single known directory and cannot
// double-count a nested full checkout.
//
// Two layers still protect walk-based paths and claim scans when git is
// unavailable (incident 2026-06-11: a stale opensrc/ cache held 53 third-party
// *.test.ts files, inflating countTestFiles() from 961 to 1014 — past the
// ±100 testFiles tolerance — so the local gate hard-failed while CI stayed
// green):
//
// 1. WALK_EXCLUDED_DIRS — directory NAMES the walkers below must never
//    enter, matched per entry at any depth. This is the only protection when
//    git is unavailable, so every gitignored artifact directory name that
//    can hold walker-matchable files (.ts/.tsx/.md/.txt/.json/.sh) still
//    belongs here. Keep entries in sync with .gitignore: the unit tests
//    assert every entry except .git has a covering .gitignore line AND that
//    no entry shadows git-tracked files (e.g. screenshots/ is gitignored yet
//    apps/marketing/public/screenshots is tracked, so it must NOT be listed
//    here). Includes `.wt` and `.worktrees` for the walk fallback.
//
// 2. The git-derived ignored-path set (below) — one lazy `git ls-files`
//    --others --ignored pass covering what a name set cannot express:
//    path-shaped ignores (the generated docs mirror apps/docs/public/* from
//    apps/docs/scripts/copy-docs.sh — SoT is monorepo docs/; public/*.md is
//    gitignored) and pattern-shaped file ignores inside scanned dirs
//    (docs/*VERIFICATION*.md / docs/*REPORT*.md). It also honors nested
//    .gitignore files.
// ---------------------------------------------------------------------------

/** Exported for tests. */
export const WALK_EXCLUDED_DIRS: ReadonlySet<string> = new Set([
  '.git',
  '.claude',
  'node_modules',
  // build output (gitignored)
  'dist',
  'build',
  'out',
  '.next',
  // tool caches and generated reports (gitignored)
  '.turbo',
  '.vercel',
  '.direnv',
  '.pnpm-store',
  'coverage',
  'playwright-report',
  'test-results',
  '__temp_discover_test__',
  // fetched third-party package source — the 2026-06-11 incident dir
  'opensrc',
  // parallel-agent worktrees: full repo copies under the repo root
  '.worktrees',
  // fleet convention: worktrees also live as .wt/ (GAP-399)
  '.wt',
]);

/** Skip-predicate the walkers consult for every entry. Exported for tests. */
export type IgnoredPathPredicate = (fullPath: string) => boolean;

export const NEVER_IGNORED: IgnoredPathPredicate = () => false;

/**
 * Parse `git ls-files --others --ignored --exclude-standard --directory -z`
 * output into repo-relative ignored paths. Entries are NUL-separated (split
 * on the literal NUL — no authored regex, per the fleet no-regex rule);
 * fully-ignored directories arrive collapsed with a trailing slash, stripped
 * here so one Set lookup serves both file and directory entries.
 * Exported for tests.
 */
export function parseGitIgnoredOutput(raw: string): Set<string> {
  const ignored = new Set<string>();
  for (const entry of raw.split('\0')) {
    if (entry.length === 0) continue;
    ignored.add(entry.endsWith('/') ? entry.slice(0, -1) : entry);
  }
  return ignored;
}

/**
 * Build the skip-predicate for `ignoredPaths` rooted at `base`. Matching is
 * an exact Set lookup on the base-relative path — git collapses fully-
 * ignored directories to a single entry, so pruning at the directory entry
 * is sufficient and no prefix scan is needed. Exported for tests.
 */
export function makeIgnoredPathPredicate(
  base: string,
  ignoredPaths: ReadonlySet<string>,
): IgnoredPathPredicate {
  if (ignoredPaths.size === 0) return NEVER_IGNORED;
  return (fullPath: string): boolean =>
    ignoredPaths.has(path.relative(base, fullPath).split(path.sep).join('/'));
}

/**
 * One upfront git pass: every gitignored path under `root`, repo-relative.
 * Covers the two classes the WALK_EXCLUDED_DIRS name set cannot express
 * (path-shaped directory ignores; pattern-shaped file ignores) and honors
 * nested .gitignore files. By construction the set can never shadow tracked
 * files — git lists only ignored UNTRACKED paths, so e.g. the tracked
 * apps/marketing/public/screenshots/ never appears here even though
 * `screenshots/` is a .gitignore line.
 *
 * Returns null when git is unavailable (no git binary, deleted .git, tarball
 * checkout) — walkers then fall back to WALK_EXCLUDED_DIRS alone, the
 * pre-existing behavior.
 */
export function loadGitIgnoredPaths(root: string): ReadonlySet<string> | null {
  try {
    const raw = execFileSync(
      'git',
      ['ls-files', '--others', '--ignored', '--exclude-standard', '--directory', '-z'],
      { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    );
    return parseGitIgnoredOutput(raw);
  } catch {
    return null;
  }
}

/**
 * Skip-predicate for walks rooted inside the real repo tree. Lazy + cached:
 * the git pass runs once per process on first walker use — never at import
 * time (the unit tests import this module). Walks rooted OUTSIDE the repo
 * (the mkdtemp fixtures in the unit tests — fixture dirs are not git repos)
 * default to no path-based skipping, keeping the suite hermetic; tests that
 * want path-skipping inject their own predicate instead.
 */
export function ignoredPathPredicateFor(base: string): IgnoredPathPredicate {
  if (base !== scanState.Root && !base.startsWith(scanState.Root + path.sep)) return NEVER_IGNORED;
  if (scanState.rootPredicateCache === undefined) {
    const ignored = loadGitIgnoredPaths(scanState.Root);
    if (ignored === null) {
      console.warn(
        'claim-drift: git unavailable — gitignored-path skipping disabled; ' +
          'walkers fall back to WALK_EXCLUDED_DIRS names only.',
      );
    }
    scanState.rootPredicateCache =
      ignored === null ? NEVER_IGNORED : makeIgnoredPathPredicate(scanState.Root, ignored);
  }
  return scanState.rootPredicateCache;
}

// ---------------------------------------------------------------------------
// Metric collectors
// ---------------------------------------------------------------------------

/**
 * Typed numeric claim shape (GAP-192 PR4). Replaces authored `RegExp` claim
 * patterns: `scanNumericClaimsOnLine` walks `tokenize` output with
 * `isPositiveIntegerToken` / `isIntegerWithCommas`.
 */
export interface NumericClaimSpec {
  metricName: string;
  /** Inclusive lower bound on the captured count (pattern-level). */
  min?: number;
  /** Inclusive upper bound on the captured count (pattern-level). */
  max?: number;
  /** Accept `1,676`-style integers via `isIntegerWithCommas`. */
  allowCommas?: boolean;
  /**
   * Words that may appear in fixed order between the number and the required
   * sequence; each is independently optional (e.g. `native` `React` `UI`).
   */
  optionalIntervening?: string[];
  /** At most one of these words may appear between number and required seq. */
  optionalOneOf?: string[];
  /** Case-insensitive word sequences that must follow the number. Optional when `shape` is set. */
  requiredSequences?: string[][];
  /**
   * When set, one of these sequences must follow the required sequence
   * (e.g. components + "with" / "built" / "in the").
   */
  trailingSequences?: string[][];
  /** Reject when the next word after the match is in this list. */
  forbidNextWords?: string[];
  /** Number must sit inside `(...)` (previous non-ws token is `(`). */
  parenWrapped?: boolean;
  /**
   * Also match label-then-number headings: `Apps (4)`, `OSS Packages (MIT) — 22`.
   * Markdown `| Label | N |` rows are scanned for every spec with
   * `requiredSequences` (that is the honesty-ledger hole).
   */
  labelFirst?: boolean;
  /**
   * Number-then-words walk (`21 packages`). Default true. Set false for
   * short words like `apps` that appear in many non-total counts.
   */
  numberFirst?: boolean;
  /**
   * Table-label words that mean this row is not this metric
   * (`OSS packages` is the MIT split, not the workspace total).
   */
  forbidLabelWords?: string[];
  /**
   * Compound license-split shapes that need a dedicated walk beyond
   * requiredSequences.
   */
  shape?: 'oss-mit' | 'pro-fsl' | 'internal-paren';
}

export interface Metric {
  name: string;
  actual: number;
  claimSpecs: NumericClaimSpec[];
}

export function countByGlob(
  base: string,
  extensions: string[],
  isIgnored: IgnoredPathPredicate = ignoredPathPredicateFor(base),
): number {
  let count = 0;
  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (WALK_EXCLUDED_DIRS.has(e.name) || isIgnored(full)) continue;
      if (e.isDirectory()) {
        walk(full);
      } else if (extensions.some((ext) => e.name.endsWith(ext))) {
        count++;
      }
    }
  }
  walk(base);
  return count;
}

export function countDirs(
  base: string,
  isIgnored: IgnoredPathPredicate = ignoredPathPredicateFor(base),
): number {
  try {
    return fs
      .readdirSync(base, { withFileTypes: true })
      .filter(
        (e) =>
          e.isDirectory() &&
          !isIgnored(path.join(base, e.name)) &&
          fs.existsSync(path.join(base, e.name, 'package.json')),
      ).length;
  } catch {
    return 0;
  }
}

export function countPackages(): number {
  return countDirs(path.join(scanState.Root, 'packages'));
}

export function countApps(): number {
  return countDirs(path.join(scanState.Root, 'apps'));
}

/** Suffixes counted as test files (METRICS.testFiles). Exported for tests. */
export const TEST_FILE_SUFFIXES: readonly string[] = [
  '.test.ts',
  '.test.tsx',
  '.spec.ts',
  '.spec.tsx',
  '.e2e.ts',
] as const;

export function hasTestFileSuffix(filePath: string): boolean {
  return TEST_FILE_SUFFIXES.some((suffix) => filePath.endsWith(suffix));
}

/**
 * Count matching tracked files via `git ls-files` (index paths for THIS
 * worktree only). Returns null when git is unavailable so callers can fall
 * back to a filesystem walk.
 *
 * GAP-399: peer worktrees under `.wt/` (or any future scratch dir) are full
 * working trees on disk. A readdir walk from the main checkout double-counts
 * every test file. `git ls-files` lists only this worktree's tracked paths,
 * so nested checkouts never inflate the count — even if a name is missing
 * from WALK_EXCLUDED_DIRS. Prefer this over directory walks for whole-repo
 * METRICS. Exported for tests.
 */
export function countTrackedFiles(
  root: string,
  match: (repoRelativePath: string) => boolean,
): number | null {
  try {
    const raw = execFileSync('git', ['ls-files', '-z'], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    let count = 0;
    for (const entry of raw.split('\0')) {
      if (entry.length === 0) continue;
      // Normalize to forward slashes (git always emits them).
      if (match(entry)) count++;
    }
    return count;
  } catch {
    return null;
  }
}

/**
 * Count test files across the repo. Path-injectable + exported for tests
 * (mirrors countEnforcementTests); tests may also inject a skip-predicate.
 *
 * Default path (real repo root, no custom predicate): `git ls-files` so
 * nested `.wt/` worktrees cannot inflate METRICS.testFiles (GAP-399).
 * Fixtures and custom predicates keep the filesystem walk.
 */
export function countTestFiles(
  base: string = scanState.Root,
  isIgnored?: IgnoredPathPredicate,
): number {
  // Prefer git ls-files for any git checkout (not only the configured monorepo
  // ROOT) so multi-root fleet scans (GAP-462) never walk nested worktrees.
  // Custom isIgnored predicates keep the filesystem walk for fixture tests.
  if (isIgnored === undefined) {
    const tracked = countTrackedFiles(base, hasTestFileSuffix);
    if (tracked !== null) return tracked;
  }
  return countByGlob(base, [...TEST_FILE_SUFFIXES], isIgnored);
}

export function countUIComponents(): number {
  const compDir = path.join(scanState.Root, 'packages/presentation/src/components');
  if (!fs.existsSync(compDir)) return 0;
  // Each .tsx file in components/ is one component (excluding index.ts and
  // _-prefixed internal helpers, matching the MCP-server counter below).
  try {
    return fs.readdirSync(compDir).filter((f) => f.endsWith('.tsx') && !f.startsWith('_')).length;
  } catch {
    return 0;
  }
}

export function countMCPServers(): number {
  const serversDir = path.join(scanState.Root, 'packages/mcp/src/servers');
  if (!fs.existsSync(serversDir)) return 0;
  try {
    return fs
      .readdirSync(serversDir)
      .filter((f) => f.endsWith('.ts') && !f.startsWith('index') && !f.startsWith('_')).length;
  } catch {
    return 0;
  }
}

export function countWorkspaces(): number {
  return countPackages() + countApps();
}

/**
 * Count CallExpression nodes whose callee is a given identifier.
 * Uses the TypeScript compiler API (no authored regex) so comments and
 * string literals never inflate the total. Path-injectable for tests.
 */
export function countCallIdentifier(fileName: string, content: string, identifier: string): number {
  const sourceFile = ts.createSourceFile(
    fileName,
    content,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );
  let count = 0;
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === identifier
    ) {
      count++;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
  return count;
}

/**
 * Count CallExpression nodes whose callee is the identifier `pgTable`.
 * GAP-192 PR1 plumbing. Thin wrapper over `countCallIdentifier`.
 */
export function countPgTableCalls(fileName: string, content: string): number {
  return countCallIdentifier(fileName, content, 'pgTable');
}

/**
 * Walk `packages/db/src/schema` (or an injected dir) and count CallExpressions
 * of `identifier`. Shared by table and CHECK collectors.
 */
export function countSchemaCallIdentifier(identifier: string, schemaDir?: string): number {
  const resolved = schemaDir ?? path.join(scanState.Root, 'packages/db/src/schema');
  if (!fs.existsSync(resolved)) return 0;
  const isIgnored = ignoredPathPredicateFor(resolved);
  let total = 0;
  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (WALK_EXCLUDED_DIRS.has(e.name) || isIgnored(full)) continue;
      if (e.isDirectory()) {
        walk(full);
      } else if (e.name.endsWith('.ts') && !e.name.endsWith('.test.ts')) {
        let content: string;
        try {
          content = fs.readFileSync(full, 'utf8');
        } catch {
          continue;
        }
        total += countCallIdentifier(full, content, identifier);
      }
    }
  }
  walk(resolved);
  return total;
}

/**
 * Count `pgTable(` declarations across `packages/db/src/schema/*.ts`.
 * The audit-first source of truth for "how many database tables ship".
 * Path-injectable + exported for tests (GAP-192 PR1).
 */
export function countDbTables(schemaDir?: string): number {
  return countSchemaCallIdentifier('pgTable', schemaDir);
}

/**
 * Count drizzle `check(` declarations across `packages/db/src/schema`.
 * Honesty-ledger CHECK rows were ungated; this is the owning collector.
 */
export function countCheckConstraints(schemaDir?: string): number {
  return countSchemaCallIdentifier('check', schemaDir);
}

// ---------------------------------------------------------------------------
// CLI-template collector + claim patterns (added 2026-06-11)
//
// PR #1358 hand-corrected "4 templates" -> 5 in docs/ROADMAP.md; nothing
// gated that drift class, so the next template addition would silently
// re-drift the docs. countCliTemplates counts template directories under
// packages/cli/templates/ (each ships a package.json — the scaffold copies a
// complete project — so the package.json-gated countDirs applies directly).
//
// The claim specs deliberately do NOT match "N template repos" /
// "N standalone template repos": docs/ROADMAP.md legitimately pairs the
// template count with "4 published as standalone template repos", a GitHub
// fact (the revealui-template-* repos; starter-native has none) that cannot
// be derived from this filesystem. Plural-only `templates` plus a repos
// forbid-next keeps that phrasing out of this hard-fail gate.
//
// GAP-192 PR4 — typed NumericClaimSpec (no authored regex).
// ---------------------------------------------------------------------------

/** Path-injectable + exported for tests. */
export function countCliTemplates(base?: string): number {
  return countDirs(base ?? path.join(scanState.Root, 'packages/cli/templates'));
}

/** "5 templates" / "5 CLI templates" — not "4 template repos". Exported for tests. */
export const CLI_TEMPLATE_CLAIM_SPECS: NumericClaimSpec[] = [
  {
    metricName: 'CLI templates',
    optionalIntervening: ['CLI'],
    requiredSequences: [['templates']],
    forbidNextWords: ['repo', 'repos'],
  },
];

// ---------------------------------------------------------------------------
// Enforcement-test collector
//
// The access-control story is quoted fleet-wide as "N enforcement tests": the
// blog, both security attestations (INFORMATION_SECURITY_POLICY,
// ASSET_INVENTORY), LAUNCH-CHECKLIST, and marketing primitives all cite it.
// Canonical scope (per the Security section of CLAUDE.md) is the two suites
// that prove RBAC/ABAC role isolation. Counting it here makes a drift in any
// one of those surfaces fail CI, the same way the mcp / component / table
// counts already do.
// ---------------------------------------------------------------------------

export function defaultEnforcementTestRoots(root: string): string[] {
  return [
    path.join(root, 'packages/core/src/__tests__/auth'),
    path.join(
      root,
      'packages/core/src/collections/operations/__tests__/access-enforcement.test.ts',
    ),
  ];
}

/**
 * Count `it(` / `test(` cases across the canonical enforcement suites. No
 * authored regex (fleet no-regex rule) — a trimmed-line `startsWith` scan.
 * Modifier forms (disabled cases, or table-driven `each` cases) are
 * intentionally excluded: none exist in these suites today, and a disabled
 * case should not inflate an attestation that the tests verify role isolation.
 * Path-injectable + exported for tests.
 */
export function countEnforcementTests(roots?: string[]): number {
  const resolvedRoots = roots ?? defaultEnforcementTestRoots(scanState.Root);
  const files: string[] = [];
  for (const root of resolvedRoots) {
    let stat: fs.Stats;
    try {
      stat = fs.statSync(root);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(root)) {
        if (entry.endsWith('.test.ts')) files.push(path.join(root, entry));
      }
    } else if (stat.isFile()) {
      files.push(root);
    }
  }
  let count = 0;
  for (const file of files) {
    let content: string;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const line of content.split('\n')) {
      const trimmed = line.trimStart();
      if (trimmed.startsWith('it(') || trimmed.startsWith('test(')) count++;
    }
  }
  return count;
}
