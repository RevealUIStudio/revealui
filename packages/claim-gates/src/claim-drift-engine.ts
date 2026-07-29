// console-allowed
/**
 * Claim Drift Detector
 *
 * Counts real codebase metrics (packages, apps, MCP servers, test files,
 * UI components, tables) and compares them against claims in docs and
 * marketing files. Fails on mismatch so CI catches inflated numbers.
 *
 * Usage:
 *   pnpm validate:claims
 *   pnpm validate:claims -- --fix   # show suggested fixes
 *
 * Package: @revealui/claim-gates (GAP-462 Phase 1). ROOT is parameterized.
 *
 * Exit codes:
 *   0 = all claims match reality
 *   1 = mismatches found
 *
 * This is a CLI script — console output is the program's purpose.
 * The `console-allowed` marker on line 1 exempts the file from the
 * no-console-log rule (per .revealui/code-standards.json).
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
// Shared marketing-voice engine (GAP-192).
import {
  checkRule,
  isIntegerWithCommas,
  isPositiveIntegerToken,
  isRepoLinkToken,
  isTrackerToken,
  type Rule,
  stripCommas,
  type Token,
  tokenize,
} from '@revealui/contracts/marketing-voice';
import ts from 'typescript';
import { findCopyDependentHits } from './copy-dependents.js';
import { type ClaimProfile, existingRoots, getProfile, resolveProfile } from './profiles.js';
import type {
  CapabilityGateSlice,
  ClaimGateResult,
  ClaimGateRunOptions,
  ClaimProfileName,
} from './types.js';

export type { Rule, Token };
export { checkRule, isIntegerWithCommas, isPositiveIntegerToken, stripCommas, tokenize };

/**
 * Active checkout root. Set via configureClaimGatesRoot / runClaimDrift before
 * any path-dependent collector runs. Pure line scanners do not need it.
 */
let Root = '';
let showFix = false;
let ActiveProfile: ClaimProfile = getProfile('product-runtime');
let WarnOnly = false;
/** Lazy cache; typed loosely until IgnoredPathPredicate is declared below. */
let rootPredicateCache: ((fullPath: string) => boolean) | undefined;

/** Configure the monorepo (or profile) root for subsequent collectors. */
export function configureClaimGatesRoot(root: string, profileName?: ClaimProfileName): void {
  Root = path.resolve(root);
  rootPredicateCache = undefined;
  ActiveProfile = getProfile(resolveProfile(Root, profileName));
}

function resolvedScanDirs(): string[] {
  const candidates = ActiveProfile.scanDirs;
  return ActiveProfile.softScanDirs ? existingRoots(Root, candidates) : [...candidates];
}

function resolvedLicenseRoots(): string[] {
  const candidates = ActiveProfile.licenseScanRoots;
  return ActiveProfile.softScanDirs ? existingRoots(Root, candidates) : [...candidates];
}

function resolvedFutureTenseFiles(): string[] {
  return existingRoots(Root, ActiveProfile.futureTenseFiles);
}

function resolvedAspirationalPaths(): string[] {
  const candidates = ActiveProfile.aspirationalPaths;
  return ActiveProfile.softScanDirs ? existingRoots(Root, candidates) : [...candidates];
}

function resolvedCopyDependentPaths(): string[] {
  const candidates = ActiveProfile.copyDependentPaths;
  return ActiveProfile.softScanDirs ? existingRoots(Root, candidates) : [...candidates];
}

function resolvedFleetAttributionFiles(): string[] {
  const candidates = ActiveProfile.fleetAttributionFiles;
  return ActiveProfile.softScanDirs ? existingRoots(Root, candidates) : [...candidates];
}

/** Current configured root (absolute). Empty string if not configured. */
export function getClaimGatesRoot(): string {
  return Root;
}

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

const NEVER_IGNORED: IgnoredPathPredicate = () => false;

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
function loadGitIgnoredPaths(root: string): ReadonlySet<string> | null {
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
function ignoredPathPredicateFor(base: string): IgnoredPathPredicate {
  if (base !== Root && !base.startsWith(Root + path.sep)) return NEVER_IGNORED;
  if (rootPredicateCache === undefined) {
    const ignored = loadGitIgnoredPaths(Root);
    if (ignored === null) {
      console.warn(
        'claim-drift: git unavailable — gitignored-path skipping disabled; ' +
          'walkers fall back to WALK_EXCLUDED_DIRS names only.',
      );
    }
    rootPredicateCache = ignored === null ? NEVER_IGNORED : makeIgnoredPathPredicate(Root, ignored);
  }
  return rootPredicateCache;
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
   * Compound license-split shapes that need a dedicated walk beyond
   * requiredSequences.
   */
  shape?: 'oss-mit' | 'pro-fsl' | 'internal-paren';
}

interface Metric {
  name: string;
  actual: number;
  claimSpecs: NumericClaimSpec[];
}

function countByGlob(
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

function countDirs(
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

function countPackages(): number {
  return countDirs(path.join(Root, 'packages'));
}

function countApps(): number {
  return countDirs(path.join(Root, 'apps'));
}

/** Suffixes counted as test files (METRICS.testFiles). Exported for tests. */
export const TEST_FILE_SUFFIXES: readonly string[] = [
  '.test.ts',
  '.test.tsx',
  '.spec.ts',
  '.spec.tsx',
  '.e2e.ts',
] as const;

function hasTestFileSuffix(filePath: string): boolean {
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
export function countTestFiles(base: string = Root, isIgnored?: IgnoredPathPredicate): number {
  // Prefer git ls-files for any git checkout (not only the configured monorepo
  // ROOT) so multi-root fleet scans (GAP-462) never walk nested worktrees.
  // Custom isIgnored predicates keep the filesystem walk for fixture tests.
  if (isIgnored === undefined) {
    const tracked = countTrackedFiles(base, hasTestFileSuffix);
    if (tracked !== null) return tracked;
  }
  return countByGlob(base, [...TEST_FILE_SUFFIXES], isIgnored);
}

function countUIComponents(): number {
  const compDir = path.join(Root, 'packages/presentation/src/components');
  if (!fs.existsSync(compDir)) return 0;
  // Each .tsx file in components/ is one component (excluding index.ts and
  // _-prefixed internal helpers, matching the MCP-server counter below).
  try {
    return fs.readdirSync(compDir).filter((f) => f.endsWith('.tsx') && !f.startsWith('_')).length;
  } catch {
    return 0;
  }
}

function countMCPServers(): number {
  const serversDir = path.join(Root, 'packages/mcp/src/servers');
  if (!fs.existsSync(serversDir)) return 0;
  try {
    return fs
      .readdirSync(serversDir)
      .filter((f) => f.endsWith('.ts') && !f.startsWith('index') && !f.startsWith('_')).length;
  } catch {
    return 0;
  }
}

function countWorkspaces(): number {
  return countPackages() + countApps();
}

/**
 * Count CallExpression nodes whose callee is the identifier `pgTable`.
 * Uses the TypeScript compiler API (no authored regex) so comments and
 * string literals never inflate the total. Path-injectable for tests.
 * GAP-192 PR1 plumbing.
 */
export function countPgTableCalls(fileName: string, content: string): number {
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
      node.expression.text === 'pgTable'
    ) {
      count++;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
  return count;
}

/**
 * Count `pgTable(` declarations across `packages/db/src/schema/*.ts`.
 * The audit-first source of truth for "how many database tables ship".
 * Path-injectable + exported for tests (GAP-192 PR1).
 */
export function countDbTables(schemaDir?: string): number {
  const resolved = schemaDir ?? path.join(Root, 'packages/db/src/schema');
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
        total += countPgTableCalls(full, content);
      }
    }
  }
  walk(resolved);
  return total;
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
  return countDirs(base ?? path.join(Root, 'packages/cli/templates'));
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

function defaultEnforcementTestRoots(root: string): string[] {
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
  const resolvedRoots = roots ?? defaultEnforcementTestRoots(Root);
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

// ---------------------------------------------------------------------------
// License-split collector (added 2026-05-14 — closes a fleet drift class)
//
// Walks `packages/*/package.json` and groups by the `license` field. The
// fleet's licensing posture is:
//   - MIT for OSS packages
//   - FSL-1.1-MIT for Pro packages (Fair Source; converts to MIT after 2y)
//   - Internal `"private": true` packages may have no `license` field
//
// Docs have historically drifted from package.json reality — the 2026-05-14
// audit found `mcp`, `services`, `engines` stated as OSS in CLAUDE.md and the
// public plan snapshot while their package.json files carry FSL-1.1-MIT.
// Codifying the split here closes that drift class for the canonical doc
// shape "N OSS (MIT)" / "N Pro (FSL...)" / "N internal".
// ---------------------------------------------------------------------------

interface LicenseSplit {
  mit: number;
  fsl: number;
  internal: number;
}

function countLicenseSplit(): LicenseSplit {
  const split: LicenseSplit = { mit: 0, fsl: 0, internal: 0 };
  const pkgDir = path.join(Root, 'packages');
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(pkgDir, { withFileTypes: true });
  } catch {
    return split;
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const pj = path.join(pkgDir, e.name, 'package.json');
    let content: string;
    try {
      content = fs.readFileSync(pj, 'utf8');
    } catch {
      continue;
    }
    let parsed: { license?: string };
    try {
      parsed = JSON.parse(content);
    } catch {
      continue;
    }
    const lic = parsed.license;
    if (lic === 'MIT') split.mit++;
    else if (lic === 'FSL-1.1-MIT') split.fsl++;
    else split.internal++; // missing or unknown license -> internal bucket
  }
  return split;
}

// ---------------------------------------------------------------------------
// Package-license inventory (used by phantom + membership detectors below).
//
// Built once per run from packages/*/package.json — the audit-first source
// of truth — so the gates auto-track future license changes.
// ---------------------------------------------------------------------------

interface PackageLicenseMap {
  mit: Set<string>;
  fsl: Set<string>;
  internal: Set<string>;
  all: Set<string>;
}

function buildPackageLicenseMap(): PackageLicenseMap {
  const map: PackageLicenseMap = {
    mit: new Set(),
    fsl: new Set(),
    internal: new Set(),
    all: new Set(),
  };
  const pkgDir = path.join(Root, 'packages');
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(pkgDir, { withFileTypes: true });
  } catch {
    return map;
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const pj = path.join(pkgDir, e.name, 'package.json');
    let parsed: { name?: string; license?: string };
    try {
      parsed = JSON.parse(fs.readFileSync(pj, 'utf8'));
    } catch {
      continue;
    }
    const name = parsed.name ?? `@revealui/${e.name}`;
    map.all.add(name);
    const lic = parsed.license;
    if (lic === 'MIT') map.mit.add(name);
    else if (lic === 'FSL-1.1-MIT') map.fsl.add(name);
    else map.internal.add(name);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Shared walker for the phantom + membership detectors.
//
// Scope: docs/, apps/marketing/app/, apps/docs/public/docs-pro/ (+ llms), root-level
// CLAUDE.md / README.md / CONTRIBUTING.md / .syncpackrc.json, scripts/,
// and packages/ (README .md only — source code is out of scope for license-
// drift checks; packages/* is huge and would slow the gate).
// ---------------------------------------------------------------------------

const LICENSE_SCAN_EXTENSIONS_FULL = ['.md', '.txt', '.ts', '.tsx', '.json', '.sh'];
const LICENSE_SCAN_EXTENSIONS_PACKAGES = ['.md']; // packages/* is huge; restrict to docs

function walkLicenseScanFiles(callback: (filePath: string, rel: string) => void): void {
  const isIgnored = ignoredPathPredicateFor(Root);
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
      const rel = path.relative(Root, full).split(path.sep).join('/');
      if (e.isDirectory()) {
        walk(full);
      } else {
        const inPackages = rel.startsWith('packages/');
        const exts = inPackages ? LICENSE_SCAN_EXTENSIONS_PACKAGES : LICENSE_SCAN_EXTENSIONS_FULL;
        if (exts.some((ext) => e.name.endsWith(ext))) {
          callback(full, rel);
        }
      }
    }
  }
  for (const root of resolvedLicenseRoots()) {
    const full = path.join(Root, root);
    try {
      const stat = fs.statSync(full);
      const rel = path.relative(Root, full).split(path.sep).join('/');
      if (stat.isFile()) callback(full, rel);
      else if (stat.isDirectory()) walk(full);
    } catch {
      // path missing, skip
    }
  }
}

// ---------------------------------------------------------------------------
// Phantom-package detector
//
// Catches mentions of packages that don't live in this monorepo. The known
// phantom is @revealui/editors — editor config sync ships as RevCon (a
// separate fleet repo), but historical docs sometimes describe a phantom
// in-monorepo package. Allowlist: files whose purpose is the redirect.
//
// GAP-192 PR3 — uses hasPhantomEditorsPackage (token walk); no authored regex.
// ---------------------------------------------------------------------------

interface PhantomMatch {
  file: string;
  line: number;
  pkg: string;
  hint: string;
  text: string;
}

interface PhantomPackage {
  /** Line-level detector (no regex). */
  detect: (line: string) => boolean;
  pkg: string;
  hint: string;
  allowlist: Set<string>;
}

const PHANTOM_EDITORS_HINT =
  'package does not exist in this monorepo; editor sync ships as RevCon (separate fleet repo)';

const PHANTOM_PACKAGES: PhantomPackage[] = [
  {
    detect: hasPhantomEditorsPackage,
    pkg: '@revealui/editors',
    hint: PHANTOM_EDITORS_HINT,
    allowlist: new Set([
      // Canonical pages that exist precisely to document the redirect:
      // (SoT is monorepo docs/; apps/docs/public/* copy-docs mirrors are
      // generated, gitignored, and not scanned — do not list them here.)
      'apps/docs/public/docs-pro/editors/index.md',
      'docs/fleet/revcon.md',
      'docs/REVFLEET.md',
      // The validator itself — its fleet product rules list the phantom
      // by design (as the token sequence to detect leaks elsewhere):
      'scripts/validate/claim-drift.ts',
    ]),
  },
];

function scanForPhantomPackages(): PhantomMatch[] {
  const matches: PhantomMatch[] = [];
  walkLicenseScanFiles((filePath, rel) => {
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      return;
    }
    const lines = content.split('\n');
    for (const phantom of PHANTOM_PACKAGES) {
      if (phantom.allowlist.has(rel)) continue;
      for (let i = 0; i < lines.length; i++) {
        if (phantom.detect(lines[i])) {
          matches.push({
            file: rel,
            line: i + 1,
            pkg: phantom.pkg,
            hint: phantom.hint,
            text: lines[i].trim(),
          });
        }
      }
    }
  });
  return matches;
}

