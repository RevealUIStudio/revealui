/**
 * Capability-claim proof-obligation tier for the claim-drift gate (GAP-354).
 *
 * WHY THIS EXISTS
 * ---------------
 * On 2026-07-12 audits found false CAPABILITY claims shipped through a GREEN CI
 * gate:
 *   - "hash-chained HMAC-SHA256 tamper-evident audit log"
 *   - "one policy governs your team, your agents, and your service accounts"
 *   - "who can stop an agent"
 * They passed because claim-drift.ts validated only COUNTS and claims-evidence.ts
 * only required *some* evidence ref (a code path), not proof that the behavior
 * actually works. This tier adds a machine-checkable proof obligation to
 * capability-shaped marketing claims: a named, non-skipped TEST.
 *
 * WHAT IT ENFORCES
 * ----------------
 * Closed by default: a capability-SHAPED claim (a marker-word match in a covered
 * marketing claim) must carry at least one `kind: 'test'` evidence ref in the
 * claims-evidence index. A capability claim with no such ref FAILS the gate,
 * unless its (file::claim) pair is grandfathered in
 * capability-claims-baseline.json. The baseline exists to absorb the corpus that
 * predates this gate; it is meant to SHRINK, never grow.
 *
 * Denylist tier: the three claim families removed on 2026-07-12 carry hard terms
 * that can NEVER ship without a `kind: 'test'` proof, baseline or not. A
 * baselined denylist term is still a failure.
 *
 * Proof-ref format: "<repo-relative test file>#<exact test title substring>".
 * The validator asserts the file exists, the title substring appears in it, and
 * the named test is NOT `.skip` / `.todo` / `xit` (a skipped proof is no proof).
 * Passing is guaranteed by the CI gate running the full suite; this validator's
 * job is existence + non-skipped + named.
 *
 * WHAT IT DOES NOT (AND CANNOT) ENFORCE — PROOF QUALITY
 * -----------------------------------------------------
 * A test that MOCKS the seam it claims to prove is not a proof. The 2026-07-12
 * incident: security tests used in-memory storage while the real production seam
 * rejected 100% of writes, so the "tamper-evident audit log" was green in CI and
 * broken in production. Machine-enforcing "the test exercises the real seam, no
 * mock of the proven behavior" is not feasible here. Therefore proof-test QUALITY
 * (production path, no mock of the proven seam) is enforced by FABLE REVIEW of
 * every new `kind: 'test'` ref, not by this validator. As a review aid this
 * module emits an ADVISORY (never a failure) when a proof-test file imports an
 * in-memory / pglite marker, so review attention lands where mocking is likeliest.
 *
 * Zero authored regex (fleet no-regex hardline): substring + Set only.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { ClaimEntry, EvidenceRef } from '../../apps/marketing/app/content/claims-evidence.js';

// ---------------------------------------------------------------------------
// Capability markers
//
// A marketing claim is "capability-shaped" when it asserts an automatic,
// universal, or enforced behavior — the flavor of every claim in the
// 2026-07-12 incident. Matching is plain lowercased substring (no authored
// regex). The set biases toward catching too much: the baseline absorbs the
// current corpus, so an over-broad marker only means more grandfathered
// entries today (which then shrink), never a false ship of an unproven claim.
//
// Trailing/leading spaces on some markers keep them from firing inside longer
// words ("never" in "nevertheless", "every" in "delivery").
// ---------------------------------------------------------------------------

export const CAPABILITY_MARKERS: readonly string[] = [
  'automatically',
  'every ',
  ' always ',
  ' never ',
  ' cannot ',
  ' enforce', // enforced / enforces / enforcement — space-anchored so "reinforce" never fires
  'govern', // governed / governs
  'guaranteed',
  'in real time',
  'real-time',
  'tamper',
  ' signed', // space-anchored so "designed" / "assigned" never fire
  'audited',
  'audit log',
  'encrypt', // encrypted / encryption / re-encrypts
  'reconcil', // reconciliation / reconciles
  'idempoten',
  'isolat', // isolation / isolates
  'provenance',
  'quota',
  ' verified', // space-anchored so "unverified" never fires as a capability assertion
];

// ---------------------------------------------------------------------------
// Denylist tier — the three claim families removed on 2026-07-12.
//
// These hard terms can NEVER ship without a kind:'test' proof, baseline or not.
// This is the GAP-354 acceptance guarantee: the removed claims cannot be
// re-added without a production-path proof. Terms are lowercased substrings.
// ---------------------------------------------------------------------------

export interface DenylistTerm {
  /** Lowercased substring that marks the removed claim family. */
  readonly term: string;
  /** Which removed family this belongs to. */
  readonly family: string;
  /** Why it is denylisted — printed on failure. */
  readonly why: string;
}

