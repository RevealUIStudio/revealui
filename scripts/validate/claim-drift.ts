// console-allowed
/**
 * Claim Drift Detector
 *
 * Counts real codebase metrics (packages, apps, MCP servers, test files,
 * UI components, tables) and compares them against claims in docs and
 * marketing files. Fails on mismatch so CI catches inflated numbers.
 *
 * Usage:
 *   pnpm tsx scripts/validate/claim-drift.ts
 *   pnpm tsx scripts/validate/claim-drift.ts --fix   # show suggested fixes
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

const ROOT = path.resolve(import.meta.dirname, '../..');
const showFix = process.argv.includes('--fix');

// ---------------------------------------------------------------------------
// Walker exclusions
//
// Two layers keep stale local artifacts from skewing local validator runs vs
// the clean checkout CI sees (incident 2026-06-11: a stale opensrc/ cache
// held 53 third-party *.test.ts files, inflating countTestFiles() from 961
// to 1014 — past the ±100 testFiles tolerance — so the local gate
// hard-failed while CI stayed green):
//
// 1. WALK_EXCLUDED_DIRS — directory NAMES the walkers below must never
//    enter, matched per entry at any depth. This is the only protection when
//    git is unavailable, so every gitignored artifact directory name that
//    can hold walker-matchable files (.ts/.tsx/.md/.txt/.json/.sh) still
//    belongs here. Keep entries in sync with .gitignore: the unit tests
//    assert every entry except .git has a covering .gitignore line AND that
//    no entry shadows git-tracked files (e.g. screenshots/ is gitignored yet
//    apps/marketing/public/screenshots is tracked, so it must NOT be listed
//    here).
//
// 2. The git-derived ignored-path set (below) — one lazy `git ls-files` pass
//    covering what a name set cannot express: path-shaped ignores (the
//    generated docs mirrors apps/docs/public/docs/ + apps/docs/dist/docs/
//    written by apps/docs/scripts/copy-docs.sh, where a local docs build
//    duplicates every scan hit under the generated copy) and pattern-shaped
//    file ignores inside scanned dirs (docs/*VERIFICATION*.md /
//    docs/*REPORT*.md report artifacts carrying stale counts). It also
//    honors nested .gitignore files (apps/docs/.gitignore `public/*/`),
//    which the name set and its sync-guard test never see.
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

let rootPredicateCache: IgnoredPathPredicate | undefined;

/**
 * Skip-predicate for walks rooted inside the real repo tree. Lazy + cached:
 * the git pass runs once per process on first walker use — never at import
 * time (the unit tests import this module). Walks rooted OUTSIDE the repo
 * (the mkdtemp fixtures in the unit tests — fixture dirs are not git repos)
 * default to no path-based skipping, keeping the suite hermetic; tests that
 * want path-skipping inject their own predicate instead.
 */
function ignoredPathPredicateFor(base: string): IgnoredPathPredicate {
  if (base !== ROOT && !base.startsWith(ROOT + path.sep)) return NEVER_IGNORED;
  if (rootPredicateCache === undefined) {
    const ignored = loadGitIgnoredPaths(ROOT);
    if (ignored === null) {
      console.warn(
        'claim-drift: git unavailable — gitignored-path skipping disabled; ' +
          'walkers fall back to WALK_EXCLUDED_DIRS names only.',
      );
    }
    rootPredicateCache = ignored === null ? NEVER_IGNORED : makeIgnoredPathPredicate(ROOT, ignored);
  }
  return rootPredicateCache;
}

// ---------------------------------------------------------------------------
// Metric collectors
// ---------------------------------------------------------------------------

interface Metric {
  name: string;
  actual: number;
  /** Regex patterns to find claims about this metric in docs */
  claimPatterns: RegExp[];
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
  return countDirs(path.join(ROOT, 'packages'));
}

function countApps(): number {
  return countDirs(path.join(ROOT, 'apps'));
}

/**
 * Count test files across the repo. Path-injectable + exported for tests
 * (mirrors countEnforcementTests); tests may also inject a skip-predicate.
 */
export function countTestFiles(base: string = ROOT, isIgnored?: IgnoredPathPredicate): number {
  return countByGlob(
    base,
    ['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx', '.e2e.ts'],
    isIgnored,
  );
}

function countUIComponents(): number {
  const compDir = path.join(ROOT, 'packages/presentation/src/components');
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
  const serversDir = path.join(ROOT, 'packages/mcp/src/servers');
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
 * Count `pgTable(` declarations across `packages/db/src/schema/*.ts`.
 * The audit-first source of truth for "how many database tables ship".
 */
function countDbTables(): number {
  const schemaDir = path.join(ROOT, 'packages/db/src/schema');
  if (!fs.existsSync(schemaDir)) return 0;
  const isIgnored = ignoredPathPredicateFor(schemaDir);
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
        // Match standalone `pgTable(` calls (not inside a comment block start)
        const matches = content.match(/pgTable\s*\(/g);
        if (matches) total += matches.length;
      }
    }
  }
  walk(schemaDir);
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
// The claim patterns deliberately do NOT match "N template repos" /
// "N standalone template repos": docs/ROADMAP.md legitimately pairs the
// template count with "4 published as standalone template repos", a GitHub
// fact (the revealui-template-* repos; starter-native has none) that cannot
// be derived from this filesystem. Plural-only `templates` plus a repos
// lookahead keeps that phrasing out of this hard-fail gate.
//
// REGEX-CONFIG-BOUNDARY — claim patterns only (pre-existing convention in
// this file; AST refactor queued under GAP-192); the collector authors no
// regex. Both exports are unit-tested in __tests__/claim-drift.test.ts.
// ---------------------------------------------------------------------------

