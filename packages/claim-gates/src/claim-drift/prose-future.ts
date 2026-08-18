// console-allowed
/**
 * Future-tense, aspirational, agent-commerce, and copy-dependent scanners.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  checkRule,
  isRepoLinkToken,
  isTrackerToken,
  type Rule,
  type Token,
  tokenize,
} from '@revealui/contracts/marketing-voice';
import { findCopyDependentHits } from '../copy-dependents.js';
import { isMarkdownHeading } from './license.js';
import { ignoredPathPredicateFor, WALK_EXCLUDED_DIRS } from './metrics.js';
import { assertScanDirsExist } from './numeric-claims.js';
import {
  resolvedAspirationalPaths,
  resolvedCopyDependentPaths,
  resolvedFutureTenseFiles,
  scanState,
} from './state.js';

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

export interface FutureClaimMatch {
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
export const FUTURE_TENSE_PAREN_PREFIXES = [
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
export const QUALIFIER_PAREN_PREFIXES = [
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

export function scanForFutureTenseClaims(): FutureClaimMatch[] {
  const matches: FutureClaimMatch[] = [];
  const FutureTenseScanFiles = resolvedFutureTenseFiles();

  for (const rel of FutureTenseScanFiles) {
    const full = path.join(scanState.Root, rel);
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

export interface AspirationalMatch {
  file: string;
  line: number;
  token: string;
  why: string;
  text: string;
}

export interface AspirationalBlocklistEntry {
  /** marketing-voice rules that fire this label (any hit counts once). */
  rules: Rule[];
  /** Human-readable label printed when matched. */
  label: string;
  /** Why this is blocklisted — printed alongside the failure. */
  why: string;
}

export const ASPIRATIONAL_BLOCKLIST: AspirationalBlocklistEntry[] = [
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
    why: 'on-prem is not a supported product claim; Fleet is a self-hosted Docker kit',
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
 * general ASPIRATIONAL_BLOCKLIST (SLA / managed hosting / ...) is unaffected.
 *
 * GAP-192 PR5 — proximity word walk (no authored regex).
 */

export interface AgentCommerceEntry {
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

export const X402_LIVE_STATUS = new Set(['live', 'available', 'launched', 'transacting']);
export const MARKETPLACE_LIVE_STATUS = new Set(['live', 'open', 'available', 'launched']);

/** Word tokens only (kind === 'word'), lowercased for matching. */
export function wordTexts(tokens: Token[]): string[] {
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
export function marketplaceAnchorLen(words: string[], i: number): number {
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

export function scanForAspirationalFeatures(): AspirationalMatch[] {
  const matches: AspirationalMatch[] = [];
  const isIgnored = ignoredPathPredicateFor(scanState.Root);

  function scanFile(filePath: string): void {
    const rel = path.relative(scanState.Root, filePath);
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
    const full = path.join(scanState.Root, rel);
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
export function scanForCopyDependentHolds(): AspirationalMatch[] {
  const matches: AspirationalMatch[] = [];
  const isIgnored = ignoredPathPredicateFor(scanState.Root);

  function scanFile(filePath: string): void {
    const rel = path.relative(scanState.Root, filePath);
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
    const full = path.join(scanState.Root, rel);
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
