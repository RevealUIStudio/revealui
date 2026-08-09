export {
  CLAIMS_EVIDENCE_REL,
  type ClaimsCheckIssue,
  claimsExtractor,
  evidencePathFromRef,
  isPathEvidence,
  missingEvidencePaths,
  type ParsedClaim,
  type ParsedEvidence,
  parseClaimsEvidenceSource,
} from './claims.js';
export { dbSchemaExtractor } from './db-schema.js';
export { docsFrontmatterExtractor } from './docs-frontmatter.js';
export { gitExtractor } from './git.js';
export {
  type ExtractEpisodeOptions,
  extractEpisodeFromText,
  LLM_EXTRACTION_PROMPT,
  type LlmCompleter,
  type LlmExtraction,
  LlmExtractionSchema,
} from './llm-episode.js';
export { routesExtractor } from './routes.js';
export * from './shared.js';
export { tsProjectExtractor } from './ts-project.js';
export type { Extractor, ExtractorContext, ScanProduct } from './types.js';
export { workspaceExtractor } from './workspace.js';

import { claimsExtractor } from './claims.js';
import { dbSchemaExtractor } from './db-schema.js';
import { docsFrontmatterExtractor } from './docs-frontmatter.js';
import { gitExtractor } from './git.js';
import { routesExtractor } from './routes.js';
import { tsProjectExtractor } from './ts-project.js';
import type { Extractor } from './types.js';
import { workspaceExtractor } from './workspace.js';

/** All Tier-1 deterministic extractors. `git` is additive (route via ingestEpisode); the rest via applyScan. */
export const tier1Extractors: readonly Extractor[] = [
  workspaceExtractor,
  tsProjectExtractor,
  dbSchemaExtractor,
  docsFrontmatterExtractor,
  routesExtractor,
  claimsExtractor,
];

export const additiveExtractors: readonly Extractor[] = [gitExtractor];