/** Path-injectable + exported for tests. */
export function countCliTemplates(
  base: string = path.join(ROOT, 'packages/cli/templates'),
): number {
  return countDirs(base);
}

export const CLI_TEMPLATE_CLAIM_PATTERNS: RegExp[] = [
  // "5 templates" / "5 CLI templates" — not "4 template repos" (singular
  // never matches) and not "4 templates repos" (repos lookahead)
  /\b(\d+)\s+(?:CLI\s+)?templates\b(?!\s+repos?\b)/i,
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

const ENFORCEMENT_TEST_ROOTS = [
  path.join(ROOT, 'packages/core/src/__tests__/auth'),
  path.join(ROOT, 'packages/core/src/collections/operations/__tests__/access-enforcement.test.ts'),
];

/**
 * Count `it(` / `test(` cases across the canonical enforcement suites. No
 * authored regex (fleet no-regex rule) — a trimmed-line `startsWith` scan.
 * Modifier forms (disabled cases, or table-driven `each` cases) are
 * intentionally excluded: none exist in these suites today, and a disabled
 * case should not inflate an attestation that the tests verify role isolation.
 * Path-injectable + exported for tests.
 */
export function countEnforcementTests(roots: string[] = ENFORCEMENT_TEST_ROOTS): number {
  const files: string[] = [];
  for (const root of roots) {
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
// audit found `mcp`, `services`, `engines` stated as OSS in CLAUDE.md and
// MASTER_PLAN while their package.json files carry FSL-1.1-MIT. Codifying
// the split here closes that drift class for the canonical doc shape
// "N OSS (MIT)" / "N Pro (FSL...)" / "N internal".
// ---------------------------------------------------------------------------

interface LicenseSplit {
  mit: number;
  fsl: number;
  internal: number;
}

function countLicenseSplit(): LicenseSplit {
  const split: LicenseSplit = { mit: 0, fsl: 0, internal: 0 };
  const pkgDir = path.join(ROOT, 'packages');
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
  const pkgDir = path.join(ROOT, 'packages');
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
// Scope: docs/, apps/marketing/app/, apps/docs/public/, root-level
// CLAUDE.md / README.md / CONTRIBUTING.md / .syncpackrc.json, scripts/,
// and packages/ (README .md only — source code is out of scope for license-
// drift checks; packages/* is huge and would slow the gate).
// ---------------------------------------------------------------------------

const LICENSE_SCAN_ROOTS = [
  'docs',
  'apps/marketing/app',
  'apps/docs/public',
  'README.md',
  'CLAUDE.md',
  'CONTRIBUTING.md',
  '.syncpackrc.json',
  'scripts',
  'packages',
];

const LICENSE_SCAN_EXTENSIONS_FULL = ['.md', '.txt', '.ts', '.tsx', '.json', '.sh'];
const LICENSE_SCAN_EXTENSIONS_PACKAGES = ['.md']; // packages/* is huge; restrict to docs

function walkLicenseScanFiles(callback: (filePath: string, rel: string) => void): void {
  const isIgnored = ignoredPathPredicateFor(ROOT);
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
      const rel = path.relative(ROOT, full).replace(/\\/g, '/');
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
  for (const root of LICENSE_SCAN_ROOTS) {
    const full = path.join(ROOT, root);
    try {
      const stat = fs.statSync(full);
      const rel = path.relative(ROOT, full).replace(/\\/g, '/');
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
// REGEX-CONFIG-BOUNDARY — pre-existing convention in this file; AST refactor
// queued under GAP-192.
// ---------------------------------------------------------------------------

interface PhantomMatch {
  file: string;
  line: number;
  pkg: string;
  hint: string;
  text: string;
}

interface PhantomPackage {
  pattern: RegExp;
  pkg: string;
  hint: string;
  allowlist: Set<string>;
}

const PHANTOM_PACKAGES: PhantomPackage[] = [
  {
    pattern: /@revealui\/editors\b/,
    pkg: '@revealui/editors',
    hint: 'package does not exist in this monorepo; editor sync ships as RevCon (separate fleet repo)',
    allowlist: new Set([
      // Canonical pages that exist precisely to document the redirect:
      'apps/docs/public/docs-pro/editors/index.md',
      'docs/fleet/revcon.md',
      'docs/REVFLEET.md',
      // Synced copies of the canonical pages above
      // (apps/docs/scripts/copy-docs.sh mirrors docs/* → apps/docs/public/*):
      'apps/docs/public/REVFLEET.md',
      'apps/docs/public/fleet/revcon.md',
      // The validator itself — its FLEET_PRODUCTS table lists the phantom
      // by design (as the regex token to detect leaks elsewhere):
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
        if (phantom.pattern.test(lines[i])) {
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
// FSL pattern intentionally rejects bare `Fair Source` / `Pro packages` /
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
const MIT_LABEL_PATTERN = /\*\*MIT\*\*|\|\s*MIT\b[^|]*\||\bMIT:|\(MIT\)/;
const FSL_LABEL_PATTERN =
  /\*\*FSL[-\s]?1\.1[-\s]?MIT\*\*|\|\s*(?:FSL[-\s]?1\.1[-\s]?MIT|Fair[-\s]?Source)\b[^|]*\||\bFSL[-\s]?1\.1[-\s]?MIT:|\bPro packages?:|\bPro packages? \(FSL/i;

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
      if (/^#{1,6}\s/.test(line)) continue; // skip headings
      const hasFSL = FSL_LABEL_PATTERN.test(line);
      const hasMIT = MIT_LABEL_PATTERN.test(line) && !hasFSL;
      if (!(hasMIT || hasFSL)) continue;
      const pkgRegex = /@revealui\/([a-z][a-z0-9-]*)\b/g;
      for (const match of line.matchAll(pkgRegex)) {
        const pkgName = match[0];
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

/** True when `line` is a markdown ATX heading (1-6 `#` then a space). */
function isMarkdownHeading(line: string): boolean {
  const t = line.trimStart();
  let h = 0;
  while (h < t.length && t[h] === '#') h++;
  return h >= 1 && h <= 6 && t[h] === ' ';
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
// REGEX-CONFIG-BOUNDARY — patterns only (pre-existing convention in this
// file; AST refactor queued under GAP-192). The shape predicate
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

const PUBLISHED_PACKAGES_PATTERN = /\b[1-9]\d?\s+published\s+packages?\b/i;
const PRIVATE_PACKAGES_PATTERN = /\b[1-9]\d?\s+private\s+packages?\b/i;
const PUBLISHED_PLUS_PRIVATE_PATTERN = /\b[1-9]\d?\s+published\s*\+\s*[1-9]\d?\s+private\b/i;

/**
 * Returns the anti-pattern shape if `line` matches one, otherwise null.
 * Equation form takes precedence — a single line that names both halves of
 * the bug should be flagged once. Pure + exported for unit testing.
 */
export function findLicenseSplitAntiPattern(line: string): LicenseSplitAntiShape | null {
  if (PUBLISHED_PLUS_PRIVATE_PATTERN.test(line)) return 'N published + M private';
  if (PUBLISHED_PACKAGES_PATTERN.test(line)) return 'N published packages';
  if (PRIVATE_PACKAGES_PATTERN.test(line)) return 'N private packages';
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
    const full = path.join(ROOT, dir);
    try {
      const stat = fs.statSync(full);
      if (!(stat.isFile() || stat.isDirectory())) {
        throw new Error(`claim-drift ${arrayName} entry is neither file nor directory: ${dir}`);
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(
        `claim-drift ${arrayName} entry does not exist on disk: ${dir}. ` +
          `Likely cause: source tree refactored without updating ${arrayName} in scripts/validate/claim-drift.ts. ` +
          `Update the array and re-run. (${reason})`,
      );
    }
  }
}

const SCAN_DIRS = [
  'docs',
  'apps/marketing/app',
  'apps/marketing/public/llms.txt',
  'apps/docs/public/docs-pro',
  'apps/docs/public/llms.txt',
  'README.md',
  'CLAUDE.md',
  'CONTRIBUTING.md',
  'scripts/setup',
  'packages/mcp/README.md',
  'packages/mcp/docs',
];

/**
 * Files excluded from claim-drift scanning:
 *   - CRASH-POSTMORTEMS.md: historical document where counts were accurate at time of writing.
 *   - docs/MASTER_PLAN.md: per `single-source-of-truth.md`, the canonical plan lives in
 *     the private coordination hub's master plan; this public-repo copy is an allowed-stale snapshot
 *     and is also hook-blocked from agent edits, so numeric counts here cannot be kept in sync.
 */
const EXCLUDE_FILES = ['docs/system-tune/CRASH-POSTMORTEMS.md', 'docs/MASTER_PLAN.md'];

function scanForClaims(metrics: Metric[]): ClaimMatch[] {
  const matches: ClaimMatch[] = [];
  const isIgnored = ignoredPathPredicateFor(ROOT);

  function scanFile(filePath: string): void {
    const rel = path.relative(ROOT, filePath);
    if (EXCLUDE_FILES.includes(rel)) return;

    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      return;
    }
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const metric of metrics) {
        for (const pattern of metric.claimPatterns) {
          const match = pattern.exec(line);
          if (match) {
            const claimed = parseInt(match[1], 10);
            if (!Number.isNaN(claimed) && claimed > 0) {
              matches.push({
                file: path.relative(ROOT, filePath),
                line: i + 1,
                text: line.trim(),
                claimed,
                metricName: metric.name,
              });
            }
          }
        }
      }
    }
  }

  function scanPath(p: string): void {
    const full = path.join(ROOT, p);
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

  assertScanDirsExist(SCAN_DIRS, 'SCAN_DIRS');
  for (const p of SCAN_DIRS) {
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

/** Files scanned for unlinked future-tense markers. */
const FUTURE_TENSE_SCAN_FILES = ['README.md', 'CLAUDE.md', 'docs/ROADMAP.md', 'docs/PRO.md'];

const FUTURE_TENSE_PATTERN =
  /\((coming soon|planned|roadmap|TBD|forthcoming|will ship|in progress)\b[^)]*\)/i;

const TRACKER_PATTERN = /(#\d+|\/(issues|pull|pulls)\/\d+|\bmilestones?\b|\.ya?ml\b)/i;

function scanForFutureTenseClaims(): FutureClaimMatch[] {
  const matches: FutureClaimMatch[] = [];

  for (const rel of FUTURE_TENSE_SCAN_FILES) {
    const full = path.join(ROOT, rel);
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
      if (/^#{1,6}\s/.test(line)) continue;

      const match = FUTURE_TENSE_PATTERN.exec(line);
      if (!match) continue;

      // Pass if the line cites a tracker (issue, PR, milestone, workflow)
      if (TRACKER_PATTERN.test(line)) continue;

      matches.push({
        file: rel,
        line: i + 1,
        marker: match[0],
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
// Each blocklist token is checked case-insensitively. A token is allowed if
// the line also contains any QUALIFIER pattern (e.g. "(coming soon)",
// "(roadmap)", "Roadmap:", or a github issue/PR link).
//
// Add/remove tokens here when feature reality changes — when "managed
// hosting" actually ships, for example, drop it from BLOCKLIST.
// ---------------------------------------------------------------------------

interface AspirationalMatch {
  file: string;
  line: number;
  token: string;
  why: string;
  text: string;
}

/** Files scanned for aspirational features without qualifiers. */
const ASPIRATIONAL_SCAN_FILES = [
  // Marketing surfaces (existing — marketing-claims-2026-04-25)
  'apps/marketing/app/components/landing',
  'apps/marketing/app/components/GetStarted.tsx',
  // Docs surfaces (PR-D continuation, docs-claims-2026-04-26)
  // High-visibility orientation + tutorial pages where the same blocklist applies.
  // Deeper technical docs (AI.md, DATABASE.md, etc.) are tuned in a follow-up.
  'docs/INDEX.md',
  'docs/BUILD_YOUR_BUSINESS.md',
  'docs/EXAMPLES.md',
  'docs/QUICK_START.md',
  'docs/FLEET.md',
  // Pro tier surface (paying-customer eyes)
  'apps/docs/public/docs-pro/index.md',
  'apps/docs/public/docs-pro/ai/index.md',
  'apps/docs/public/docs-pro/inference/index.md',
  'apps/docs/public/docs-pro/mcp/index.md',
  'apps/docs/public/docs-pro/editors/index.md',
  // Blog posts (wired 2026-06-19): CONTRIBUTING.md (Future-tense claims)
  // explicitly covers blog drafts; long-form, but the same blocklist applies.
  'docs/blog',
];

interface BlocklistEntry {
  /** Word/phrase that misleads when shipped without a qualifier. */
  token: RegExp;
  /** Human-readable label printed when matched. */
  label: string;
  /** Why this is blocklisted — printed alongside the failure. */
  why: string;
}

const BLOCKLIST: BlocklistEntry[] = [
  {
    token: /\bmanaged hosting\b/i,
    label: 'managed hosting',
    why: 'no managed-hosting service ships today',
  },
  {
    token: /\bauto-scal(e|ing)\b/i,
    label: 'auto-scaling',
    why: 'no managed platform offers auto-scaling',
  },
  {
    token: /\bdunning\b/i,
    label: 'dunning',
    why: 'not implemented; only in stripe-best-practices guidance',
  },
  {
    token: /\b(SSO|single sign-on)\b/i,
    label: 'SSO',
    why: 'SSO/SAML is roadmap-only (designed, not built) per apps/marketing/app/content/roadmap.ts',
  },
  {
    token: /\bSCIM\b/i,
    label: 'SCIM',
    why: 'SCIM provisioning not in code',
  },
  {
    token: /\bon-prem\b/i,
    label: 'on-prem',
    why: 'forge docker images not yet published to GHCR',
  },
  {
    token: /\bair-gapped\b/i,
    label: 'air-gapped',
    why: 'no documented air-gap deploy path',
  },
  {
    token: /\bRAG\b/,
    label: 'RAG',
    why: 'gated on Ollama+pgvector setup, not reachable in default flow',
  },
  {
    token: /\bSLA\b/,
    label: 'SLA',
    why: 'no SLA documented in docs/',
  },
];

/**
 * A line is allowed if it contains any qualifier signal:
 *   - parenthetical markers: "(coming soon)", "(planned)", "(roadmap)",
 *     "(in active development)", "(forthcoming)", "(will ship)",
 *     "(in progress)", "(TBD)"
 *   - the bare word "roadmap" anywhere (case-insensitive) — covers both
 *     "Roadmap: X" prefixes and "X is on the roadmap" framing
 *   - a tracker citation (#NNN / issues|pull|pulls URL / .yml workflow /
 *     `milestone`)
 */
const QUALIFIER_PATTERN =
  /\((coming soon|planned|roadmap|in active development|forthcoming|will ship|in progress|TBD)\b[^)]*\)|\broadmap\b|(#\d+|\/(issues|pull|pulls)\/\d+|\bmilestones?\b|\.ya?ml\b)/i;

/**
 * Agent-commerce surfaces (x402 payments, the agent / MCP-server marketplace)
 * are coming soon, NOT shipped. These tokens match only SHIPPED-CLAIM phrasing
 * ("x402 is live", "the marketplace is open") -- never neutral mentions like
 * "the x402 protocol", a glossary entry, or a "## How x402 Works" heading, so
 * the design/explainer posts read normally. A shipped claim still passes if it
 * carries a same-line qualifier (QUALIFIER_PATTERN), OR the whole file declares
 * itself a roadmap post in frontmatter (isRoadmapDeclaredFile). The general
 * BLOCKLIST (SSO / SLA / ...) is unaffected.
 */
export const AGENT_COMMERCE_BLOCKLIST: BlocklistEntry[] = [
  {
    token:
      /\bx402\b[^.\n]{0,50}?\b(?:is|are)\s+(?:live|available|launched|in production|transacting|enabled today|working today)\b/i,
    label: 'x402 (presented as live)',
    why: 'x402 payments are coming soon, not live (X402_ENABLED=false); see #93',
  },
  {
    token:
      /\b(?:RevMarket|(?:agent(?: tool)?|MCP(?: server)?)[- ]marketplace)\b[^.\n]{0,50}?\b(?:is|are|now)\s+(?:live|open|available|launched)\b/i,
    label: 'agent marketplace (presented as live)',
    why: 'the agent / MCP-server marketplace is coming soon, not shipped; see #526',
  },
];

/**
 * A markdown file opts the AGENT_COMMERCE_BLOCKLIST tokens out by declaring
 * itself a roadmap post in frontmatter, e.g.:
 *   roadmap: "Coming soon: x402 #93, agent marketplace #526"
 * The declaration MUST cite a tracker (issue / PR / milestone / workflow), so a
 * roadmap exemption is never an unlinked "coming soon". The general BLOCKLIST
 * (SSO / SLA / on-prem / ...) is unaffected and still enforced on every file.
 */
export function isRoadmapDeclaredFile(content: string): boolean {
  if (!content.startsWith('---\n')) return false;
  const end = content.indexOf('\n---', 4);
  if (end === -1) return false;
  for (const raw of content.slice(4, end).split('\n')) {
    const line = raw.trimStart();
    if (line.startsWith('roadmap:') || line.startsWith('lifecycle:')) {
      if (TRACKER_PATTERN.test(raw)) return true;
    }
  }
  return false;
}

function scanForAspirationalFeatures(): AspirationalMatch[] {
  const matches: AspirationalMatch[] = [];
  const isIgnored = ignoredPathPredicateFor(ROOT);

  function scanFile(filePath: string): void {
    const rel = path.relative(ROOT, filePath);
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

      for (const entry of BLOCKLIST) {
        if (!entry.token.test(line)) continue;
        if (QUALIFIER_PATTERN.test(line)) continue;
        matches.push({
          file: rel,
          line: i + 1,
          token: entry.label,
          why: entry.why,
          text: line.trim(),
        });
      }

      // Agent-commerce tokens (x402 / agent marketplace) are coming soon, not
      // shipped. Skip when the file declares itself a roadmap post in
      // frontmatter; otherwise require a same-line qualifier like the rest.
      if (!commerceExempt) {
        for (const entry of AGENT_COMMERCE_BLOCKLIST) {
          if (!entry.token.test(line)) continue;
          if (QUALIFIER_PATTERN.test(line)) continue;
          matches.push({
            file: rel,
            line: i + 1,
            token: entry.label,
            why: entry.why,
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

  assertScanDirsExist(ASPIRATIONAL_SCAN_FILES, 'ASPIRATIONAL_SCAN_FILES');
  for (const rel of ASPIRATIONAL_SCAN_FILES) {
    const full = path.join(ROOT, rel);
    const stat = fs.statSync(full);
    if (stat.isFile()) {
      scanFile(full);
    } else if (stat.isDirectory()) {
      walk(full);
    }
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
//   - include explicit "(separate product …)" / "RevealUIStudio/<repo>"
//     attribution on the same line
//   - live in an allowlisted file (the fleet map itself, the per-product
//     pages, FORGE.md which is the canonical Forge page).
//
// Without this, mentions of "Studio" / "RevVault" / "RevCon" / etc. across
// docs/PRO.md and similar pages routinely drift into "Pro tier features
// of RevealUI" framing, when in reality they're shipped from sibling repos.
// ---------------------------------------------------------------------------

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
const FLEET_ATTRIBUTION_SCAN_FILES = [
  'docs/BUILD_YOUR_BUSINESS.md',
  'docs/EXAMPLES.md',
  'docs/QUICK_START.md',
  'apps/docs/public/docs-pro/mcp/index.md',
];

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
 * Product tokens. The pattern matches each as a standalone word (case-
 * sensitive — these are proper nouns) so it doesn't fire on "studio"
 * mid-sentence. `@revealui/editors` is special-cased because the package
 * doesn't actually exist (lives in revcon).
 *
 * `Studio` uses a negative lookbehind to avoid firing on "RevealUI
 * Studio" — that's the company name, not the desktop app. The Studio
 * desktop-app references typically appear as "Studio desktop app",
 * "Studio dashboard", "Studio (Tauri)", etc.
 */
const FLEET_PRODUCTS: { token: RegExp; label: string }[] = [
  { token: /(?<!RevealUI\s)\bStudio\b/, label: 'Studio (lives in RevDev, not the company name)' },
  { token: /\bRevVault\b/, label: 'RevVault (separate fleet product)' },
  { token: /\bRevCon\b/, label: 'RevCon (separate fleet product)' },
  { token: /\bRevealCoin\b/, label: 'RevealCoin (separate fleet product)' },
  { token: /\bRevDev\b/, label: 'RevDev (separate fleet product)' },
  { token: /\bRevSkills\b/, label: 'RevSkills (separate fleet product)' },
  { token: /\bRevKit\b/, label: 'RevKit (separate fleet product)' },
  { token: /@revealui\/editors\b/, label: '@revealui/editors (does not exist; ships in RevCon)' },
];

/**
 * A line is allowed if it cites the fleet map, links to a per-product
 * page, names the source repo, or includes an explicit attribution
 * phrase. Multiple acceptance patterns — order doesn't matter.
 */
const FLEET_ATTRIBUTION_QUALIFIER = new RegExp(
  [
    // Direct links to fleet map or per-product pages (absolute or relative)
    String.raw`\/docs\/SUITE`,
    String.raw`\/docs\/suite\/`,
    String.raw`\.\/SUITE\.md\b`,
    String.raw`\.\/suite\/`,
    String.raw`\.\.\/SUITE\.md\b`,
    String.raw`\.\.\/suite\/`,
    // Source-repo mentions (canonical attribution)
    String.raw`RevealUIStudio\/(revvault|revcon|revealcoin|revdev|revskills|revkit|forge|editor-configs)`,
    // Explicit attribution phrases (non-greedy spans permit markdown bold etc.)
    String.raw`\bseparate.{0,30}(?:product|repo|suite|fleet|kit|app)\b`,
    String.raw`\bships in.{0,40}(?:product|repo|suite|fleet|kit|app|RevDev|RevVault|RevCon|RevealCoin|RevSkills|RevKit|Forge|RevFleet)\b`,
    String.raw`\bcompanion product`,
    String.raw`\bRevFleet`,
    String.raw`\blives in.{0,30}(?:RevDev|RevVault|RevCon|RevealCoin|RevSkills|RevKit|Forge|RevFleet|monorepo|repo)\b`,
    String.raw`\bsee (?:\[|\*\*)?(?:RevDev|RevVault|RevCon|RevealCoin|RevSkills|RevKit|Forge|RevFleet|Fleet)`,
    String.raw`\bintentionally decoupled\b`,
    String.raw`\bnot yet shipped\b`,
    // Forge tier / kit phrasings (Forge is both a product and a tier)
    String.raw`Forge \(Enterprise\)`,
    'Forge tier',
    'Forge Edition',
    'Forge kit',
    'Forge guide',
  ].join('|'),
  'i',
);

function scanForFleetProductLeaks(): FleetProductMatch[] {
  const matches: FleetProductMatch[] = [];

  function isAllowlisted(rel: string): boolean {
    if (FLEET_ATTRIBUTION_ALLOWLIST.has(rel)) return true;
    return FLEET_ATTRIBUTION_ALLOWLIST_PREFIXES.some((prefix) => rel.startsWith(prefix));
  }

  function scanFile(filePath: string): void {
    const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
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
      if (i < 20 && (line === '---' || /^[a-zA-Z_][a-zA-Z0-9_-]*:\s/.test(line))) continue;

      for (const product of FLEET_PRODUCTS) {
        if (!product.token.test(line)) continue;
        if (FLEET_ATTRIBUTION_QUALIFIER.test(line)) continue;
        matches.push({
          file: rel,
          line: i + 1,
          product: product.label,
          text: line.trim(),
        });
      }
    }
  }

  for (const rel of FLEET_ATTRIBUTION_SCAN_FILES) {
    const full = path.join(ROOT, rel);
    try {
      const stat = fs.statSync(full);
      if (stat.isFile()) scanFile(full);
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

const RVUI_LEAK_PATTERN = /\$RVUI\b/;

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
  const isIgnored = ignoredPathPredicateFor(ROOT);

  function isAllowlisted(rel: string): boolean {
    return RVUI_LEAK_ALLOWLIST.has(rel) || rel.startsWith('docs/fleet/revealcoin');
  }

  function scanFile(filePath: string): void {
    const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
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
      if (RVUI_LEAK_PATTERN.test(line)) {
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

  walk(path.join(ROOT, 'docs'));
  walk(path.join(ROOT, 'apps/docs/public/docs-pro'));

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
  const full = path.join(ROOT, MARKETING_SITE_FILE);
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

function run(): void {
  console.log('Claim Drift Detector');
  console.log('====================\n');

  // Collect actual metrics
  const packages = countPackages();
  const apps = countApps();
  const workspaces = countWorkspaces();
  const testFiles = countTestFiles();
  const uiComponents = countUIComponents();
  const mcpServers = countMCPServers();
  const dbTables = countDbTables();
  const cliTemplates = countCliTemplates();
  const enforcementTests = countEnforcementTests();
  const licenseSplit = countLicenseSplit();

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

  const metrics: Metric[] = [
    {
      name: 'packages',
      actual: packages,
      claimPatterns: [
        // "21 packages" or "21 npm packages" but not "14 packages patched" or "3 packages"
        /\b(1\d|2\d|3\d)\s*(?:npm\s+)?packages?\b(?!\s+patched)/i,
        // (no "N packages published/on-npm" pattern — it conflated the
        //  npm-published subset with the total package count this metric tracks)
      ],
    },
    {
      name: 'workspaces',
      actual: workspaces,
      claimPatterns: [/\b(\d+)\s*workspaces?\b/i],
    },
    {
      name: 'test files',
      actual: testFiles,
      claimPatterns: [
        // "1,676 test files" or "938 test files" — must be > 100 to avoid small mentions
        /\b(\d[\d,]+)\s*test\s*files?\b/i,
      ],
    },
    {
      name: 'UI components',
      actual: uiComponents,
      claimPatterns: [
        // Only match claims about total component count (50+), not per-category
        /\b(5[0-9]|6[0-9])\s*(?:native\s+)?(?:React\s+)?(?:UI\s+)?components?\b/i,
        /\b(5[0-9]|6[0-9])\s*components?\s+(?:with|built|in the)/i,
      ],
    },
    {
      name: 'MCP servers',
      actual: mcpServers,
      claimPatterns: [/\b(\d+)\s*MCP\s*[Ss]ervers?\b/i],
    },
    {
      name: 'DB tables',
      actual: dbTables,
      claimPatterns: [
        // "85 tables", "85 PostgreSQL tables", "85 database tables", "85 Drizzle tables"
        // Constrain to plausible totals (10..199) to avoid mid-doc small-number noise
        /\b([1-9]\d{1,2})\s+(?:PostgreSQL\s+|database\s+|Drizzle\s+|primary\s+)?tables?\b/i,
        // "Schema (85 tables)" parenthetical
        /\(\s*([1-9]\d{1,2})\s+tables?\s*\)/i,
      ],
    },
    {
      name: 'CLI templates',
      actual: cliTemplates,
      // Patterns defined module-level (CLI_TEMPLATE_CLAIM_PATTERNS, exported
      // for unit tests); see their definition for the "N template repos"
      // non-match rationale.
      claimPatterns: CLI_TEMPLATE_CLAIM_PATTERNS,
    },
    {
      name: 'enforcement tests',
      actual: enforcementTests,
      // REGEX-CONFIG-BOUNDARY — claim pattern only (pre-existing convention in
      // this file); countEnforcementTests computes the count with no authored regex.
      claimPatterns: [/\b(\d+)\s+enforcement\s+tests?\b/i],
    },
    // License-split metrics (REGEX-CONFIG-BOUNDARY — pre-existing convention
    // in this file; AST-refactor pending GAP-192). Patterns target the
    // canonical fleet doc shape: "N OSS (MIT)" / "N Pro (FSL...)" / "N internal".
    {
      name: 'MIT packages',
      actual: licenseSplit.mit,
      claimPatterns: [/\b([1-9]\d?)\s+OSS\s*\(MIT\)/],
    },
    {
      name: 'FSL packages',
      actual: licenseSplit.fsl,
      claimPatterns: [/\b([1-9]\d?)\s+Pro\s*\(\s*(?:Fair\s+Source\s+)?FSL/],
    },
    {
      name: 'internal packages',
      actual: licenseSplit.internal,
      claimPatterns: [/\b([1-9]\d?)\s+internal\s*\(/i],
    },
  ];

  // Scan for claims
  const claims = scanForClaims(metrics);

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

  // Fleet-product attribution gate (PR-D)
  const fleetLeaks = scanForFleetProductLeaks();

  // $RVUI internal-ticker leak guard (PR-D)
  const rvuiLeaks = scanForRvuiTickerLeaks();

  // License-membership gates (added 2026-05-14)
  const pkgMap = buildPackageLicenseMap();
  const phantomMatches = scanForPhantomPackages();
  const membershipMatches = scanForLicenseMembershipDrift(pkgMap);
  const incompleteProMatches = scanForIncompleteProList(pkgMap);

  // License-split anti-pattern gate (added 2026-06-14) — forbids the
  // "N published + M private" phrasing class that prior copy used to reach
  // 26 with off-by-4 arithmetic on both halves.
  const licenseSplitAntiMatches = scanForLicenseSplitAntiPatterns();

  // Marketing METRICS drift (Phase 6) — site.ts METRICS vs canonical counts
  const marketingMetricDrifts = checkMarketingMetrics([
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
  ]);

  console.log('====================');
  console.log(`Claims scanned: ${claims.length}`);
  console.log(`Mismatches:     ${mismatches}`);
  console.log(`Future-tense files scanned: ${FUTURE_TENSE_SCAN_FILES.length}`);
  console.log(`Unlinked future-tense markers: ${futureClaims.length}`);
  console.log(`Aspirational-feature scan files: ${ASPIRATIONAL_SCAN_FILES.length}`);
  console.log(`Unqualified aspirational features: ${aspirationalClaims.length}`);
  console.log(`Unattributed fleet-product mentions: ${fleetLeaks.length}`);
  console.log(`Internal $RVUI ticker leaks: ${rvuiLeaks.length}`);
  console.log(`Phantom-package mentions: ${phantomMatches.length}`);
  console.log(`License-membership mismatches: ${membershipMatches.length}`);
  console.log(`Incomplete Pro-list claims: ${incompleteProMatches.length}`);
  console.log(`License-split anti-pattern phrasings: ${licenseSplitAntiMatches.length}`);
  console.log(`Marketing METRICS drift (site.ts): ${marketingMetricDrifts.length}`);

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

  if (fleetLeaks.length > 0) {
    console.log('\nFleet-product mentions without attribution:');
    for (const c of fleetLeaks) {
      console.log(`  ${c.file}:${c.line}  ${c.product}`);
      console.log(`    ${c.text.substring(0, 140)}`);
    }
    console.log(
      '\nEach fleet-product mention must either link to /docs/FLEET or /docs/fleet/<name>, name the source repo (RevealUIStudio/<repo>), or include a "(separate product)" attribution. The fleet map and per-product pages under /docs/fleet/ are allowlisted.',
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

  const anyFailures =
    mismatches > 0 ||
    futureClaims.length > 0 ||
    aspirationalClaims.length > 0 ||
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
    process.exit(1);
  } else {
    console.log(
      '\nAll claims match codebase reality, future-tense markers are tracked, aspirational features are qualified, fleet products are attributed, no $RVUI ticker leaks were found, no phantom-package mentions were found, license membership matches package.json reality, and no license-split anti-pattern phrasings were found.',
    );
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const selfPath = path.resolve(import.meta.dirname, 'claim-drift.ts');
if (invokedPath === selfPath) {
  run();
}

export { countDirs };
