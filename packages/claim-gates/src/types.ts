/**
 * Public types for @revealui/claim-gates (GAP-462).
 */

/** Named gate profile for a fleet root. */
export type ClaimProfileName = 'product-runtime' | 'marketing-site' | 'product-readme';

/**
 * Capability proof-obligation slice (GAP-354). Computed by the revealui
 * monorepo wrapper (claims-evidence + capability-claims) and injected so the
 * package does not depend on apps/marketing for Phase 1.
 */
export interface CapabilityGateSlice {
  readonly scanned: number;
  readonly proven: number;
  readonly baselined: readonly string[];
  readonly advisories: readonly CapabilityAdvisorySlice[];
  readonly violations: readonly CapabilityViolationSlice[];
}

export interface CapabilityAdvisorySlice {
  readonly file: string;
  readonly exportPath: string;
  readonly message: string;
}

export interface CapabilityViolationSlice {
  readonly kind: string;
  readonly file: string;
  readonly exportPath: string;
  readonly text: string;
  readonly detail: string;
  readonly denylistFamilies?: readonly string[];
  readonly markers?: readonly string[];
}

export interface ClaimGateRunOptions {
  /** Absolute path to the repo checkout under scan. */
  root: string;
  /** Profile name; defaults via resolveProfile(root). */
  profile?: ClaimProfileName;
  /** Optional process.argv for --fix / future flags. */
  argv?: readonly string[];
  /** Force --fix style suggested corrections. */
  showFix?: boolean;
  /**
   * Report failures but exit 0 (Phase 2 baseline enablement). Also set by
   * CLI `--warn` / `--baseline`.
   */
  warn?: boolean;
  /**
   * Precomputed capability results from the host monorepo. Omit or empty
   * when the root has no claims-evidence index (agency Phase 2, etc.).
   */
  capability?: CapabilityGateSlice;
}

export interface ClaimGateResult {
  readonly ok: boolean;
  readonly exitCode: 0 | 1;
  readonly mismatches: number;
  readonly capability: CapabilityGateSlice;
}

export interface ClaimGatesCliOptions {
  root: string;
  argv?: readonly string[];
  profile?: ClaimProfileName;
  warn?: boolean;
  capability?: CapabilityGateSlice;
  /** When true, process.exit with result.exitCode (CLI default). */
  exit?: boolean;
}

/** Multi-root inventory shape for fleet-claim-roots.yml (Phase 2 loaders). */
export interface ClaimGateRootSpec {
  readonly id: string;
  readonly path: string;
  readonly profile: ClaimProfileName;
  readonly mode?: 'hard-fail' | 'warn' | 'baseline';
}
