// console-allowed
/**
 * License split counts, package license map, phantom packages, membership drift.
 */
import fs from 'node:fs';
import path from 'node:path';
import { isPositiveIntegerToken, type Token, tokenize } from '@revealui/contracts/marketing-voice';
import { ignoredPathPredicateFor, WALK_EXCLUDED_DIRS } from './metrics.js';
import { resolvedLicenseRoots, scanState } from './state.js';

/** Local copy of phantom-editors detector (avoids license↔fleet import cycle). */
const PHANTOM_EDITORS_LOCAL = '@revealui/editors (does not exist; ships in RevCon)';
function hasPhantomEditorsPackage(line: string): boolean {
  return line.includes('@revealui/editors') || line.includes(PHANTOM_EDITORS_LOCAL);
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

export interface LicenseSplit {
  mit: number;
  fsl: number;
  internal: number;
}

export function countLicenseSplit(): LicenseSplit {
  const split: LicenseSplit = { mit: 0, fsl: 0, internal: 0 };
  const pkgDir = path.join(scanState.Root, 'packages');
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

export interface PackageLicenseMap {
  mit: Set<string>;
  fsl: Set<string>;
  internal: Set<string>;
  all: Set<string>;
}

export function buildPackageLicenseMap(): PackageLicenseMap {
  const map: PackageLicenseMap = {
    mit: new Set(),
    fsl: new Set(),
    internal: new Set(),
    all: new Set(),
  };
  const pkgDir = path.join(scanState.Root, 'packages');
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

export const LICENSE_SCAN_EXTENSIONS_FULL = ['.md', '.txt', '.ts', '.tsx', '.json', '.sh'];
export const LICENSE_SCAN_EXTENSIONS_PACKAGES = ['.md']; // packages/* is huge; restrict to docs

export function walkLicenseScanFiles(callback: (filePath: string, rel: string) => void): void {
  const isIgnored = ignoredPathPredicateFor(scanState.Root);
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
      const rel = path.relative(scanState.Root, full).split(path.sep).join('/');
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
    const full = path.join(scanState.Root, root);
    try {
      const stat = fs.statSync(full);
      const rel = path.relative(scanState.Root, full).split(path.sep).join('/');
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

export interface PhantomMatch {
  file: string;
  line: number;
  pkg: string;
  hint: string;
  text: string;
}

export interface PhantomPackage {
  /** Line-level detector (no regex). */
  detect: (line: string) => boolean;
  pkg: string;
  hint: string;
  allowlist: Set<string>;
}

export const PHANTOM_EDITORS_HINT =
  'package does not exist in this monorepo; editor sync ships as RevCon (separate fleet repo)';

export const PHANTOM_PACKAGES: PhantomPackage[] = [
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

export function scanForPhantomPackages(): PhantomMatch[] {
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

export interface MembershipMatch {
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
export function skipWs(tokens: Token[], i: number): number {
  let j = i;
  while (j < tokens.length && tokens[j]?.kind === 'whitespace') j++;
  return j;
}

/** True when tokens[i..] is FSL + optional - + 1.1 + optional - + MIT. */
export function matchFsl11MitAt(tokens: Token[], i: number): number | null {
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
export function matchFairSourceAt(tokens: Token[], i: number): number | null {
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

export function scanForLicenseMembershipDrift(map: PackageLicenseMap): MembershipMatch[] {
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

export interface IncompleteProMatch {
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

export function scanForIncompleteProList(map: PackageLicenseMap): IncompleteProMatch[] {
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

export interface LicenseSplitAntiMatch {
  file: string;
  line: number;
  shape: LicenseSplitAntiShape;
  text: string;
}

/** Positive integer 1–99 (matches prior `[1-9]\d?` anti-pattern). */
export function isOneOrTwoDigitPositive(token: Token | undefined): boolean {
  if (token === undefined || token.kind !== 'word') return false;
  if (!isPositiveIntegerToken(token)) return false;
  const n = Number(token.text);
  return n >= 1 && n <= 99;
}

/**
 * Advance past whitespace only. Returns null if a non-ws token is required
 * but missing; returns the index of the next non-ws token.
 */
export function nextNonWs(tokens: Token[], i: number): number | null {
  const j = skipWs(tokens, i);
  return j < tokens.length ? j : null;
}

/**
 * True when tokens[i] is a word whose lower text equals `want`, allowing only
 * leading whitespace from `from` (no symbols between).
 */
export function wordAt(tokens: Token[], from: number, want: string): number | null {
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
export const LICENSE_SPLIT_ANTIPATTERN_ALLOWLIST = new Set<string>([
  'apps/marketing/app/content/home.ts',
  'apps/marketing/app/content/proof.ts',
  'apps/marketing/app/content/fair-source.ts',
  // The validator itself + its tests — pattern strings are not claims
  'scripts/validate/claim-drift.ts',
]);

export function scanForLicenseSplitAntiPatterns(): LicenseSplitAntiMatch[] {
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