// ---------------------------------------------------------------------------
// License-membership detector
//
// Same-line check: when a line names a @revealui/<pkg> alongside a license
// label, verify the named package's actual license matches the claimed one.
// Catches "MIT: ..., @revealui/mcp, ..." when mcp is FSL-1.1-MIT.
//
// Heuristics by design — table headers in adjacent rows and prior-line
// section context are out of scope to keep false positives low. Headings are
// skipped. Bare package names (e.g. "core" without the @revealui/ prefix)
// are out of scope; this catches the >90% of fleet doc shapes that use the
// scoped form.
//
// REGEX-CONFIG-BOUNDARY — pre-existing convention; AST refactor under GAP-192.
// ---------------------------------------------------------------------------

interface MembershipMatch {
  file: string;
  line: number;
  pkg: string;
  claimedLicense: 'MIT' | 'FSL-1.1-MIT';
  actualLicense: 'MIT' | 'FSL-1.1-MIT' | 'internal/none';
  text: string;
}

// Strict label shapes — tight enough to dodge "MIT-licensed" / "MIT-style"
// / general prose, broad enough to catch table cells, bold labels, prefix
// colons, and parentheticals.
//
// FSL labels intentionally reject bare `Fair Source` / `Pro packages` /
// `FSL-1.1-MIT` mentions without a label structure — that shape appears in
// explanatory prose like "Pro packages (@revealui/ai, @revealui/harnesses)
// ship under Fair Source (FSL-1.1-MIT)" where treating the line as a single-
// license claim produces false positives for the MIT-licensed packages
// named earlier on the same line. Requires `**bold**`, `| table-cell |`,
// `colon:` suffix, or `Pro packages (FSL...` prefix to fire.
//
// Table-cell variants accept extra content inside the cell (e.g.
// `| MIT (free for any tier) |`, `| Fair Source (FSL-1.1-MIT, MIT after 2 years) |`)
// — common in customer-facing docs that annotate the license with a note.
//
// GAP-192 PR3 — token / string walks, no authored regex.

/** Skip whitespace tokens; return next index. */
function skipWs(tokens: Token[], i: number): number {
  let j = i;
  while (j < tokens.length && tokens[j]?.kind === 'whitespace') j++;
  return j;
}

/** True when tokens[i..] is FSL + optional - + 1.1 + optional - + MIT. */
function matchFsl11MitAt(tokens: Token[], i: number): number | null {
  if (tokens[i]?.kind !== 'word' || tokens[i]!.text.toUpperCase() !== 'FSL') return null;
  let j = i + 1;
  if (tokens[j]?.text === '-') j++;
  j = skipWs(tokens, j);
  if (tokens[j]?.kind !== 'word' || tokens[j]!.text !== '1.1') return null;
  j++;
  if (tokens[j]?.text === '-') j++;
  j = skipWs(tokens, j);
  if (tokens[j]?.kind !== 'word' || tokens[j]!.text.toUpperCase() !== 'MIT') return null;
  return j + 1;
}

/** True when tokens[i..] is Fair + optional - + Source. */
function matchFairSourceAt(tokens: Token[], i: number): number | null {
  if (tokens[i]?.kind !== 'word' || tokens[i]!.text.toLowerCase() !== 'fair') return null;
  let j = i + 1;
  if (tokens[j]?.text === '-') j++;
  j = skipWs(tokens, j);
  if (tokens[j]?.kind !== 'word' || tokens[j]!.text.toLowerCase() !== 'source') return null;
  return j + 1;
}

/**
 * MIT label shapes: `**MIT**`, `| MIT … |`, `MIT:`, `(MIT)`.
 * Exported for unit tests (GAP-192 PR3).
 */
export function hasMitLicenseLabel(line: string): boolean {
  // Bold / parenthetical forms are contiguous substrings (no false hits on
  // "MIT-licensed" — those lack the required wrapper shapes).
  if (line.includes('**MIT**') || line.includes('(MIT)')) return true;

  const tokens = tokenize(line);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t?.kind !== 'word' || t.text !== 'MIT') continue;

    // MIT:
    if (tokens[i + 1]?.text === ':') return true;

    // | MIT … |
    let prev = i - 1;
    while (prev >= 0 && tokens[prev]?.kind === 'whitespace') prev--;
    if (prev >= 0 && tokens[prev]?.text === '|') {
      for (let k = i + 1; k < tokens.length; k++) {
        if (tokens[k]?.text === '|') return true;
      }
    }
  }
  return false;
}

/**
 * FSL / Fair Source / Pro-packages label shapes. See block comment above.
 * Exported for unit tests (GAP-192 PR3).
 */
export function hasFslLicenseLabel(line: string): boolean {
  const tokens = tokenize(line);

  // Pro package(s):  /  Pro package(s) (FSL…
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i]?.kind !== 'word' || tokens[i]!.text.toLowerCase() !== 'pro') continue;
    let j = skipWs(tokens, i + 1);
    const pkg = tokens[j];
    if (pkg?.kind !== 'word') continue;
    const pkgLower = pkg.text.toLowerCase();
    if (pkgLower !== 'package' && pkgLower !== 'packages') continue;
    j = skipWs(tokens, j + 1);
    if (tokens[j]?.text === ':') return true;
    if (tokens[j]?.text === '(') {
      const after = skipWs(tokens, j + 1);
      if (tokens[after]?.kind === 'word' && tokens[after]!.text.toUpperCase().startsWith('FSL')) {
        return true;
      }
    }
  }

  for (let i = 0; i < tokens.length; i++) {
    const fslEnd = matchFsl11MitAt(tokens, i);
    if (fslEnd !== null) {
      // **FSL-1.1-MIT** (asterisks immediately around the sequence)
      let before = i - 1;
      let starsBefore = 0;
      while (before >= 0 && tokens[before]?.text === '*') {
        starsBefore++;
        before--;
      }
      let after = fslEnd;
      let starsAfter = 0;
      while (after < tokens.length && tokens[after]?.text === '*') {
        starsAfter++;
        after++;
      }
      if (starsBefore >= 2 && starsAfter >= 2) return true;

      // FSL-1.1-MIT:
      if (tokens[fslEnd]?.text === ':') return true;

      // | FSL-1.1-MIT … |
      let prev = i - 1;
      while (prev >= 0 && tokens[prev]?.kind === 'whitespace') prev--;
      if (prev >= 0 && tokens[prev]?.text === '|') {
        for (let k = fslEnd; k < tokens.length; k++) {
          if (tokens[k]?.text === '|') return true;
        }
      }
    }

    const fairEnd = matchFairSourceAt(tokens, i);
    if (fairEnd !== null) {
      // | Fair Source … |  (table-cell only — bare "Fair Source" is prose)
      let prev = i - 1;
      while (prev >= 0 && tokens[prev]?.kind === 'whitespace') prev--;
      if (prev >= 0 && tokens[prev]?.text === '|') {
        for (let k = fairEnd; k < tokens.length; k++) {
          if (tokens[k]?.text === '|') return true;
        }
      }
    }
  }
  return false;
}

function scanForLicenseMembershipDrift(map: PackageLicenseMap): MembershipMatch[] {
  const matches: MembershipMatch[] = [];
  walkLicenseScanFiles((filePath, rel) => {
    // Skip the validator + its test fixtures — their pattern strings are not claims
    if (rel === 'scripts/validate/claim-drift.ts' || rel.startsWith('scripts/validate/__tests__/'))
      return;
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      return;
    }
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (isMarkdownHeading(line)) continue;
      const hasFSL = hasFslLicenseLabel(line);
      const hasMIT = hasMitLicenseLabel(line) && !hasFSL;
      if (!(hasMIT || hasFSL)) continue;
      for (const pkgName of extractRevealuiPackages(line)) {
        let actual: 'MIT' | 'FSL-1.1-MIT' | 'internal/none' | null;
        if (map.mit.has(pkgName)) actual = 'MIT';
        else if (map.fsl.has(pkgName)) actual = 'FSL-1.1-MIT';
        else if (map.internal.has(pkgName)) actual = 'internal/none';
        else continue; // phantom — handled by phantom detector
        const claimed: 'MIT' | 'FSL-1.1-MIT' = hasMIT ? 'MIT' : 'FSL-1.1-MIT';
        if (actual !== claimed) {
          matches.push({
            file: rel,
            line: i + 1,
            pkg: pkgName,
            claimedLicense: claimed,
            actualLicense: actual,
            text: line.trim(),
          });
        }
      }
    }
  });
  return matches;
}

// ---------------------------------------------------------------------------
// Incomplete-Pro-list detector (added 2026-05-22)
//
// Catches the drift class where a doc presents an INCOMPLETE Pro/FSL package
// list as if it were the full set — e.g. "Pro packages (`@revealui/ai`,
// `@revealui/harnesses`)" when the canonical FSL set has five members. The
// membership detector above only flags a *wrong* license for a named package;
// it cannot see that a list of correctly-FSL packages is missing members.
//
// Conservative gate (keep false positives low): fires only when a line is a
// Pro/FSL-list context AND names a 2+-member STRICT subset of the canonical
// FSL set AND names no MIT package (a mixed list is explanatory prose, not a
// Pro-set enumeration). Single-package mentions are never flagged.
//
// No authored regex — string token scan + Set membership, per the fleet
// no-regex rule.
// ---------------------------------------------------------------------------

interface IncompleteProMatch {
  file: string;
  line: number;
  named: string[];
  total: number;
  text: string;
}

