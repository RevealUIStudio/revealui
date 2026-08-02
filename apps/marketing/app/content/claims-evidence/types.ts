// Claims-evidence index: every prose sentence in the covered marketing
// content files maps to the artifacts that prove it (owner directive
// 2026-07-12; spec: .jv docs/lanes/frontend-excellence/messaging-rewrite-2026-07-12.md).
//
// claim-drift.ts pins the NUMBERS marketing quotes; this index pins the
// SENTENCES. scripts/validate/claims-evidence.ts hard-fails the gate when a
// covered file gains prose with no entry here, when an entry's text no longer
// matches the copy, or when a cited code path stops existing.
//
// Granularity: one entry per copy FIELD (a field may hold more than one
// sentence); the evidence array carries one ref per distinct claim in the
// field, with the claim named in `note`. Line numbers never appear in `ref`
// (they drift); put them in `note` when helpful.
//
// Generalizes the per-card source-file citation pattern from the retired
// capabilities.ts module (GAP-383, 2026-07-17).

// 'test' (GAP-354): a machine-checkable proof obligation for capability-shaped
// claims. ref format "<repo-relative test file>#<exact test title substring>";
// the claim-drift capability tier asserts the file exists, the title appears,
// and the test is not .skip/.todo. Required on every capability-shaped claim
// (see scripts/validate/capability-claims.ts).
export type EvidenceKind = 'code' | 'command' | 'url' | 'metric' | 'test';

export interface EvidenceRef {
  /** What kind of artifact proves the claim. */
  readonly kind: EvidenceKind;
  /** Repo-relative path (code/metric), runnable command, or public URL. */
  readonly ref: string;
  /** Which claim in the field this ref proves, and any caveat. */
  readonly note?: string;
}

export interface ClaimEntry {
  /** Content module, relative to app/content/. */
  readonly file: string;
  /** Dot path of the export the copy lives under (documentation aid). */
  readonly exportPath: string;
  /**
   * The exact runtime copy string. With `match: 'path'` (interpolated
   * template literals) the validator resolves `exportPath` instead and
   * `text` is documentation only.
   */
  readonly text: string;
  readonly match?: 'text' | 'path';
  readonly evidence: readonly EvidenceRef[];
}

/** Files whose prose the validator requires to be fully indexed. */
export interface CoveredFile {
  readonly file: string;
  /** When set, only exports whose name starts with this prefix are covered. */
  readonly exportPrefix?: string;
}

export const COVERED_FILES: readonly CoveredFile[] = [
  { file: 'home.ts' },
  { file: 'primitives.ts' },
  { file: 'products.ts' },
  { file: 'proof.ts' },
  { file: 'pricing-teaser.ts' },
  { file: 'site.ts' },
  { file: 'pricing.ts' },
  { file: 'pricing-faq.ts' },
  { file: 'for-operators.ts' },
  { file: 'for-operators-how-it-works.ts' },
  { file: 'for-operators-managed.ts' },
  { file: 'local-ai.ts' },
  { file: 'fair-source.ts' },
  { file: 'philosophy.ts' },
  { file: 'roadmap.ts' },
  { file: 'claims.ts' },
  { file: 'receipt.ts' },
  // Legal / contact ratchet (claims-evidence audit 2026-07-22): live policy
  // pages were outside the index while product pages were gated.
  { file: 'contact.ts' },
  { file: 'legal/privacy.ts' },
  { file: 'legal/refund-policy.ts' },
  { file: 'legal/security.ts' },
  { file: 'legal/sla.ts' },
  { file: 'legal/subprocessors.ts' },
  { file: 'legal/support.ts' },
  { file: 'legal/terms.ts' },
] as const;
