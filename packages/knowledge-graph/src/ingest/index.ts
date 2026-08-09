export {
  type ContradictingEdge,
  findContradictingEdges,
  invalidateContradictions,
  naturalKeysSimilar,
  normalizeNaturalKey,
} from './contradiction.js';
export {
  backfillEdgeEmbedding,
  backfillNodeEmbedding,
} from './embed.js';
export {
  applyScan,
  type EpisodeIngestInput,
  type IngestOptions,
  ingestEpisode,
  type ScanInput,
} from './engine.js';
export { type ApplyOptions, applyOp, applyOps } from './merge.js';
export { aliasOp, resolveAlias, resolveNaturalKey } from './resolve.js';