export const DENYLIST_TERMS: readonly DenylistTerm[] = [
  {
    term: 'hash-chain',
    family: 'tamper-evident-audit-log',
    why: 'the hash-chained/HMAC tamper-evident audit-log claim was removed 2026-07-12 (the real seam rejected writes); it may not re-ship without a production-path kind:"test" proof',
  },
  {
    term: 'hash chain',
    family: 'tamper-evident-audit-log',
    why: 'the hash-chained/HMAC tamper-evident audit-log claim was removed 2026-07-12; it may not re-ship without a production-path kind:"test" proof',
  },
  {
    term: 'hmac',
    family: 'tamper-evident-audit-log',
    why: 'the HMAC tamper-evident audit-log claim was removed 2026-07-12; it may not re-ship without a production-path kind:"test" proof',
  },
  {
    term: 'tamper-evident',
    family: 'tamper-evident-audit-log',
    why: 'the tamper-evident audit-log claim was removed 2026-07-12; it may not re-ship without a production-path kind:"test" proof',
  },
  {
    term: 'tamper evident',
    family: 'tamper-evident-audit-log',
    why: 'the tamper-evident audit-log claim was removed 2026-07-12; it may not re-ship without a production-path kind:"test" proof',
  },
  {
    term: 'tamper-proof',
    family: 'tamper-evident-audit-log',
    why: 'the tamper-proof audit-log claim was removed 2026-07-12; it may not re-ship without a production-path kind:"test" proof',
  },
  {
    term: 'one policy governs',
    family: 'one-policy-governs',
    why: 'the "one policy governs your team, your agents, and your service accounts" claim was removed 2026-07-12; it may not re-ship without a production-path kind:"test" proof',
  },
  {
    term: 'stop an agent',
    family: 'stop-an-agent',
    why: 'the "who can stop an agent" control claim was removed 2026-07-12; it may not re-ship without a production-path kind:"test" proof',
  },
];

// ---------------------------------------------------------------------------
// Detection (pure)
// ---------------------------------------------------------------------------

export interface CapabilitySignal {
  /** Capability markers present in the claim text. */
  readonly markers: string[];
  /** Denylisted terms present in the claim text. */
  readonly denylist: DenylistTerm[];
}

/** Analyze a claim's text for capability markers + denylisted terms. */
export function analyzeClaimText(text: string): CapabilitySignal {
  const lower = ` ${text.toLowerCase()} `;
  const markers = CAPABILITY_MARKERS.filter((m) => lower.includes(m));
  const denylist = DENYLIST_TERMS.filter((d) => lower.includes(d.term));
  return { markers, denylist };
}

/**
 * Legal/policy content modules (`legal/*`) use universal quantifiers
 * ("every", "never", "govern", "cannot") as legal English, not as product
 * capability assertions in the GAP-354 sense. Marker-based proof obligation
 * does not apply to them. Denylisted claim families still do — a policy page
 * must not re-ship "hash-chain" / "stop an agent" without a production-path
 * test proof.
 */
export function isLegalPolicyFile(file: string): boolean {
  return file.startsWith('legal/');
}

/** A claim needs a proof when it is capability-shaped or hits the denylist. */
export function isCapabilityClaim(signal: CapabilitySignal): boolean {
  return signal.markers.length > 0 || signal.denylist.length > 0;
}

/**
 * Capability signal for one claims-evidence entry. Legal policy files keep
 * denylist hits only; product marketing files keep the full marker set.
 */
export function analyzeClaimEntry(entry: ClaimEntry): CapabilitySignal {
  const signal = analyzeClaimText(entry.text);
  if (!isLegalPolicyFile(entry.file)) return signal;
  return { markers: [], denylist: signal.denylist };
}

/**
 * Baseline / identity key for a claim. Keyed on the exact claim text (the
 * behavior asserted), so rewording an existing baselined capability claim
 * re-triggers the proof obligation. Interpolated (`match: 'path'`) entries have
 * documentation-only text, so they key on the stable export path instead.
 */
export function capabilityClaimKey(entry: ClaimEntry): string {
  const id = entry.match === 'path' ? entry.exportPath : entry.text;
  return `${entry.file}::${id}`;
}

// ---------------------------------------------------------------------------
// Proof-ref validation
// ---------------------------------------------------------------------------

/** Skip/pending forms that void a proof. Substring checks — no authored regex. */
const SKIP_FORMS: readonly string[] = [
  '.skip(',
  '.todo(',
  '.skip.',
  '.todo.',
  '.failing(',
  'xit(',
  'xdescribe(',
  'xtest(',
];

