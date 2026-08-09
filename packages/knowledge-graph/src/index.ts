/**
 * @revealui/knowledge-graph — fleet knowledge graph core (GAP-340 P1).
 *
 * A graphiti-style, bi-temporal, content-addressed knowledge graph over the
 * single Neon + pgvector primary: deterministic id derivation, a convergent
 * (CRDT class-1/2) write API, deterministic Tier-1 extractors, and hybrid
 * retrieval (vector + FTS + traversal, RRF-fused, point-in-time). The `revkg`
 * bin exposes scan/search/node/neighbors/at.
 */

export { KG_TABLES, type KgDdlOptions, kgDdlStatements } from './db/ddl.js';
export { makeExecutor, makePoolExecutor } from './db/executor.js';
export {
  additiveExtractors,
  type Extractor,
  type ExtractorContext,
  loadMarkdownSources,
  type ScanProduct,
  type TextSource,
  textSourceToEpisode,
  tier1Extractors,
} from './extractors/index.js';
export {
  deriveEdgeId,
  deriveEpisodeId,
  deriveNodeId,
  deterministicUuid,
  stableStringify,
} from './ids.js';
export {
  applyOp,
  applyOps,
  applyScan,
  type ContradictingEdge,
  findContradictingEdges,
  type IngestOptions,
  ingestEpisode,
  invalidateContradictions,
  naturalKeysSimilar,
  normalizeNaturalKey,
  type ScanInput,
} from './ingest/index.js';
export {
  EDGE_RELATIONS,
  type EdgeRelation,
  NODE_KINDS,
  type NodeKind,
  validateNodeAttributes,
} from './ontology/index.js';
export {
  type DriftCandidate,
  type KgDriftOptions,
  type KgSearchQuery,
  type KgSearchResult,
  kgAtTime,
  kgDrift,
  kgNeighbors,
  kgPath,
  kgSearch,
  type RankedFact,
  type RankedNode,
} from './search/index.js';
export {
  type EdgeInput,
  type Embedder,
  EPISODE_TYPES,
  type EpisodeInput,
  type EpisodeType,
  type KgExecutor,
  type KgOp,
  type NodeInput,
  type ScanApplyResult,
} from './types.js';