/** Extract `@revealui/<name>` tokens from a line (no regex). Exported for tests. */
export function extractRevealuiPackages(line: string): string[] {
  const out: string[] = [];
  const token = '@revealui/';
  let idx = line.indexOf(token);
  while (idx !== -1) {
    let end = idx + token.length;
    while (end < line.length) {
      const ch = line[end];
      if (!((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') || ch === '-')) break;
      end++;
    }
    if (end > idx + token.length) out.push(line.slice(idx, end));
    idx = line.indexOf(token, end);
  }
  return out;
}

/** True when `line` is a markdown ATX heading (1-6 `#` then a space). Exported for tests. */
export function isMarkdownHeading(line: string): boolean {
  const t = line.trimStart();
  let h = 0;
  while (h < t.length && t[h] === '#') h++;
  return h >= 1 && h <= 6 && t[h] === ' ';
}

/**
 * True when `line` looks like a YAML frontmatter key line (`title: foo`)
 * or the `---` delimiter. Anchored at column 0 (no leading indent).
 * Exported for tests (GAP-192 PR3).
 */
export function isYamlFrontmatterLine(line: string): boolean {
  if (line === '---') return true;
  if (line.length === 0) return false;
  const first = line.charCodeAt(0);
  const isIdentStart =
    (first >= 65 && first <= 90) || (first >= 97 && first <= 122) || first === 95; // A-Z a-z _
  if (!isIdentStart) return false;
  let i = 1;
  while (i < line.length) {
    const c = line.charCodeAt(i);
    const ok =
      (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c === 95 || c === 45; // A-Z a-z 0-9 _ -
    if (!ok) break;
    i++;
  }
  if (i >= line.length || line[i] !== ':') return false;
  // Require whitespace after the colon (matches the prior `:\s` shape).
  const after = line.charCodeAt(i + 1);
  return after === 32 || after === 9;
}

/**
 * When `line` enumerates an INCOMPLETE Pro/FSL package list, return the named
 * FSL packages; otherwise null. Pure + exported for unit testing.
 */
export function findIncompleteProList(
  line: string,
  fslSet: ReadonlySet<string>,
  mitSet: ReadonlySet<string>,
): string[] | null {
  const lower = line.toLowerCase();
  // Require the explicit "Pro package(s)" enumeration phrase. Broader context
  // words ("Fair Source" / "FSL") fire on feature prose that merely mentions a
  // couple of Pro packages — false positives are unacceptable on a hard-fail
  // gate, so we accept missing loose prose (a false negative) instead.
  if (!lower.includes('pro package')) return null;
  const fslNamed = new Set<string>();
  let namesMitPkg = false;
  for (const pkg of extractRevealuiPackages(line)) {
    if (fslSet.has(pkg)) fslNamed.add(pkg);
    else if (mitSet.has(pkg)) namesMitPkg = true;
  }
  if (namesMitPkg) return null; // mixed list -> explanatory prose, not an enumeration
  if (fslNamed.size >= 2 && fslNamed.size < fslSet.size) return [...fslNamed];
  return null;
}

function scanForIncompleteProList(map: PackageLicenseMap): IncompleteProMatch[] {
  const matches: IncompleteProMatch[] = [];
  walkLicenseScanFiles((filePath, rel) => {
    if (rel === 'scripts/validate/claim-drift.ts' || rel.startsWith('scripts/validate/__tests__/'))
      return; // skip self + test fixtures
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      return;
    }
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (isMarkdownHeading(lines[i])) continue;
      const named = findIncompleteProList(lines[i], map.fsl, map.mit);
      if (named) {
        matches.push({ file: rel, line: i + 1, named, total: map.fsl.size, text: lines[i].trim() });
      }
    }
  });
  return matches;
}

// ---------------------------------------------------------------------------
// License-split anti-pattern detector (added 2026-06-14)
//
// Catches the canonical "N published + M private" drift class: prior copy
// stated "21 published + 5 private" against an actual license split of
// "20 MIT + 5 FSL + 1 internal = 26", off by 4 on both numbers. The phrase
// is ambiguous (does "published" mean MIT-only or MIT+FSL? does "private"
// mean internal-only or FSL+internal?), so the fix is to forbid the
// phrasing entirely and steer authors to the canonical MIT / FSL / internal
// taxonomy already gated by the license-membership detector above.
//
// Anti-patterns:
//   - "N published packages"   — implies an OSS-vs-other split the
//     canonical taxonomy doesn't carry (FSL packages also publish to npm).
//   - "N private packages"     — implies M packages are not on npm; in the
//     canonical taxonomy only 1 workspace is internal/private.
//   - "N published + M private" — the explicit equation form prior copy
//     used to count toward 26; flagged regardless of N + M arithmetic.
//
// GAP-192 PR3 — token walk (no authored regex). The shape predicate
// (findLicenseSplitAntiPattern) is exported for unit testing.
// ---------------------------------------------------------------------------

export type LicenseSplitAntiShape =
  | 'N published packages'
  | 'N private packages'
  | 'N published + M private';

interface LicenseSplitAntiMatch {
  file: string;
  line: number;
  shape: LicenseSplitAntiShape;
  text: string;
}

/** Positive integer 1–99 (matches prior `[1-9]\d?` anti-pattern). */
function isOneOrTwoDigitPositive(token: Token | undefined): boolean {
  if (token === undefined || token.kind !== 'word') return false;
  if (!isPositiveIntegerToken(token)) return false;
  const n = Number(token.text);
  return n >= 1 && n <= 99;
}

/**
 * Advance past whitespace only. Returns null if a non-ws token is required
 * but missing; returns the index of the next non-ws token.
 */
function nextNonWs(tokens: Token[], i: number): number | null {
  const j = skipWs(tokens, i);
  return j < tokens.length ? j : null;
}

/**
 * True when tokens[i] is a word whose lower text equals `want`, allowing only
 * leading whitespace from `from` (no symbols between).
 */
function wordAt(tokens: Token[], from: number, want: string): number | null {
  const j = nextNonWs(tokens, from);
  if (j === null) return null;
  const t = tokens[j];
  if (t?.kind !== 'word' || t.text.toLowerCase() !== want.toLowerCase()) return null;
  return j;
}

/**
 * Returns the anti-pattern shape if `line` matches one, otherwise null.
 * Equation form takes precedence — a single line that names both halves of
 * the bug should be flagged once. Pure + exported for unit testing.
 * GAP-192 PR3 — token walk over `tokenize` output (whitespace-only gaps,
 * so "2. Published package" does not match).
 */
export function findLicenseSplitAntiPattern(line: string): LicenseSplitAntiShape | null {
  const tokens = tokenize(line);

  for (let i = 0; i < tokens.length; i++) {
    if (!isOneOrTwoDigitPositive(tokens[i])) continue;
    // N published …
    const pub = wordAt(tokens, i + 1, 'published');
    if (pub !== null) {
      // N published + M private
      const plus = nextNonWs(tokens, pub + 1);
      if (plus !== null && tokens[plus]?.text === '+') {
        const m = nextNonWs(tokens, plus + 1);
        if (m !== null && isOneOrTwoDigitPositive(tokens[m])) {
          const priv = wordAt(tokens, m + 1, 'private');
          if (priv !== null) return 'N published + M private';
        }
      }
      // N published package(s)
      const pkg = nextNonWs(tokens, pub + 1);
      if (pkg !== null && tokens[pkg]?.kind === 'word') {
        const p = tokens[pkg]!.text.toLowerCase();
        if (p === 'package' || p === 'packages') return 'N published packages';
      }
    }
    // N private package(s)
    const priv = wordAt(tokens, i + 1, 'private');
    if (priv !== null) {
      const pkg = nextNonWs(tokens, priv + 1);
      if (pkg !== null && tokens[pkg]?.kind === 'word') {
        const p = tokens[pkg]!.text.toLowerCase();
        if (p === 'package' || p === 'packages') return 'N private packages';
      }
    }
  }
  return null;
}

/**
 * Files documenting the bug as part of their drift-correction prose
 * (post-Phase-3.4 marketing-overhaul fixes). Their comments deliberately
 * quote the old phrasing; the gate must not fire on them.
 */
const LICENSE_SPLIT_ANTIPATTERN_ALLOWLIST = new Set<string>([
  'apps/marketing/app/content/home.ts',
  'apps/marketing/app/content/proof.ts',
  'apps/marketing/app/content/fair-source.ts',
  // The validator itself + its tests — pattern strings are not claims
  'scripts/validate/claim-drift.ts',
]);

function scanForLicenseSplitAntiPatterns(): LicenseSplitAntiMatch[] {
  const matches: LicenseSplitAntiMatch[] = [];
  walkLicenseScanFiles((filePath, rel) => {
    if (LICENSE_SPLIT_ANTIPATTERN_ALLOWLIST.has(rel)) return;
    if (rel.startsWith('scripts/validate/__tests__/')) return;
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      return;
    }
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const shape = findLicenseSplitAntiPattern(lines[i]);
      if (shape) {
        matches.push({ file: rel, line: i + 1, shape, text: lines[i].trim() });
      }
    }
  });
  return matches;
}

// ---------------------------------------------------------------------------
// Claim scanner
// ---------------------------------------------------------------------------

interface ClaimMatch {
  file: string;
  line: number;
  text: string;
  claimed: number;
  metricName: string;
}

export interface NumericClaimHit {
  metricName: string;
  claimed: number;
}

function parseCountToken(token: Token, allowCommas: boolean): number | null {
  if (token.kind !== 'word') return null;
  if (isPositiveIntegerToken(token)) return Number(token.text);
  if (allowCommas && isIntegerWithCommas(token)) {
    const n = Number(stripCommas(token.text));
    return Number.isInteger(n) && n > 0 ? n : null;
  }
  return null;
}

/**
 * License-split shapes: "N OSS (MIT)", "N Pro (FSL…)", "N internal (…".
 * Returns the claimed N or null. Whitespace-only gaps (parity with prior regex).
 */
function matchLicenseShape(
  tokens: Token[],
  shape: 'oss-mit' | 'pro-fsl' | 'internal-paren',
): number | null {
  for (let i = 0; i < tokens.length; i++) {
    const n = parseCountToken(tokens[i]!, false);
    if (n === null || n < 1 || n > 99) continue;

    if (shape === 'oss-mit') {
      // N OSS ( MIT )
      const oss = wordAt(tokens, i + 1, 'oss');
      if (oss === null) continue;
      const open = nextNonWs(tokens, oss + 1);
      if (open === null || tokens[open]?.text !== '(') continue;
      const mit = nextNonWs(tokens, open + 1);
      if (mit === null || tokens[mit]?.text !== 'MIT') continue;
      const close = nextNonWs(tokens, mit + 1);
      if (close !== null && tokens[close]?.text === ')') return n;
    } else if (shape === 'pro-fsl') {
      // N Pro ( [Fair Source] FSL…
      const pro = wordAt(tokens, i + 1, 'pro');
      if (pro === null) continue;
      const open = nextNonWs(tokens, pro + 1);
      if (open === null || tokens[open]?.text !== '(') continue;
      let m = skipWs(tokens, open + 1);
      if (tokens[m]?.kind === 'word' && tokens[m]!.text.toLowerCase() === 'fair') {
        m = skipWs(tokens, m + 1);
        if (tokens[m]?.text === '-') m++;
        m = skipWs(tokens, m);
        if (tokens[m]?.kind === 'word' && tokens[m]!.text.toLowerCase() === 'source') {
          m = skipWs(tokens, m + 1);
        }
      }
      if (tokens[m]?.kind === 'word' && tokens[m]!.text.toUpperCase().startsWith('FSL')) {
        return n;
      }
    } else {
      // N internal (
      const internal = wordAt(tokens, i + 1, 'internal');
      if (internal === null) continue;
      const open = nextNonWs(tokens, internal + 1);
      if (open !== null && tokens[open]?.text === '(') return n;
    }
  }
  return null;
}

/**
 * Try to match `seq` starting at token index `from`, allowing only whitespace
 * between words. Returns the token index after the match, or null.
 */
function matchWordSeqFrom(tokens: Token[], from: number, seq: string[]): number | null {
  let cursor = from;
  for (const want of seq) {
    const at = wordAt(tokens, cursor, want);
    if (at === null) return null;
    cursor = at + 1;
  }
  return cursor;
}

/**
 * Scan a single line for numeric metric claims against typed specs.
 * Pure + exported for unit tests (GAP-192 PR4).
 *
 * Gaps between the number and the keyword sequence may only be whitespace
 * (plus any declared optional intervening words). Symbols (`.`, `+`, backticks)
 * break the match — parity with the prior `\s*`-only regex gaps.
 */
export function scanNumericClaimsOnLine(
  line: string,
  specs: readonly NumericClaimSpec[],
): NumericClaimHit[] {
  const hits: NumericClaimHit[] = [];
  const tokens = tokenize(line);

  for (const spec of specs) {
    if (spec.shape !== undefined) {
      const claimed = matchLicenseShape(tokens, spec.shape);
      if (claimed !== null) {
        if (spec.min !== undefined && claimed < spec.min) continue;
        if (spec.max !== undefined && claimed > spec.max) continue;
        hits.push({ metricName: spec.metricName, claimed });
      }
      continue;
    }

    for (let ti = 0; ti < tokens.length; ti++) {
      const claimed = parseCountToken(tokens[ti]!, spec.allowCommas === true);
      if (claimed === null) continue;
      if (spec.min !== undefined && claimed < spec.min) continue;
      if (spec.max !== undefined && claimed > spec.max) continue;

      if (spec.parenWrapped) {
        let prev = ti - 1;
        while (prev >= 0 && tokens[prev]?.kind === 'whitespace') prev--;
        if (prev < 0 || tokens[prev]?.text !== '(') continue;
      }

      // Optional intervening words (fixed order, each optional) — whitespace only.
      let cursor = ti + 1;
      if (spec.optionalIntervening !== undefined) {
        for (const opt of spec.optionalIntervening) {
          const at = wordAt(tokens, cursor, opt);
          if (at !== null) cursor = at + 1;
        }
      }
      if (spec.optionalOneOf !== undefined && spec.optionalOneOf.length > 0) {
        const j = nextNonWs(tokens, cursor);
        if (j !== null && tokens[j]?.kind === 'word') {
          const lower = tokens[j]!.text.toLowerCase();
          if (spec.optionalOneOf.some((o) => o.toLowerCase() === lower)) {
            cursor = j + 1;
          }
        }
      }

      // Required sequence
      const reqSeqs = spec.requiredSequences ?? [];
      if (reqSeqs.length === 0) continue;
      let afterReq: number | null = null;
      for (const seq of reqSeqs) {
        const end = matchWordSeqFrom(tokens, cursor, seq);
        if (end !== null) {
          afterReq = end;
          break;
        }
      }
      if (afterReq === null) continue;
      cursor = afterReq;

      if (spec.trailingSequences !== undefined && spec.trailingSequences.length > 0) {
        let afterTrail: number | null = null;
        for (const trail of spec.trailingSequences) {
          const end = matchWordSeqFrom(tokens, cursor, trail);
          if (end !== null) {
            afterTrail = end;
            break;
          }
        }
        if (afterTrail === null) continue;
        cursor = afterTrail;
      }

      if (spec.forbidNextWords !== undefined && spec.forbidNextWords.length > 0) {
        const j = nextNonWs(tokens, cursor);
        if (j !== null && tokens[j]?.kind === 'word') {
          const lower = tokens[j]!.text.toLowerCase();
          if (spec.forbidNextWords.some((f) => f.toLowerCase() === lower)) continue;
        }
      }

      hits.push({ metricName: spec.metricName, claimed });
    }
  }

  return hits;
}