/** In-import markers that hint a proof test mocks its seam (advisory only). */
const MOCK_IMPORT_MARKERS: readonly string[] = [
  'pglite',
  'in-memory',
  'inmemory',
  'memorystore',
  'mock-',
  '/mocks/',
];

export interface TestRefCheck {
  readonly ref: string;
  readonly ok: boolean;
  /** Present when !ok. */
  readonly reason?: string;
  /** Present when ok but the proof-test file looks like it mocks its seam. */
  readonly advisory?: string;
}

/**
 * True when the named test title appears on a skipped/pending invocation. The
 * title line, or the line immediately above it (multi-line `it.skip(\n 'title'`),
 * is checked for a skip form.
 */
export function isTitleSkipped(content: string, title: string): boolean {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes(title)) continue;
    const candidates = i > 0 ? [lines[i], lines[i - 1]] : [lines[i]];
    for (const c of candidates) {
      if (SKIP_FORMS.some((form) => c.includes(form))) return true;
    }
  }
  return false;
}

/** True when a proof-test file imports an in-memory / mock marker. */
export function importsMockMarker(content: string): boolean {
  for (const line of content.split('\n')) {
    const trimmed = line.trimStart();
    if (!trimmed.startsWith('import ')) continue;
    const lower = line.toLowerCase();
    if (MOCK_IMPORT_MARKERS.some((m) => lower.includes(m))) return true;
  }
  return false;
}

/**
 * Validate one `kind: 'test'` evidence ref: format, file existence, title
 * presence, and non-skipped. Emits an advisory (not a failure) when the file
 * looks like it mocks its seam.
 */
export function validateTestRef(ref: string, repoRoot: string): TestRefCheck {
  const hashIdx = ref.indexOf('#');
  if (hashIdx === -1) {
    return {
      ref,
      ok: false,
      reason: 'ref must be "<repo-relative test file>#<exact test title substring>"',
    };
  }
  const filePart = ref.slice(0, hashIdx);
  const title = ref.slice(hashIdx + 1);
  if (title.trim() === '') {
    return { ref, ok: false, reason: 'empty test title after "#"' };
  }
  const abs = path.join(repoRoot, filePart);
  if (!fs.existsSync(abs)) {
    return { ref, ok: false, reason: `test file not found: ${filePart}` };
  }
  let content: string;
  try {
    content = fs.readFileSync(abs, 'utf8');
  } catch {
    return { ref, ok: false, reason: `cannot read test file: ${filePart}` };
  }
  if (!content.includes(title)) {
    return { ref, ok: false, reason: `test title not found in ${filePart}: "${title}"` };
  }
  if (isTitleSkipped(content, title)) {
    return {
      ref,
      ok: false,
      reason: `named test is skipped/todo (a skipped proof is no proof): "${title}"`,
    };
  }
  const advisory = importsMockMarker(content)
    ? `proof-test file ${filePart} imports an in-memory/mock marker; Fable review must confirm the production seam is exercised, not mocked`
    : undefined;
  return { ref, ok: true, advisory };
}

