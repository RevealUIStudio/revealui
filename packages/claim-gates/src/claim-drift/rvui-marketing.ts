// console-allowed
/**
 * $RVUI ticker leak scan and marketing site.ts METRICS lockstep.
 */
import fs from 'node:fs';
import path from 'node:path';
import { tokenize } from '@revealui/contracts/marketing-voice';
import { ignoredPathPredicateFor, WALK_EXCLUDED_DIRS } from './metrics.js';
import { scanState } from './state.js';

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

export interface RvuiLeakMatch {
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
export const RVUI_LEAK_ALLOWLIST = new Set<string>([
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

export function scanForRvuiTickerLeaks(): RvuiLeakMatch[] {
  const matches: RvuiLeakMatch[] = [];
  const isIgnored = ignoredPathPredicateFor(scanState.Root);

  function isAllowlisted(rel: string): boolean {
    return RVUI_LEAK_ALLOWLIST.has(rel) || rel.startsWith('docs/fleet/revealcoin');
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

  walk(path.join(scanState.Root, 'docs'));
  walk(path.join(scanState.Root, 'apps/docs/public/docs-pro'));

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

export const MARKETING_SITE_FILE = 'apps/marketing/app/content/site.ts';

export interface MarketingMetricCheck {
  /** METRICS field name in site.ts (e.g. "dbTables", "mcpServers"). */
  key: string;
  /** Canonical count this validator computed from the codebase. */
  actual: number;
  /** Allowed |declared - actual| drift. Test files churn, so they get slack. */
  tolerance?: number;
}

export interface MarketingMetricDrift {
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
export function readDeclaredMetric(metricsBlock: string, key: string): number | null {
  const token = `${key}:`;
  const idx = metricsBlock.indexOf(token);
  if (idx === -1) return null;
  const parsed = Number.parseInt(metricsBlock.slice(idx + token.length), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export function checkMarketingMetrics(checks: MarketingMetricCheck[]): MarketingMetricDrift[] {
  const full = path.join(scanState.Root, MARKETING_SITE_FILE);
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