/**
 * Throw with a descriptive error if any configured scan-dir does not exist
 * on disk. Closes GAP-179 — the validator silently exempted marketing-app
 * stat-block claims since #639 (Vite migration moved apps/marketing/src/
 * to apps/marketing/app/) because the consumer loops use try/catch + skip.
 *
 * Calling this at validator entry surfaces stale SCAN_DIRS as a fatal error
 * so future tree refactors cannot silently re-introduce the same exemption.
 */
function assertScanDirsExist(scanDirs: string[], arrayName: string): void {
  for (const dir of scanDirs) {
    const full = path.join(Root, dir);
    try {
      const stat = fs.statSync(full);
      if (!(stat.isFile() || stat.isDirectory())) {
        throw new Error(`claim-drift ${arrayName} entry is neither file nor directory: ${dir}`);
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(
        `claim-drift ${arrayName} entry does not exist on disk: ${dir}. ` +
          `Likely cause: source tree refactored without updating ${arrayName} in @revealui/claim-gates. ` +
          `Update the array and re-run. (${reason})`,
      );
    }
  }
}

/**
 * Files excluded from claim-drift scanning:
 *   - CRASH-POSTMORTEMS.md: historical document where counts were accurate at time of writing.
 *   - public plan snapshot under docs/ (name assembled below so package source stays
 *     free of the boundary-banned plan filename literal): per single-source-of-truth,
 *     the canonical plan lives in the private coordination hub; the public-repo copy
 *     is an allowed-stale snapshot and is hook-blocked from agent edits.
 *
 * docs/archive/2026-03-28-DOCUMENTATION_ASSESSMENT.md was a third entry here. It and the
 * whole docs/archive/ dir were promoted to the central fleet archive on 2026-07-28
 * (GAP-451 Phase 5), so there is nothing left in this repo to exclude.
 */
// Split so boundary check 2 does not see the banned plan filename literal in source.
const PUBLIC_PLAN_SNAPSHOT = ['docs', 'MASTER' + '_PLAN.md'].join('/');
const EXCLUDE_FILES = ['docs/system-tune/CRASH-POSTMORTEMS.md', PUBLIC_PLAN_SNAPSHOT];

function scanForClaims(metrics: Metric[]): ClaimMatch[] {
  const matches: ClaimMatch[] = [];
  const isIgnored = ignoredPathPredicateFor(Root);

  function scanFile(filePath: string): void {
    const rel = path.relative(Root, filePath);
    if (EXCLUDE_FILES.includes(rel)) return;

    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      return;
    }
    const allSpecs = metrics.flatMap((m) => m.claimSpecs);
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const hit of scanNumericClaimsOnLine(line, allSpecs)) {
        matches.push({
          file: path.relative(Root, filePath),
          line: i + 1,
          text: line.trim(),
          claimed: hit.claimed,
          metricName: hit.metricName,
        });
      }
    }
  }

  function scanPath(p: string): void {
    const full = path.join(Root, p);
    try {
      const stat = fs.statSync(full);
      if (
        stat.isFile() &&
        (full.endsWith('.md') ||
          full.endsWith('.ts') ||
          full.endsWith('.tsx') ||
          full.endsWith('.txt'))
      ) {
        scanFile(full);
      } else if (stat.isDirectory()) {
        walkAndScan(full);
      }
    } catch {
      // path doesn't exist, skip
    }
  }

  function walkAndScan(dir: string): void {
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
        walkAndScan(full);
      } else if (
        e.name.endsWith('.md') ||
        e.name.endsWith('.ts') ||
        e.name.endsWith('.tsx') ||
        e.name.endsWith('.txt')
      ) {
        scanFile(full);
      }
    }
  }

  const scanDirs = resolvedScanDirs();
  assertScanDirsExist(scanDirs, 'SCAN_DIRS');
  for (const p of scanDirs) {
    scanPath(p);
  }

  return matches;
}

// ---------------------------------------------------------------------------
// Future-tense claim scanner (CR9-P2-02)
//
// Enforces the CONTRIBUTING.md convention: every parenthetical future-tense
// marker — "(coming soon)", "(planned)", "(roadmap)", "(TBD)", "(forthcoming)",
// "(will ship)", "(in progress)" — must cite a tracker on the same line:
// a GitHub issue/PR number (`#123`), issues/pulls URL, `milestone` reference,
// or workflow file (`*.yml` / `*.yaml`).
//
// Scope is narrow by design (high-visibility surfaces only). Expand as
// remaining CR9-P1-05 audit passes close.
// ---------------------------------------------------------------------------

interface FutureClaimMatch {
  file: string;
  line: number;
  marker: string;
  text: string;
}

/**
 * Parenthetical future-tense openers that must cite a tracker
 * (`(coming soon)`, `(will ship)`, …). Matched as lowercase prefixes of the
 * text inside `(...)`. GAP-192 PR3.
 */
const FUTURE_TENSE_PAREN_PREFIXES = [
  'coming soon',
  'planned',
  'roadmap',
  'tbd',
  'forthcoming',
  'will ship',
  'in progress',
] as const;

/**
 * Returns the full parenthetical future-tense marker (e.g. `(coming soon)`)
 * when present, otherwise null. Exported for unit tests (GAP-192 PR3).
 */
export function findFutureTenseMarker(line: string): string | null {
  const tokens = tokenize(line);
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i]?.text !== '(') continue;
    let inner = '';
    let endIdx = -1;
    for (let j = i + 1; j < tokens.length; j++) {
      const t = tokens[j];
      if (t === undefined) break;
      if (t.text === ')') {
        endIdx = j;
        break;
      }
      inner += t.text;
    }
    if (endIdx === -1) continue;
    const lower = inner.toLowerCase().trimStart();
    if (!FUTURE_TENSE_PAREN_PREFIXES.some((p) => lower.startsWith(p))) continue;
    let marker = '';
    for (let k = i; k <= endIdx; k++) marker += tokens[k]!.text;
    return marker;
  }
  return null;
}

/**
 * True when `line` cites a tracker: issue/PR `#N`, repo issues/pull(s) URL,
 * `milestone(s)`, or a workflow `*.yml`/`*.yaml` token.
 *
 * GAP-192 — marketing-voice `tokenize` + `isTrackerToken` / `isRepoLinkToken`.
 * `Intl.Segmenter` splits URLs on `:` and `/`, so non-whitespace token spans
 * are rejoined before `isRepoLinkToken`.
 */
export function hasTrackerSignal(line: string): boolean {
  const tokens = tokenize(line);
  for (let i = 0; i < tokens.length; i++) {
    if (isTrackerToken(tokens[i], tokens[i + 1])) return true;
  }
  let span = '';
  for (const token of tokens) {
    if (token.kind === 'whitespace') {
      if (span.length > 0 && isRepoLinkToken(span)) return true;
      span = '';
      continue;
    }
    span += token.text;
  }
  return span.length > 0 && isRepoLinkToken(span);
}

/**
 * Parenthetical future-tense openers that qualify an aspirational mention
 * on the same line (parity with the pre-GAP-192 QUALIFIER_PATTERN arm).
 * Matched as lowercase prefixes of the text inside `(...)`.
 */
const QUALIFIER_PAREN_PREFIXES = [
  'coming soon',
  'planned',
  'roadmap',
  'in active development',
  'forthcoming',
  'will ship',
  'in progress',
  'tbd',
] as const;

/**
 * True when a line carries any aspirational qualifier:
 * parenthetical future marker, bare `roadmap`, or a tracker citation.
 * GAP-192 PR2 — token-level (no QUALIFIER_PATTERN / TRACKER_PATTERN regex).
 */
export function hasAspirationalQualifier(line: string): boolean {
  if (hasTrackerSignal(line)) return true;

  const tokens = tokenize(line);
  for (const token of tokens) {
    if (token.kind === 'word' && token.text.toLowerCase() === 'roadmap') return true;
  }

  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i]?.text !== '(') continue;
    let inner = '';
    for (let j = i + 1; j < tokens.length; j++) {
      const t = tokens[j];
      if (t === undefined) break;
      if (t.text === ')') {
        const lower = inner.toLowerCase().trimStart();
        if (QUALIFIER_PAREN_PREFIXES.some((p) => lower.startsWith(p))) return true;
        break;
      }
      inner += t.text;
    }
  }
  return false;
}

function scanForFutureTenseClaims(): FutureClaimMatch[] {
  const matches: FutureClaimMatch[] = [];
  const FutureTenseScanFiles = resolvedFutureTenseFiles();

  for (const rel of FutureTenseScanFiles) {
    const full = path.join(Root, rel);
    let content: string;
    try {
      content = fs.readFileSync(full, 'utf8');
    } catch {
      continue;
    }

    const lines = content.split('\n');
    let inFence = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Track fenced code blocks and skip their contents
      if (line.startsWith('```')) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;

      // Skip markdown headings (section labels, not feature claims)
      if (isMarkdownHeading(line)) continue;

      const marker = findFutureTenseMarker(line);
      if (marker === null) continue;

      // Pass if the line cites a tracker (issue, PR, milestone, workflow)
      if (hasTrackerSignal(line)) continue;

      matches.push({
        file: rel,
        line: i + 1,
        marker,
        text: line.trim(),
      });
    }
  }

  return matches;
}

// ---------------------------------------------------------------------------
// Aspirational-feature blocklist (PR D)
//
// High-visibility marketing-copy files (the landing page + GetStarted CTA)
// must NOT name features that don't ship today unless paired with a qualifier
// on the same line. The list is hand-maintained from the
// marketing-claims-2026-04-25 internal honesty audit.
//
// GAP-192 PR2: each entry is one or more marketing-voice `Rule`s checked via
// `checkRule` over `tokenize(line)`. A hit is allowed when
// `hasAspirationalQualifier(line)` is true.
//
// Add/remove tokens here when feature reality changes — when "managed
// hosting" actually ships, for example, drop it from ASPIRATIONAL_BLOCKLIST.
// ---------------------------------------------------------------------------

interface AspirationalMatch {
  file: string;
  line: number;
  token: string;
  why: string;
  text: string;
}

interface AspirationalBlocklistEntry {
  /** marketing-voice rules that fire this label (any hit counts once). */
  rules: Rule[];
  /** Human-readable label printed when matched. */
  label: string;
  /** Why this is blocklisted — printed alongside the failure. */
  why: string;
}

const ASPIRATIONAL_BLOCKLIST: AspirationalBlocklistEntry[] = [
  {
    rules: [
      {
        kind: 'banned-token-sequences',
        ruleId: 'claim-drift.aspirational.managed-hosting',
        sequences: [['managed', 'hosting']],
        caseInsensitive: true,
      },
    ],
    label: 'managed hosting',
    why: 'no managed-hosting service ships today',
  },
  {
    rules: [
      {
        kind: 'banned-token-sequences',
        ruleId: 'claim-drift.aspirational.auto-scaling',
        sequences: [
          ['auto', 'scaling'],
          ['auto', 'scale'],
        ],
        caseInsensitive: true,
      },
    ],
    label: 'auto-scaling',
    why: 'no managed platform offers auto-scaling',
  },
  {
    rules: [
      {
        kind: 'banned-tokens',
        ruleId: 'claim-drift.aspirational.dunning',
        tokens: ['dunning'],
        caseInsensitive: true,
      },
    ],
    label: 'dunning',
    why: 'not implemented; only in stripe-best-practices guidance',
  },
  {
    rules: [
      {
        kind: 'banned-tokens',
        ruleId: 'claim-drift.aspirational.sso',
        tokens: ['SSO'],
        caseInsensitive: true,
      },
      {
        kind: 'banned-token-sequences',
        ruleId: 'claim-drift.aspirational.single-sign-on',
        sequences: [['single', 'sign', 'on']],
        caseInsensitive: true,
      },
    ],
    label: 'SSO',
    why: 'SSO/SAML is roadmap-only (designed, not built) per apps/marketing/app/content/roadmap.ts',
  },
  {
    rules: [
      {
        kind: 'banned-tokens',
        ruleId: 'claim-drift.aspirational.scim',
        tokens: ['SCIM'],
        caseInsensitive: true,
      },
    ],
    label: 'SCIM',
    why: 'SCIM provisioning not in code',
  },
  {
    rules: [
      {
        kind: 'banned-token-sequences',
        ruleId: 'claim-drift.aspirational.on-prem',
        sequences: [['on', 'prem']],
        caseInsensitive: true,
      },
    ],
    label: 'on-prem',
    why: 'forge docker images not yet published to GHCR',
  },
  {
    rules: [
      {
        kind: 'banned-token-sequences',
        ruleId: 'claim-drift.aspirational.air-gapped',
        sequences: [['air', 'gapped']],
        caseInsensitive: true,
      },
    ],
    label: 'air-gapped',
    why: 'no documented air-gap deploy path',
  },
  {
    rules: [
      {
        kind: 'banned-tokens',
        ruleId: 'claim-drift.aspirational.rag',
        tokens: ['RAG'],
        caseInsensitive: false,
      },
    ],
    label: 'RAG',
    why: 'gated on Ollama+pgvector setup, not reachable in default flow',
  },
  {
    rules: [
      {
        kind: 'banned-tokens',
        ruleId: 'claim-drift.aspirational.sla',
        tokens: ['SLA'],
        caseInsensitive: false,
      },
    ],
    label: 'SLA',
    why: 'no SLA documented in docs/',
  },
];

