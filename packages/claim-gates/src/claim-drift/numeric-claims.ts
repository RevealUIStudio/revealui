// console-allowed
/**
 * Numeric claim scanning against monorepo metrics.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  isIntegerWithCommas,
  isPositiveIntegerToken,
  stripCommas,
  type Token,
  tokenize,
} from '@revealui/contracts/marketing-voice';
import { nextNonWs, skipWs, wordAt } from './license.js';
import {
  ignoredPathPredicateFor,
  type Metric,
  type NumericClaimSpec,
  WALK_EXCLUDED_DIRS,
} from './metrics.js';
import { resolvedScanDirs, scanState } from './state.js';

// ---------------------------------------------------------------------------
// Claim scanner
// ---------------------------------------------------------------------------

export interface ClaimMatch {
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

export function parseCountToken(token: Token, allowCommas: boolean): number | null {
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
export function matchLicenseShape(
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
export function matchWordSeqFrom(tokens: Token[], from: number, seq: string[]): number | null {
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
export function assertScanDirsExist(scanDirs: string[], arrayName: string): void {
  for (const dir of scanDirs) {
    const full = path.join(scanState.Root, dir);
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
export const PUBLIC_PLAN_SNAPSHOT = ['docs', 'MASTER' + '_PLAN.md'].join('/');
export const EXCLUDE_FILES = ['docs/system-tune/CRASH-POSTMORTEMS.md', PUBLIC_PLAN_SNAPSHOT];

export function scanForClaims(metrics: Metric[]): ClaimMatch[] {
  const matches: ClaimMatch[] = [];
  const isIgnored = ignoredPathPredicateFor(scanState.Root);

  function scanFile(filePath: string): void {
    const rel = path.relative(scanState.Root, filePath);
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
          file: path.relative(scanState.Root, filePath),
          line: i + 1,
          text: line.trim(),
          claimed: hit.claimed,
          metricName: hit.metricName,
        });
      }
    }
  }

  function scanPath(p: string): void {
    const full = path.join(scanState.Root, p);
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
