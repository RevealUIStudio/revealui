/**
 * Tier-1 deterministic extractor contract (spec §6).
 *
 * Extractors read repo state with the TypeScript compiler API, YAML/frontmatter
 * parsers, and git plumbing — NEVER regex over source (fleet no-regex rule) —
 * and emit `ScanProduct`s (one per authoritative scope). The engine's `applyScan`
 * consumes each product: it upserts nodes, inserts new edges, and invalidates
 * edges from the previous scan of the same (repo, extractor) scope that are now
 * absent. Extractors never touch the DB directly.
 */

import type { ScanInput } from '../ingest/engine.js';

/** A single authoritative-scope scan result. Equivalent to the engine's ScanInput. */
export type ScanProduct = ScanInput;

export interface ExtractorContext {
  /** Absolute path to the repo root being scanned. */
  repoRoot: string;
  /** Logical repo name (partition key), e.g. `revealui`. */
  repo: string;
  /** Origin site id for the scan episodes. */
  siteId: string;
  /** Reference time stamped on scan episodes + new edges. */
  now: Date;
}

export interface Extractor {
  readonly name: string;
  extract(ctx: ExtractorContext): Promise<ScanProduct[]>;
}