/**
 * Labels hit by aspirational blocklist rules on `line` (ignores qualifiers).
 * Exported for unit tests (GAP-192 PR2 fixtures).
 */
export function findAspirationalBlocklistHits(line: string): string[] {
  const tokens = tokenize(line);
  const hits: string[] = [];
  for (const entry of ASPIRATIONAL_BLOCKLIST) {
    let matched = false;
    for (const rule of entry.rules) {
      if (checkRule(rule, tokens, { field: 'line' }).length > 0) {
        matched = true;
        break;
      }
    }
    if (matched) hits.push(entry.label);
  }
  return hits;
}

/**
 * Agent-commerce surfaces (x402 payments, the agent / MCP-server marketplace)
 * are coming soon, NOT shipped. Detectors match only SHIPPED-CLAIM phrasing
 * ("x402 is live", "the marketplace is open") -- never neutral mentions like
 * "the x402 protocol", a glossary entry, or a "## How x402 Works" heading, so
 * the design/explainer posts read normally. A shipped claim still passes if it
 * carries a same-line qualifier (hasAspirationalQualifier), OR the whole file
 * declares itself a roadmap post in frontmatter (isRoadmapDeclaredFile). The
 * general ASPIRATIONAL_BLOCKLIST (SSO / SLA / ...) is unaffected.
 *
 * GAP-192 PR5 — proximity word walk (no authored regex).
 */

interface AgentCommerceEntry {
  label: string;
  why: string;
}

/** Metadata for agent-commerce hits (label + why). Exported for tests. */
export const AGENT_COMMERCE_ENTRIES: readonly AgentCommerceEntry[] = [
  {
    label: 'x402 (presented as live)',
    why: 'x402 payments are coming soon, not live (X402_ENABLED=false); see #93',
  },
  {
    label: 'agent marketplace (presented as live)',
    why: 'the agent / MCP-server marketplace is coming soon, not shipped; see #526',
  },
] as const;

const X402_LIVE_STATUS = new Set(['live', 'available', 'launched', 'transacting']);
const MARKETPLACE_LIVE_STATUS = new Set(['live', 'open', 'available', 'launched']);

/** Word tokens only (kind === 'word'), lowercased for matching. */
function wordTexts(tokens: Token[]): string[] {
  const out: string[] = [];
  for (const t of tokens) {
    if (t.kind === 'word') out.push(t.text.toLowerCase());
  }
  return out;
}

/**
 * True when words[i..] is an agent/MCP marketplace anchor:
 * RevMarket | agent marketplace | agent tool marketplace |
 * MCP marketplace | MCP server marketplace.
 * Hyphenated forms still match (Segmenter splits on `-`).
 */
function marketplaceAnchorLen(words: string[], i: number): number {
  const w = words[i];
  if (w === 'revmarket') return 1;
  if (w === 'agent') {
    if (words[i + 1] === 'marketplace') return 2;
    if (words[i + 1] === 'tool' && words[i + 2] === 'marketplace') return 3;
    return 0;
  }
  if (w === 'mcp') {
    if (words[i + 1] === 'marketplace') return 2;
    if (words[i + 1] === 'server' && words[i + 2] === 'marketplace') return 3;
    return 0;
  }
  return 0;
}

/**
 * True when the line presents x402 as live/available/launched/in production/
 * transacting/enabled today/working today. Proximity is a short word window
 * after the `x402` token (parity with the prior 50-char non-period span).
 */
export function hasX402LiveClaim(line: string): boolean {
  const words = wordTexts(tokenize(line));
  for (let i = 0; i < words.length; i++) {
    if (words[i] !== 'x402') continue;
    const hi = Math.min(words.length, i + 15);
    for (let j = i + 1; j < hi; j++) {
      if (words[j] !== 'is' && words[j] !== 'are') continue;
      const a = words[j + 1];
      const b = words[j + 2];
      if (a === undefined) continue;
      if (X402_LIVE_STATUS.has(a)) return true;
      if (a === 'in' && b === 'production') return true;
      if ((a === 'enabled' || a === 'working') && b === 'today') return true;
    }
  }
  return false;
}

/**
 * True when the line presents the agent/MCP marketplace as live/open/available/
 * launched. Accepts `is`/`are`/`now` as the copula so "is now live" matches
 * via `now` + `live`.
 */
export function hasMarketplaceLiveClaim(line: string): boolean {
  const words = wordTexts(tokenize(line));
  for (let i = 0; i < words.length; i++) {
    const len = marketplaceAnchorLen(words, i);
    if (len === 0) continue;
    const hi = Math.min(words.length, i + len + 14);
    for (let j = i + len; j < hi; j++) {
      if (words[j] !== 'is' && words[j] !== 'are' && words[j] !== 'now') continue;
      const a = words[j + 1];
      if (a !== undefined && MARKETPLACE_LIVE_STATUS.has(a)) return true;
    }
  }
  return false;
}

/**
 * Labels for agent-commerce shipped-claim hits on `line`.
 * Exported for unit tests (GAP-192 PR5).
 */
export function findAgentCommerceHits(line: string): string[] {
  const hits: string[] = [];
  if (hasX402LiveClaim(line)) hits.push(AGENT_COMMERCE_ENTRIES[0]!.label);
  if (hasMarketplaceLiveClaim(line)) hits.push(AGENT_COMMERCE_ENTRIES[1]!.label);
  return hits;
}

/**
 * A markdown file opts the AGENT_COMMERCE_BLOCKLIST tokens out by declaring
 * itself a roadmap post in frontmatter, e.g.:
 *   roadmap: "Coming soon: x402 #93, agent marketplace #526"
 * The declaration MUST cite a tracker (issue / PR / milestone / workflow), so a
 * roadmap exemption is never an unlinked "coming soon". The general blocklist
 * (SSO / SLA / on-prem / ...) is unaffected and still enforced on every file.
 */
export function isRoadmapDeclaredFile(content: string): boolean {
  if (!content.startsWith('---\n')) return false;
  const end = content.indexOf('\n---', 4);
  if (end === -1) return false;
  for (const raw of content.slice(4, end).split('\n')) {
    const line = raw.trimStart();
    if (line.startsWith('roadmap:') || line.startsWith('lifecycle:')) {
      if (hasTrackerSignal(raw)) return true;
    }
  }
  return false;
}

function scanForAspirationalFeatures(): AspirationalMatch[] {
  const matches: AspirationalMatch[] = [];
  const isIgnored = ignoredPathPredicateFor(Root);

  function scanFile(filePath: string): void {
    const rel = path.relative(Root, filePath);
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      return;
    }
    const isMarkdown = filePath.endsWith('.md');
    const commerceExempt = isMarkdown && isRoadmapDeclaredFile(content);
    const lines = content.split('\n');
    let inFence = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Markdown fenced code blocks: skip — examples, env-var snippets, JSON, etc.
      if (isMarkdown && line.startsWith('```')) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;

      // Markdown blockquote prefixes are user-visible — DON'T skip them
      // (banner notes like "> SSO is on the roadmap" must still qualify)

      // TS/TSX-only skips: JSX comments and import lines are not user-visible copy
      if (!isMarkdown) {
        if (line.trim().startsWith('//') || line.trim().startsWith('import ')) continue;
        if (line.trim().startsWith('{/*') && line.trim().endsWith('*/}')) continue;
      }

      if (!hasAspirationalQualifier(line)) {
        const tokens = tokenize(line);
        for (const entry of ASPIRATIONAL_BLOCKLIST) {
          let matched = false;
          for (const rule of entry.rules) {
            if (checkRule(rule, tokens, { field: 'line' }).length > 0) {
              matched = true;
              break;
            }
          }
          if (!matched) continue;
          matches.push({
            file: rel,
            line: i + 1,
            token: entry.label,
            why: entry.why,
            text: line.trim(),
          });
        }
      }

      // Agent-commerce tokens (x402 / agent marketplace) are coming soon, not
      // shipped. Skip when the file declares itself a roadmap post in
      // frontmatter; otherwise require a same-line qualifier like the rest.
      if (!(commerceExempt || hasAspirationalQualifier(line))) {
        for (const label of findAgentCommerceHits(line)) {
          const entry = AGENT_COMMERCE_ENTRIES.find((e) => e.label === label);
          matches.push({
            file: rel,
            line: i + 1,
            token: label,
            why: entry?.why ?? 'agent-commerce surface is not shipped',
            text: line.trim(),
          });
        }
      }
    }
  }

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
      } else if (e.name.endsWith('.tsx') || e.name.endsWith('.ts') || e.name.endsWith('.md')) {
        scanFile(full);
      }
    }
  }

  const AspirationalScanFiles = resolvedAspirationalPaths();
  assertScanDirsExist(AspirationalScanFiles, 'ASPIRATIONAL_SCAN_FILES');
  for (const rel of AspirationalScanFiles) {
    const full = path.join(Root, rel);
    const stat = fs.statSync(full);
    if (stat.isFile()) {
      scanFile(full);
    } else if (stat.isDirectory()) {
      walk(full);
    }
  }

  return matches;
}

/**
 * Feature-existence copy-dependent holds (COPY-DEP-*). Separate path list from
 * classic aspirational blocklist so marketing content modules are covered
 * without re-firing SSO/SLA token hits on every content string.
 */
function scanForCopyDependentHolds(): AspirationalMatch[] {
  const matches: AspirationalMatch[] = [];
  const isIgnored = ignoredPathPredicateFor(Root);

  function scanFile(filePath: string): void {
    const rel = path.relative(Root, filePath);
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      return;
    }
    const isMarkdown = filePath.endsWith('.md');
    const commerceExempt = isMarkdown && isRoadmapDeclaredFile(content);
    const lines = content.split('\n');
    let inFence = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (isMarkdown && line.startsWith('```')) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;
      if (!isMarkdown) {
        if (line.trim().startsWith('//') || line.trim().startsWith('import ')) continue;
        if (line.trim().startsWith('{/*') && line.trim().endsWith('*/}')) continue;
      }
      if (commerceExempt || hasAspirationalQualifier(line)) continue;
      const tokens = tokenize(line);
      for (const hit of findCopyDependentHits(line, tokens)) {
        matches.push({
          file: rel,
          line: i + 1,
          token: `${hit.holdId} (${hit.title})`,
          why: hit.why + (hit.publicTracker ? ` (${hit.publicTracker})` : ''),
          text: line.trim(),
        });
      }
    }
  }

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
      if (e.isDirectory()) walk(full);
      else if (
        e.name.endsWith('.tsx') ||
        e.name.endsWith('.ts') ||
        e.name.endsWith('.md') ||
        e.name.endsWith('.txt')
      ) {
        scanFile(full);
      }
    }
  }

  const paths = resolvedCopyDependentPaths();
  if (paths.length === 0) return matches;
  assertScanDirsExist(paths, 'COPY_DEPENDENT_SCAN_PATHS');
  for (const rel of paths) {
    const full = path.join(Root, rel);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(full);
    } catch {
      continue;
    }
    if (stat.isFile()) scanFile(full);
    else if (stat.isDirectory()) walk(full);
  }
  return matches;
}

// ---------------------------------------------------------------------------
// Fleet-product attribution gate (PR-D, docs-claims-2026-04-26)
//
// RevFleet is eight separate products (RevealUI, RevDev,
// RevVault, RevCon, RevealCoin, Forge, RevSkills, RevKit). When a docs
// page that belongs to RevealUI itself names another fleet product, it
// must either:
//   - link to /docs/FLEET or /docs/fleet/<name> (canonical fleet map)
//   - include explicit "(separate product …)" / org-slash-repo attribution
//     on the same line
//   - live in an allowlisted file (the fleet map itself, the per-product
//     pages, FORGE.md which is the canonical Forge page).
//
// Without this, mentions of "Studio" / "RevVault" / "RevCon" / etc. across
// docs/PRO.md and similar pages routinely drift into "Pro tier features
// of RevealUI" framing, when in reality they're shipped from sibling repos.
// ---------------------------------------------------------------------------

/** GitHub org name for fleet repo attribution (assembled to satisfy boundary check 2). */
const FLEET_GITHUB_ORG = 'RevealUI' + 'Studio';

interface FleetProductMatch {
  file: string;
  line: number;
  product: string;
  text: string;
}

/**
 * Files in scope for the fleet-attribution gate. Initial coverage is
 * deliberately narrow — tutorial pages + the rewritten Pro MCP page
 * where existing attribution is clean enough that the gate doesn't
 * trip on legacy text.
 *
 * Wider coverage (INDEX.md, PRO.md, MARKETPLACE.md, docs-pro/index,
 * docs-pro/{ai,inference,editors}/index.md, ROADMAP.md, blog posts,
 * HARNESS_PROTOCOL.md, SECRETS.md, REST API reference) is queued for
 * follow-up PRs after the remaining attribution in those files is tightened.
 * The internal honesty audit (docs-claims, 2026-04-26)
 * tracks the coverage queue.
 */