/** The `kind: 'test'` evidence refs on an entry. */
export function testEvidenceRefs(entry: ClaimEntry): EvidenceRef[] {
  return entry.evidence.filter((e) => e.kind === 'test');
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export type CapabilityViolationKind = 'missing-proof' | 'denylist' | 'bad-ref';

export interface CapabilityViolation {
  readonly file: string;
  readonly exportPath: string;
  readonly text: string;
  readonly kind: CapabilityViolationKind;
  readonly markers?: string[];
  readonly denylistFamilies?: string[];
  /** For bad-ref: why the ref failed. For denylist: the reason(s). */
  readonly detail?: string;
}

export interface CapabilityAdvisory {
  readonly file: string;
  readonly exportPath: string;
  readonly ref: string;
  readonly message: string;
}

export interface CapabilityResult {
  readonly violations: CapabilityViolation[];
  readonly advisories: CapabilityAdvisory[];
  /** Capability-shaped claims scanned. */
  readonly scanned: number;
  /** Grandfathered (baselined) claims with no valid proof, non-denylist. */
  readonly baselined: string[];
  /** Claims with at least one valid proof ref. */
  readonly proven: number;
}

/**
 * Check every capability-shaped claim for a valid `kind: 'test'` proof.
 *
 * Failure rules:
 *   - A test ref that fails validation (bad format / missing file / missing or
 *     skipped title) is ALWAYS a `bad-ref` violation, baseline or not — a broken
 *     proof must be fixed.
 *   - A denylisted term with no valid proof is ALWAYS a `denylist` violation,
 *     baseline or not.
 *   - A marker-only capability claim with no valid proof is a `missing-proof`
 *     violation UNLESS its (file::claim) key is in the baseline.
 */
export function checkCapabilityClaims(
  claims: readonly ClaimEntry[],
  baseline: ReadonlySet<string>,
  repoRoot: string,
): CapabilityResult {
  const violations: CapabilityViolation[] = [];
  const advisories: CapabilityAdvisory[] = [];
  const baselined: string[] = [];
  let scanned = 0;
  let proven = 0;

  for (const entry of claims) {
    const signal = analyzeClaimEntry(entry);
    if (!isCapabilityClaim(signal)) continue;
    scanned++;

    const key = capabilityClaimKey(entry);
    const refs = testEvidenceRefs(entry);
    const checks = refs.map((r) => validateTestRef(r.ref, repoRoot));

    // Broken proof refs always fail.
    for (const c of checks) {
      if (!c.ok) {
        violations.push({
          file: entry.file,
          exportPath: entry.exportPath,
          text: entry.text,
          kind: 'bad-ref',
          detail: `${c.ref}: ${c.reason}`,
        });
      } else if (c.advisory) {
        advisories.push({
          file: entry.file,
          exportPath: entry.exportPath,
          ref: c.ref,
          message: c.advisory,
        });
      }
    }

    const hasValidProof = checks.some((c) => c.ok);
    if (hasValidProof) proven++;

    if (signal.denylist.length > 0 && !hasValidProof) {
      violations.push({
        file: entry.file,
        exportPath: entry.exportPath,
        text: entry.text,
        kind: 'denylist',
        denylistFamilies: [...new Set(signal.denylist.map((d) => d.family))],
        detail: signal.denylist.map((d) => `"${d.term}": ${d.why}`).join('; '),
      });
      continue;
    }

    if (!hasValidProof && signal.denylist.length === 0) {
      if (baseline.has(key)) {
        baselined.push(key);
      } else {
        violations.push({
          file: entry.file,
          exportPath: entry.exportPath,
          text: entry.text,
          kind: 'missing-proof',
          markers: signal.markers,
        });
      }
    }
  }

  return { violations, advisories, scanned, baselined, proven };
}

// ---------------------------------------------------------------------------
// Baseline file I/O
// ---------------------------------------------------------------------------

export interface CapabilityBaselineFile {
  readonly note: string;
  readonly count: number;
  readonly keys: string[];
}

const BASELINE_NOTE =
  'Grandfathered capability-shaped marketing claims that lack a kind:"test" proof as of GAP-354 seed. ' +
  'Each key is a (file::claim) pair; CI fails only on NEW capability claims outside this list. ' +
  'Denylisted claim families (tamper-evident audit log, one-policy-governs, stop-an-agent) are NEVER ' +
  'grandfathered — a baselined denylist term still fails. Shrinking this list = progress: register a ' +
  'real kind:"test" proof (reviewed by Fable for production-path quality) and remove the key. ' +
  'Regenerate the seed via `pnpm validate:claims --update-capability-baseline`.';

export function loadCapabilityBaseline(baselinePath: string): Set<string> {
  try {
    const parsed = JSON.parse(fs.readFileSync(baselinePath, 'utf8')) as CapabilityBaselineFile;
    return new Set(parsed.keys);
  } catch {
    return new Set();
  }
}

/**
 * Compute the keys to grandfather: every capability-shaped, non-denylist claim
 * that lacks a valid proof today. Denylist claims are intentionally excluded so
 * a regenerate can never silently grandfather a removed family.
 */
export function computeBaselineKeys(claims: readonly ClaimEntry[], repoRoot: string): string[] {
  const keys: string[] = [];
  for (const entry of claims) {
    const signal = analyzeClaimEntry(entry);
    if (!isCapabilityClaim(signal)) continue;
    if (signal.denylist.length > 0) continue;
    const hasValidProof = testEvidenceRefs(entry).some((r) => validateTestRef(r.ref, repoRoot).ok);
    if (!hasValidProof) keys.push(capabilityClaimKey(entry));
  }
  return [...new Set(keys)].sort();
}

export function writeCapabilityBaseline(baselinePath: string, keys: string[]): number {
  const sorted = [...new Set(keys)].sort();
  const body: CapabilityBaselineFile = {
    note: BASELINE_NOTE,
    count: sorted.length,
    keys: sorted,
  };
  fs.writeFileSync(baselinePath, `${JSON.stringify(body, null, 2)}\n`);
  return sorted.length;
}
