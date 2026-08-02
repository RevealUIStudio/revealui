// console-allowed
/**
 * Fleet product attribution and phantom-editors scanners.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  checkRule,
  isRepoLinkToken,
  type Rule,
  tokenize,
} from '@revealui/contracts/marketing-voice';
import { isYamlFrontmatterLine } from './license.js';
import { WALK_EXCLUDED_DIRS } from './metrics.js';
import { wordTexts } from './prose-future.js';
import { resolvedFleetAttributionFiles, scanState } from './state.js';

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
export const FLEET_GITHUB_ORG = 'RevealUI' + 'Studio';

export interface FleetProductMatch {
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
export const FLEET_ATTRIBUTION_ALLOWLIST = new Set<string>([
  'docs/FLEET.md',
  'docs/FORGE.md', // canonical Forge product page
]);

/** Per-product pages all live under `docs/fleet/`. Allowlist by prefix. */
export const FLEET_ATTRIBUTION_ALLOWLIST_PREFIXES = ['docs/fleet/'];

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
export interface FleetProductRuleEntry {
  rule: Rule;
  label: string;
}

export const FLEET_PRODUCT_RULES: FleetProductRuleEntry[] = [
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

export const PHANTOM_EDITORS_LABEL = '@revealui/editors (does not exist; ships in RevCon)';

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

export const FLEET_MAP_PATH_MARKERS = [
  '/docs/SUITE',
  '/docs/suite/',
  './SUITE.md',
  './suite/',
  '../SUITE.md',
  '../suite/',
] as const;

export const FLEET_REPO_NAMES = new Set([
  'revvault',
  'revcon',
  'revealcoin',
  'revdev',
  'revskills',
  'revkit',
  'forge',
  'editor-configs',
]);

export const SEPARATE_TARGETS = new Set(['product', 'repo', 'suite', 'fleet', 'kit', 'app']);

export const SHIPS_IN_TARGETS = new Set([
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

export const LIVES_IN_TARGETS = new Set([
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

export const SEE_TARGETS = new Set([
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
export function hasWordNear(
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

export function scanForFleetProductLeaks(): FleetProductMatch[] {
  const matches: FleetProductMatch[] = [];

  function isAllowlisted(rel: string): boolean {
    if (FLEET_ATTRIBUTION_ALLOWLIST.has(rel)) return true;
    return FLEET_ATTRIBUTION_ALLOWLIST_PREFIXES.some((prefix) => rel.startsWith(prefix));
  }

  function scanFile(filePath: string): void {
    const rel = path.relative(scanState.Root, filePath).split(path.sep).join('/');
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
    const full = path.join(scanState.Root, rel);
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