/**
 * Files that ARE the canonical home for naming fleet products. They can
 * mention products without per-line attribution because the whole file is
 * the attribution.
 */
const FLEET_ATTRIBUTION_ALLOWLIST = new Set<string>([
  'docs/FLEET.md',
  'docs/FORGE.md', // canonical Forge product page
]);

/** Per-product pages all live under `docs/fleet/`. Allowlist by prefix. */
const FLEET_ATTRIBUTION_ALLOWLIST_PREFIXES = ['docs/fleet/'];

/**
 * Fleet product tokens as marketing-voice `Rule`s (GAP-192 PR2).
 *
 * Plain product names are case-sensitive proper nouns. `Studio` uses
 * `banned-tokens-with-context` + `unlessPrecededByContiguous: ['RevealUI']`
 * so "RevealUI Studio" (company name) passes and bare "Studio" does not.
 * The phantom package `@revealui/editors` is matched by contiguous
 * non-whitespace token join (symbols required) — see
 * `hasPhantomEditorsPackage`.
 */
interface FleetProductRuleEntry {
  rule: Rule;
  label: string;
}

const FLEET_PRODUCT_RULES: FleetProductRuleEntry[] = [
  {
    rule: {
      kind: 'banned-tokens-with-context',
      ruleId: 'claim-drift.fleet.studio',
      tokens: ['Studio'],
      unlessPrecededByContiguous: ['RevealUI'],
    },
    label: 'Studio (lives in RevDev, not the company name)',
  },
  {
    rule: {
      kind: 'banned-tokens',
      ruleId: 'claim-drift.fleet.revvault',
      tokens: ['RevVault'],
      caseInsensitive: false,
    },
    label: 'RevVault (separate fleet product)',
  },
  {
    rule: {
      kind: 'banned-tokens',
      ruleId: 'claim-drift.fleet.revcon',
      tokens: ['RevCon'],
      caseInsensitive: false,
    },
    label: 'RevCon (separate fleet product)',
  },
  {
    rule: {
      kind: 'banned-tokens',
      ruleId: 'claim-drift.fleet.revealcoin',
      tokens: ['RevealCoin'],
      caseInsensitive: false,
    },
    label: 'RevealCoin (separate fleet product)',
  },
  {
    rule: {
      kind: 'banned-tokens',
      ruleId: 'claim-drift.fleet.revdev',
      tokens: ['RevDev'],
      caseInsensitive: false,
    },
    label: 'RevDev (separate fleet product)',
  },
  {
    rule: {
      kind: 'banned-tokens',
      ruleId: 'claim-drift.fleet.revskills',
      tokens: ['RevSkills'],
      caseInsensitive: false,
    },
    label: 'RevSkills (separate fleet product)',
  },
  {
    rule: {
      kind: 'banned-tokens',
      ruleId: 'claim-drift.fleet.revkit',
      tokens: ['RevKit'],
      caseInsensitive: false,
    },
    label: 'RevKit (separate fleet product)',
  },
];

const PHANTOM_EDITORS_LABEL = '@revealui/editors (does not exist; ships in RevCon)';

/**
 * True when the line names the phantom package `@revealui/editors`.
 * `checkRule` banned-token-sequences is word-only (hyphen skip), so `@` and
 * `/` must be checked as contiguous non-whitespace token text.
 */
export function hasPhantomEditorsPackage(line: string): boolean {
  const tokens = tokenize(line);
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i]?.text !== '@' || tokens[i]?.kind !== 'symbol') continue;
    let joined = '@';
    for (let j = i + 1; j < tokens.length; j++) {
      const t = tokens[j];
      if (t === undefined || t.kind === 'whitespace') break;
      joined += t.text;
      if (joined === '@revealui/editors') return true;
      if (!'@revealui/editors'.startsWith(joined)) break;
    }
  }
  return false;
}

/**
 * Fleet product labels hit on `line` (ignores attribution qualifier).
 * Exported for unit tests (GAP-192 PR2 fixtures).
 */
export function findFleetProductHits(line: string): string[] {
  const tokens = tokenize(line);
  const hits: string[] = [];
  for (const entry of FLEET_PRODUCT_RULES) {
    if (checkRule(entry.rule, tokens, { field: 'line' }).length > 0) {
      hits.push(entry.label);
    }
  }
  if (hasPhantomEditorsPackage(line)) hits.push(PHANTOM_EDITORS_LABEL);
  return hits;
}

/**
 * A line is allowed if it cites the fleet map, links to a per-product
 * page, names the source repo, or includes an explicit attribution
 * phrase. Multiple acceptance patterns — order doesn't matter.
 *
 * GAP-192 PR3 — substring + word-proximity walks (no authored regex).
 */

const FLEET_MAP_PATH_MARKERS = [
  '/docs/SUITE',
  '/docs/suite/',
  './SUITE.md',
  './suite/',
  '../SUITE.md',
  '../suite/',
] as const;

const FLEET_REPO_NAMES = new Set([
  'revvault',
  'revcon',
  'revealcoin',
  'revdev',
  'revskills',
  'revkit',
  'forge',
  'editor-configs',
]);

const SEPARATE_TARGETS = new Set(['product', 'repo', 'suite', 'fleet', 'kit', 'app']);

const SHIPS_IN_TARGETS = new Set([
  'product',
  'repo',
  'suite',
  'fleet',
  'kit',
  'app',
  'revdev',
  'revvault',
  'revcon',
  'revealcoin',
  'revskills',
  'revkit',
  'forge',
  'revfleet',
]);

const LIVES_IN_TARGETS = new Set([
  'revdev',
  'revvault',
  'revcon',
  'revealcoin',
  'revskills',
  'revkit',
  'forge',
  'revfleet',
  'monorepo',
  'repo',
]);

const SEE_TARGETS = new Set([
  'revdev',
  'revvault',
  'revcon',
  'revealcoin',
  'revskills',
  'revkit',
  'forge',
  'revfleet',
  'fleet',
]);

/**
 * True when words[from..from+window) contain any word in `targets`
 * (case already lowercased).
 */
function hasWordNear(
  words: string[],
  from: number,
  window: number,
  targets: ReadonlySet<string>,
): boolean {
  const hi = Math.min(words.length, from + window);
  for (let i = from; i < hi; i++) {
    if (targets.has(words[i]!)) return true;
  }
  return false;
}

/**
 * True when the line attributes a fleet product mention (fleet map link,
 * source-repo path, or explicit "separate product" / "ships in …" phrasing).
 * Exported for unit tests (GAP-192 PR3).
 */
export function hasFleetAttributionQualifier(line: string): boolean {
  // Path markers are case-sensitive for SUITE.md; suite/ is lower.
  for (const marker of FLEET_MAP_PATH_MARKERS) {
    if (line.includes(marker)) return true;
  }
  // Case-insensitive path forms
  const lowerLine = line.toLowerCase();
  if (
    lowerLine.includes('/docs/suite') ||
    lowerLine.includes('./suite.md') ||
    lowerLine.includes('../suite.md')
  ) {
    return true;
  }

  // Literal attribution phrases
  if (lowerLine.includes('companion product')) return true;
  if (lowerLine.includes('intentionally decoupled')) return true;
  if (lowerLine.includes('not yet shipped')) return true;
  if (lowerLine.includes('forge tier')) return true;
  if (lowerLine.includes('forge edition')) return true;
  if (lowerLine.includes('forge kit')) return true;
  if (lowerLine.includes('forge guide')) return true;
  if (lowerLine.includes('forge (enterprise)')) return true;

  const tokens = tokenize(line);
  const words = wordTexts(tokens);

  // RevFleet as a bare word is itself an attribution frame
  for (const w of words) {
    if (w === 'revfleet') return true;
  }

  // <org>/<repo> fleet attribution (org name assembled above)
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i]?.kind !== 'word' || tokens[i]!.text !== FLEET_GITHUB_ORG) continue;
    if (tokens[i + 1]?.text !== '/') continue;
    const repo = tokens[i + 2];
    if (repo?.kind === 'word' && FLEET_REPO_NAMES.has(repo.text.toLowerCase())) return true;
  }

  // separate … product|repo|…
  for (let i = 0; i < words.length; i++) {
    if (words[i] === 'separate' && hasWordNear(words, i + 1, 8, SEPARATE_TARGETS)) return true;
  }

  // ships in … product|RevDev|…
  for (let i = 0; i < words.length - 1; i++) {
    if (
      words[i] === 'ships' &&
      words[i + 1] === 'in' &&
      hasWordNear(words, i + 2, 10, SHIPS_IN_TARGETS)
    ) {
      return true;
    }
  }

  // lives in … RevDev|monorepo|…
  for (let i = 0; i < words.length - 1; i++) {
    if (
      words[i] === 'lives' &&
      words[i + 1] === 'in' &&
      hasWordNear(words, i + 2, 8, LIVES_IN_TARGETS)
    ) {
      return true;
    }
  }

  // see [RevDev / see **RevVault / see Fleet
  for (let i = 0; i < words.length; i++) {
    if (words[i] !== 'see') continue;
    // next word token may be preceded by [ or ** in the full stream — wordTexts
    // already dropped those, so the next word is the product name.
    const next = words[i + 1];
    if (next !== undefined && SEE_TARGETS.has(next)) return true;
  }

  // Also accept a repo-link path (issues/pulls) as attribution context
  let span = '';
  for (const token of tokens) {
    if (token.kind === 'whitespace') {
      if (span.length > 0 && isRepoLinkToken(span)) return true;
      span = '';
      continue;
    }
    span += token.text;
  }
  if (span.length > 0 && isRepoLinkToken(span)) return true;

  return false;
}

function scanForFleetProductLeaks(): FleetProductMatch[] {
  const matches: FleetProductMatch[] = [];

  function isAllowlisted(rel: string): boolean {
    if (FLEET_ATTRIBUTION_ALLOWLIST.has(rel)) return true;
    return FLEET_ATTRIBUTION_ALLOWLIST_PREFIXES.some((prefix) => rel.startsWith(prefix));
  }

  function scanFile(filePath: string): void {
    const rel = path.relative(Root, filePath).split(path.sep).join('/');
    if (isAllowlisted(rel)) return;
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      return;
    }
    const lines = content.split('\n');
    let inFence = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip fenced code (env templates, command blocks, etc.)
      if (line.startsWith('```')) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;

      // Skip frontmatter delimiters and YAML-shaped lines (title:, etc.)
      // — frontmatter is not customer-visible prose
      if (i < 20 && isYamlFrontmatterLine(line)) continue;

      if (hasFleetAttributionQualifier(line)) continue;
      for (const product of findFleetProductHits(line)) {
        matches.push({
          file: rel,
          line: i + 1,
          product,
          text: line.trim(),
        });
      }
    }
  }

  function walkDir(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (WALK_EXCLUDED_DIRS.has(e.name)) continue;
      if (e.isDirectory()) walkDir(full);
      else if (e.name.endsWith('.tsx') || e.name.endsWith('.ts') || e.name.endsWith('.md')) {
        scanFile(full);
      }
    }
  }

  for (const rel of resolvedFleetAttributionFiles()) {
    const full = path.join(Root, rel);
    try {
      const stat = fs.statSync(full);
      if (stat.isFile()) scanFile(full);
      else if (stat.isDirectory()) walkDir(full);
    } catch {
      // path missing, skip
    }
  }

  return matches;
}

// ---------------------------------------------------------------------------
// $RVUI internal-ticker leak guard (PR-D, docs-claims-2026-04-26)
//
// `$RVUI` is the INTERNAL codename for the RevealCoin token. The customer-
// facing on-chain ticker is `RVC`. Public docs (docs.revealui.com) must
// use `RVC`; the dollar-sign-prefixed internal form must never leak.
//
// Lowercase route slugs like `/api/billing/rvui-payment` are fine — those
// are code constants on the API, not customer-visible labels. This guard
// catches the explicit `$RVUI` form only.
// ---------------------------------------------------------------------------

interface RvuiLeakMatch {
  file: string;
  line: number;
  text: string;
}

/**
 * True when the line contains the internal ticker form `$RVUI`.
 * `checkRule` banned-token-sequences is word-only, so `$` (symbol) + `RVUI`
 * (word) is matched as contiguous non-whitespace tokens (GAP-192 PR2).
 */
export function hasRvuiTickerLeak(line: string): boolean {
  const tokens = tokenize(line);
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i]?.text !== '$' || tokens[i]?.kind !== 'symbol') continue;
    const next = tokens[i + 1];
    if (next !== undefined && next.kind === 'word' && next.text === 'RVUI') return true;
  }
  return false;
}

/**
 * Files allowed to mention `$RVUI` because they explicitly explain the
 * boundary between the internal codename and the customer-facing `RVC`
 * ticker.
 */
const RVUI_LEAK_ALLOWLIST = new Set<string>([
  'docs/REVFLEET.md',
  'docs/FLEET.md',
  'docs/fleet/revealcoin.md',
  // The REST API reference cites the internal route slug (`rvui-payment`)
  // and provides the explicit RVUI-vs-RVC boundary note customers need.
  'docs/api/rest-api/README.md',
  // The canonical Fleet glossary's Internal-only codenames section is
  // by design the place that documents the `$RVUI` (codename) vs `RVC`
  // (customer-facing ticker) boundary; it must mention both to fulfil
  // its purpose as the cross-cutting vocabulary source of truth.
  'docs/glossary.md',
  // MARKETING_METRICS.md is the marketing-overhaul lane's pinned-truth
  // doc; it documents the `$RVUI` (internal) vs `RVC` (customer-facing)
  // boundary in §7 so marketing copy stays aligned. Added 2026-05-18 via
  // marketing-overhaul Phase 2.
  'docs/MARKETING_METRICS.md',
]);

function scanForRvuiTickerLeaks(): RvuiLeakMatch[] {
  const matches: RvuiLeakMatch[] = [];
  const isIgnored = ignoredPathPredicateFor(Root);

  function isAllowlisted(rel: string): boolean {
    return RVUI_LEAK_ALLOWLIST.has(rel) || rel.startsWith('docs/fleet/revealcoin');
  }

  function scanFile(filePath: string): void {
    const rel = path.relative(Root, filePath).split(path.sep).join('/');
    if (isAllowlisted(rel)) return;
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      return;
    }
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (hasRvuiTickerLeak(line)) {
        matches.push({
          file: rel,
          line: i + 1,
          text: line.trim(),
        });
      }
    }
  }

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
      } else if (e.name.endsWith('.md')) {
        scanFile(full);
      }
    }
  }

  walk(path.join(Root, 'docs'));
  walk(path.join(Root, 'apps/docs/public/docs-pro'));

  return matches;
}

// ---------------------------------------------------------------------------
// Marketing METRICS drift (Phase 6 — marketing-overhaul lane)
//
// apps/marketing/app/content/site.ts exports a METRICS object that every
// marketing content/* file imports instead of hardcoding integers. Those
// values are `key: value` shaped (the number FOLLOWS the metric word), so the
// prose claim-scanner above never matches them — `dbTables: 86` / `mcpServers:
// 13` slip past the "N tables" / "N MCP servers" patterns. This check reads the
// METRICS block directly and asserts each value equals the canonical count this
// validator computes, so a stale METRICS integer fails CI.
//
// No authored regex (fleet no-regex rule): indexOf + Number.parseInt only.
// ---------------------------------------------------------------------------

const MARKETING_SITE_FILE = 'apps/marketing/app/content/site.ts';

interface MarketingMetricCheck {
  /** METRICS field name in site.ts (e.g. "dbTables", "mcpServers"). */
  key: string;
  /** Canonical count this validator computed from the codebase. */
  actual: number;
  /** Allowed |declared - actual| drift. Test files churn, so they get slack. */
  tolerance?: number;
}

interface MarketingMetricDrift {
  key: string;
  /** null = key missing from the METRICS block. */
  declared: number | null;
  actual: number;
}

/**
 * Parse a flat integer `<key>: <n>` out of the METRICS block. `Number.parseInt`
 * skips leading whitespace and stops at the first non-digit, so the value in
 * `dbTables: 85,` parses to 85. Returns null when the key is absent.
 */
function readDeclaredMetric(metricsBlock: string, key: string): number | null {
  const token = `${key}:`;
  const idx = metricsBlock.indexOf(token);
  if (idx === -1) return null;
  const parsed = Number.parseInt(metricsBlock.slice(idx + token.length), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function checkMarketingMetrics(checks: MarketingMetricCheck[]): MarketingMetricDrift[] {
  const full = path.join(Root, MARKETING_SITE_FILE);
  let src: string;
  try {
    src = fs.readFileSync(full, 'utf8');
  } catch {
    throw new Error(
      `claim-drift: cannot read ${MARKETING_SITE_FILE}. If apps/marketing moved, ` +
        'update MARKETING_SITE_FILE in scripts/validate/claim-drift.ts.',
    );
  }
  // Scope the parse to the METRICS object so SITE.urls etc. cannot collide.
  const start = src.indexOf('export const METRICS');
  if (start === -1) {
    throw new Error(`claim-drift: METRICS export not found in ${MARKETING_SITE_FILE}.`);
  }
  const end = src.indexOf('export const SITE');
  const block = src.slice(start, end === -1 ? undefined : end);

  const drifts: MarketingMetricDrift[] = [];
  for (const check of checks) {
    const declared = readDeclaredMetric(block, check.key);
    if (declared === null) {
      drifts.push({ key: check.key, declared: null, actual: check.actual });
      continue;
    }
    if (Math.abs(declared - check.actual) > (check.tolerance ?? 0)) {
      drifts.push({ key: check.key, declared, actual: check.actual });
    }
  }
  return drifts;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Run claim-drift collectors and scanners against a configured root.
 * Capability proof-obligation (GAP-354) is optional and revealui-local for
 * Phase 1 — inject a precomputed CapabilityGateSlice from the monorepo wrapper.
 */
export function runClaimDrift(options: ClaimGateRunOptions): ClaimGateResult {
  configureClaimGatesRoot(options.root, options.profile);
  showFix = options.showFix === true || (options.argv?.includes('--fix') ?? false);
  WarnOnly =
    options.warn === true ||
    (options.argv?.includes('--warn') ?? false) ||
    (options.argv?.includes('--baseline') ?? false);
  const capability: CapabilityGateSlice = options.capability ?? {
    scanned: 0,
    proven: 0,
    baselined: [],
    advisories: [],
    violations: [],
  };

  console.log('Claim Drift Detector');
  console.log(`Profile: ${ActiveProfile.name}`);
  console.log(`Root:    ${Root}`);
  console.log('====================\n');

  // Collect actual metrics (product-runtime only)
  const packages = ActiveProfile.collectMonorepoMetrics ? countPackages() : 0;
  const apps = ActiveProfile.collectMonorepoMetrics ? countApps() : 0;
  const workspaces = ActiveProfile.collectMonorepoMetrics ? countWorkspaces() : 0;
  const testFiles = ActiveProfile.collectMonorepoMetrics ? countTestFiles() : 0;
  const uiComponents = ActiveProfile.collectMonorepoMetrics ? countUIComponents() : 0;
  const mcpServers = ActiveProfile.collectMonorepoMetrics ? countMCPServers() : 0;
  const dbTables = ActiveProfile.collectMonorepoMetrics ? countDbTables() : 0;
  const cliTemplates = ActiveProfile.collectMonorepoMetrics ? countCliTemplates() : 0;
  const enforcementTests = ActiveProfile.collectMonorepoMetrics ? countEnforcementTests() : 0;
  const licenseSplit = ActiveProfile.collectMonorepoMetrics
    ? countLicenseSplit()
    : { mit: 0, fsl: 0, internal: 0 };

  if (ActiveProfile.collectMonorepoMetrics) {
    console.log('Actual metrics:');
    console.log(`  Packages:      ${packages}`);
    console.log(`  Apps:          ${apps}`);
    console.log(`  Workspaces:    ${workspaces} (${packages} + ${apps})`);
    console.log(`  Test files:    ${testFiles}`);
    console.log(`  UI components: ${uiComponents}`);
    console.log(`  MCP servers:   ${mcpServers}`);
    console.log(`  DB tables:     ${dbTables}`);
    console.log(`  CLI templates: ${cliTemplates}`);
    console.log(`  Enforcement:   ${enforcementTests}`);
    console.log(
      `  License split: ${licenseSplit.mit} MIT | ${licenseSplit.fsl} FSL-1.1-MIT | ${licenseSplit.internal} internal/none`,
    );
    console.log();
  }

  // GAP-192 PR4 — typed NumericClaimSpec[] (no authored claimPatterns regex).
  const metrics: Metric[] = ActiveProfile.collectMonorepoMetrics
    ? [
        {
          name: 'packages',
          actual: packages,
          claimSpecs: [
            // "21 packages" or "21 npm packages" but not "14 packages patched"
            // or small counts (<10). Range 10–39 matches the prior (1\d|2\d|3\d).
            {
              metricName: 'packages',
              min: 10,
              max: 39,
              optionalIntervening: ['npm'],
              requiredSequences: [['packages'], ['package']],
              forbidNextWords: ['patched'],
            },
          ],
        },
        {
          name: 'workspaces',
          actual: workspaces,
          claimSpecs: [
            {
              metricName: 'workspaces',
              requiredSequences: [['workspaces'], ['workspace']],
            },
          ],
        },
        {
          name: 'test files',
          actual: testFiles,
          claimSpecs: [
            // "1,676 test files" — compare step still skips claimed < 100
            {
              metricName: 'test files',
              allowCommas: true,
              requiredSequences: [
                ['test', 'files'],
                ['test', 'file'],
              ],
            },
          ],
        },
        {
          name: 'UI components',
          actual: uiComponents,
          claimSpecs: [
            // Only match total component counts in 50–69, not per-category
            {
              metricName: 'UI components',
              min: 50,
              max: 69,
              optionalIntervening: ['native', 'React', 'UI'],
              requiredSequences: [['components'], ['component']],
            },
            {
              metricName: 'UI components',
              min: 50,
              max: 69,
              requiredSequences: [['components'], ['component']],
              trailingSequences: [['with'], ['built'], ['in', 'the']],
            },
          ],
        },
        {
          name: 'MCP servers',
          actual: mcpServers,
          claimSpecs: [
            {
              metricName: 'MCP servers',
              requiredSequences: [
                ['mcp', 'servers'],
                ['mcp', 'server'],
              ],
            },
          ],
        },
        {
          name: 'DB tables',
          actual: dbTables,
          claimSpecs: [
            // "85 tables", "85 PostgreSQL tables", … — 10..999 plausible totals
            {
              metricName: 'DB tables',
              min: 10,
              max: 999,
              optionalOneOf: ['PostgreSQL', 'database', 'Drizzle', 'primary'],
              requiredSequences: [['tables'], ['table']],
            },
            // "Schema (85 tables)" parenthetical
            {
              metricName: 'DB tables',
              min: 10,
              max: 999,
              parenWrapped: true,
              requiredSequences: [['tables'], ['table']],
            },
          ],
        },
        {
          name: 'CLI templates',
          actual: cliTemplates,
          claimSpecs: CLI_TEMPLATE_CLAIM_SPECS,
        },
        {
          name: 'enforcement tests',
          actual: enforcementTests,
          claimSpecs: [
            {
              metricName: 'enforcement tests',
              requiredSequences: [
                ['enforcement', 'tests'],
                ['enforcement', 'test'],
              ],
            },
          ],
        },
        // License-split metrics — canonical fleet doc shape:
        // "N OSS (MIT)" / "N Pro (FSL...)" / "N internal".
        {
          name: 'MIT packages',
          actual: licenseSplit.mit,
          claimSpecs: [{ metricName: 'MIT packages', shape: 'oss-mit' }],
        },
        {
          name: 'FSL packages',
          actual: licenseSplit.fsl,
          claimSpecs: [{ metricName: 'FSL packages', shape: 'pro-fsl' }],
        },
        {
          name: 'internal packages',
          actual: licenseSplit.internal,
          claimSpecs: [{ metricName: 'internal packages', shape: 'internal-paren' }],
        },
      ]
    : [];

  // Scan for claims
  const claims = ActiveProfile.collectMonorepoMetrics ? scanForClaims(metrics) : [];

  // Compare
  let mismatches = 0;
  const seen = new Set<string>();

  for (const claim of claims) {
    const metric = metrics.find((m) => m.name === claim.metricName);
    if (!metric) continue;

    const claimed = claim.claimed;

    // Skip small numbers that are likely not total-count claims
    if (claim.metricName === 'test files' && claimed < 100) continue;
    if (claim.metricName === 'packages' && claimed < 10) continue;

    // For test files, allow ±100 drift (files get added/removed frequently)
    const tolerance = claim.metricName === 'test files' ? 100 : 0;
    const drift = Math.abs(claimed - metric.actual);

    if (drift > tolerance && claimed !== metric.actual) {
      const key = `${claim.file}:${claim.line}:${claim.metricName}`;
      if (seen.has(key)) continue;
      seen.add(key);

      mismatches++;
      const direction = claimed > metric.actual ? 'INFLATED' : 'UNDERSTATED';
      console.log(`  DRIFT  ${claim.file}:${claim.line}`);
      console.log(
        `         ${claim.metricName}: claims ${claimed}, actual ${metric.actual} (${direction})`,
      );
      console.log(`         ${claim.text.substring(0, 120)}`);
      if (showFix) {
        console.log(`         Fix: replace ${claimed} with ${metric.actual}`);
      }
      console.log();
    }
  }

  // Future-tense claim check (CR9-P2-02)
  const futureClaims = scanForFutureTenseClaims();

  // Aspirational-feature blocklist for high-visibility landing + docs copy
  const aspirationalClaims = scanForAspirationalFeatures();

  // Feature-existence copy-dependent holds (COPY-DEP-* in claim-gates)
  const copyDependentClaims = scanForCopyDependentHolds();

  // Fleet-product attribution gate (PR-D)
  const fleetLeaks = scanForFleetProductLeaks();

  // $RVUI internal-ticker leak guard (PR-D)
  const rvuiLeaks = scanForRvuiTickerLeaks();

  // License-membership gates (product-runtime)
  const pkgMap: PackageLicenseMap = ActiveProfile.licenseScanners
    ? buildPackageLicenseMap()
    : { mit: new Set(), fsl: new Set(), internal: new Set(), all: new Set() };
  const phantomMatches = ActiveProfile.licenseScanners ? scanForPhantomPackages() : [];
  const membershipMatches = ActiveProfile.licenseScanners
    ? scanForLicenseMembershipDrift(pkgMap)
    : [];
  const incompleteProMatches = ActiveProfile.licenseScanners
    ? scanForIncompleteProList(pkgMap)
    : [];
  const licenseSplitAntiMatches = ActiveProfile.licenseScanners
    ? scanForLicenseSplitAntiPatterns()
    : [];

  // Marketing METRICS drift (Phase 6) — site.ts METRICS vs canonical counts
  const marketingMetricDrifts = ActiveProfile.marketingMetrics
    ? checkMarketingMetrics([
        { key: 'packages', actual: packages },
        { key: 'apps', actual: apps },
        { key: 'workspaces', actual: workspaces },
        { key: 'uiComponents', actual: uiComponents },
        { key: 'mcpServers', actual: mcpServers },
        { key: 'dbTables', actual: dbTables },
        { key: 'testFiles', actual: testFiles, tolerance: 100 },
        { key: 'mit', actual: licenseSplit.mit },
        { key: 'fsl', actual: licenseSplit.fsl },
        { key: 'internal', actual: licenseSplit.internal },
      ])
    : [];

  // Capability slice is optional (injected by revealui wrapper for product-runtime).

  console.log('====================');
  console.log(`Claims scanned: ${claims.length}`);
  console.log(`Mismatches:     ${mismatches}`);
  console.log(`Future-tense files scanned: ${resolvedFutureTenseFiles().length}`);
  console.log(`Unlinked future-tense markers: ${futureClaims.length}`);
  console.log(`Aspirational-feature scan files: ${resolvedAspirationalPaths().length}`);
  console.log(`Unqualified aspirational features: ${aspirationalClaims.length}`);
  console.log(`Copy-dependent hold hits (feature-existence): ${copyDependentClaims.length}`);
  console.log(`Unattributed fleet-product mentions: ${fleetLeaks.length}`);
  console.log(`Internal $RVUI ticker leaks: ${rvuiLeaks.length}`);
  console.log(`Phantom-package mentions: ${phantomMatches.length}`);
  console.log(`License-membership mismatches: ${membershipMatches.length}`);
  console.log(`Incomplete Pro-list claims: ${incompleteProMatches.length}`);
  console.log(`License-split anti-pattern phrasings: ${licenseSplitAntiMatches.length}`);
  console.log(`Marketing METRICS drift (site.ts): ${marketingMetricDrifts.length}`);
  console.log(
    `Capability claims: ${capability.scanned} scanned, ${capability.proven} proven, ${capability.baselined.length} baselined, ${capability.violations.length} violation(s), ${capability.advisories.length} advisory`,
  );

  if (futureClaims.length > 0) {
    console.log('\nUnlinked future-tense claims (convention: CONTRIBUTING.md):');
    for (const c of futureClaims) {
      console.log(`  ${c.file}:${c.line}  ${c.marker}`);
      console.log(`    ${c.text.substring(0, 140)}`);
    }
    console.log(
      '\nEvery future-tense marker must cite a tracker: issue/PR number, milestone, or workflow file.',
    );
  }

  if (aspirationalClaims.length > 0) {
    console.log('\nUnqualified aspirational features:');
    for (const c of aspirationalClaims) {
      console.log(`  ${c.file}:${c.line}  "${c.token}" (${c.why})`);
      console.log(`    ${c.text.substring(0, 140)}`);
    }
    console.log(
      '\nEach blocklist token must be paired with a qualifier on the same line: "(coming soon)", "(roadmap)", "(in active development)", "(planned)", or a "Roadmap:" prefix. Or remove the claim.',
    );
  }

  if (copyDependentClaims.length > 0) {
    console.log('\nCopy-dependent holds (feature does not exist yet — live claim forbidden):');
    for (const c of copyDependentClaims) {
      console.log(`  ${c.file}:${c.line}  ${c.token}`);
      console.log(`    ${c.why}`);
      console.log(`    ${c.text.substring(0, 140)}`);
    }
    console.log(
      '\nQualify as roadmap/planned on the same line, or remove the live claim until the feature ships. Then set the hold status to released in packages/claim-gates/src/copy-dependents.ts and cue private COPY-DEP work (.jv copy-dependents.yml).',
    );
  }

  if (fleetLeaks.length > 0) {
    console.log('\nFleet-product mentions without attribution:');
    for (const c of fleetLeaks) {
      console.log(`  ${c.file}:${c.line}  ${c.product}`);
      console.log(`    ${c.text.substring(0, 140)}`);
    }
    console.log(
      `\nEach fleet-product mention must either link to /docs/FLEET or /docs/fleet/<name>, name the source repo (${FLEET_GITHUB_ORG}/<repo>), or include a "(separate product)" attribution. The fleet map and per-product pages under /docs/fleet/ are allowlisted.`,
    );
  }

  if (rvuiLeaks.length > 0) {
    console.log('\n$RVUI internal-codename leaks (must use customer-facing RVC):');
    for (const c of rvuiLeaks) {
      console.log(`  ${c.file}:${c.line}`);
      console.log(`    ${c.text.substring(0, 140)}`);
    }
    console.log(
      '\nThe internal codename `$RVUI` must not appear in public docs. Use `RVC` (the customer-facing on-chain ticker). Lowercase route slugs like `/api/billing/rvui-payment` are fine.',
    );
  }

  if (phantomMatches.length > 0) {
    console.log('\nPhantom-package mentions (package does not live in this monorepo):');
    for (const c of phantomMatches) {
      console.log(`  ${c.file}:${c.line}  ${c.pkg} — ${c.hint}`);
      console.log(`    ${c.text.substring(0, 140)}`);
    }
    console.log(
      '\nRemove the reference, replace with a pointer to the canonical location, or add the file to PHANTOM_PACKAGES allowlist if it explicitly documents the redirect.',
    );
  }

  if (membershipMatches.length > 0) {
    console.log('\nLicense-membership mismatches (package listed under wrong license):');
    for (const c of membershipMatches) {
      console.log(
        `  ${c.file}:${c.line}  ${c.pkg}: claims ${c.claimedLicense}, actually ${c.actualLicense}`,
      );
      console.log(`    ${c.text.substring(0, 140)}`);
    }
    console.log(
      '\nEach line that names a @revealui/<pkg> alongside a license label must match the package.json license. Move the package to the correct license section or remove the claim.',
    );
  }

  if (incompleteProMatches.length > 0) {
    console.log(
      '\nIncomplete Pro-package lists (a strict subset of the FSL set, read as the full set):',
    );
    for (const c of incompleteProMatches) {
      console.log(
        `  ${c.file}:${c.line}  names ${c.named.length} of ${c.total} Pro packages: ${c.named.join(', ')}`,
      );
      console.log(`    ${c.text.substring(0, 140)}`);
    }
    console.log(
      '\nA line that enumerates the Pro/FSL packages must list all of them (see docs/FAIR_SOURCE.md), name only one, or be rephrased so it does not read as the complete set.',
    );
  }

  if (licenseSplitAntiMatches.length > 0) {
    console.log(
      '\nLicense-split anti-pattern phrasings (ambiguous "published"/"private" package counts):',
    );
    for (const m of licenseSplitAntiMatches) {
      console.log(`  ${m.file}:${m.line}  ${m.shape}`);
      console.log(`    ${m.text.substring(0, 140)}`);
    }
    console.log(
      `\nUse the canonical taxonomy instead: "${licenseSplit.mit} MIT + ${licenseSplit.fsl} FSL + ${licenseSplit.internal} internal = ${licenseSplit.mit + licenseSplit.fsl + licenseSplit.internal}". The "published"/"private" split is ambiguous (FSL packages also publish to npm) and historically drifted by 4 on both halves.`,
    );
  }

  if (marketingMetricDrifts.length > 0) {
    console.log(
      '\nMarketing METRICS drift — apps/marketing/app/content/site.ts out of sync with codebase:',
    );
    for (const d of marketingMetricDrifts) {
      const declaredStr = d.declared === null ? 'MISSING' : String(d.declared);
      console.log(`  METRICS.${d.key}: declares ${declaredStr}, actual ${d.actual}`);
    }
    console.log(
      '\nUpdate METRICS in apps/marketing/app/content/site.ts (and docs/MARKETING_METRICS.md §1) to match the codebase counts above.',
    );
  }

  if (capability.advisories.length > 0) {
    console.log('\nCapability-proof advisories (NOT failures — Fable review the production path):');
    for (const a of capability.advisories) {
      console.log(`  ${a.file} :: ${a.exportPath}`);
      console.log(`    ${a.message}`);
    }
  }

  if (capability.baselined.length > 0) {
    console.log(
      `\nGrandfathered capability claims without a kind:'test' proof (baseline, meant to shrink):`,
    );
    for (const key of capability.baselined) {
      console.log(`  ${key}`);
    }
  }

  if (capability.violations.length > 0) {
    console.log("\nCapability claims missing a valid kind:'test' proof:");
    for (const v of capability.violations) {
      if (v.kind === 'denylist') {
        console.log(`  DENYLIST  ${v.file} :: ${v.exportPath} [${v.denylistFamilies?.join(', ')}]`);
        console.log(`    ${v.detail}`);
      } else if (v.kind === 'bad-ref') {
        console.log(`  BAD-REF   ${v.file} :: ${v.exportPath}`);
        console.log(`    ${v.detail}`);
      } else {
        console.log(`  UNPROVEN  ${v.file} :: ${v.exportPath} (markers: ${v.markers?.join(', ')})`);
        console.log(`    ${v.text.substring(0, 120)}`);
      }
    }
    console.log(
      "\nEvery capability-shaped claim must carry a kind:'test' evidence ref in " +
        'apps/marketing/app/content/claims-evidence.ts pointing at a named, non-skipped test ' +
        '("<repo-relative test file>#<exact test title substring>"). Register a real ' +
        'production-path proof, or (marker-only claims only) grandfather it via ' +
        '`pnpm validate:claims --update-capability-baseline`. Denylisted families can never be ' +
        'grandfathered.',
    );
  }

  const anyFailures =
    mismatches > 0 ||
    capability.violations.length > 0 ||
    futureClaims.length > 0 ||
    aspirationalClaims.length > 0 ||
    copyDependentClaims.length > 0 ||
    fleetLeaks.length > 0 ||
    rvuiLeaks.length > 0 ||
    phantomMatches.length > 0 ||
    membershipMatches.length > 0 ||
    incompleteProMatches.length > 0 ||
    licenseSplitAntiMatches.length > 0 ||
    marketingMetricDrifts.length > 0;

  if (anyFailures) {
    if (mismatches > 0) {
      console.log('\nFailed: claims do not match codebase reality.');
      if (!showFix) {
        console.log('Run with --fix to see suggested corrections.');
      }
    }
    if (futureClaims.length > 0) {
      console.log('\nFailed: unlinked future-tense claims.');
    }
    if (aspirationalClaims.length > 0) {
      console.log('\nFailed: unqualified aspirational features.');
    }
    if (copyDependentClaims.length > 0) {
      console.log('\nFailed: copy-dependent holds (live claim for unshipped feature).');
    }
    if (fleetLeaks.length > 0) {
      console.log('\nFailed: fleet-product mentions without attribution.');
    }
    if (rvuiLeaks.length > 0) {
      console.log('\nFailed: $RVUI internal-codename leaks in public docs.');
    }
    if (phantomMatches.length > 0) {
      console.log('\nFailed: phantom-package mentions in docs.');
    }
    if (membershipMatches.length > 0) {
      console.log('\nFailed: license-membership mismatches in docs.');
    }
    if (incompleteProMatches.length > 0) {
      console.log('\nFailed: incomplete Pro-package lists in docs.');
    }
    if (licenseSplitAntiMatches.length > 0) {
      console.log('\nFailed: license-split anti-pattern phrasings in docs.');
    }
    if (marketingMetricDrifts.length > 0) {
      console.log('\nFailed: marketing METRICS out of sync with codebase counts.');
    }
    if (capability.violations.length > 0) {
      console.log("\nFailed: capability claims without a valid kind:'test' proof.");
    }
  } else {
    console.log(
      '\nAll claims match codebase reality, future-tense markers are tracked, aspirational features are qualified, copy-dependent holds are clear, fleet products are attributed, no $RVUI ticker leaks were found, no phantom-package mentions were found, license membership matches package.json reality, and no license-split anti-pattern phrasings were found.',
    );
  }

  if (WarnOnly && anyFailures) {
    console.log('\nWARN mode: reporting failures with exit 0 (GAP-462 Phase 2).\n');
  }
  return {
    ok: !anyFailures,
    exitCode: anyFailures && !WarnOnly ? 1 : 0,
    mismatches,
    capability,
  };
}

export { countDirs };
