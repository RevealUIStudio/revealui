/**
 * Gates — canonical parsers/data shared by the fleet's security + doc-currency
 * gate machinery (GAP-408 control-layer redesign). See the module-level docs
 * on each export for what consumes it and why it lives here instead of a
 * vendored per-repo copy.
 */

export type {
  DeadInboundLink,
  ScanInboundLinksInput,
  ScannedFile,
} from './archive-check.js';
export {
  ARCHIVE_URL_PREFIX,
  countOccurrences,
  isHistoricalPath,
  JV_HISTORICAL_MARKERS,
  REVEALUI_HISTORICAL_MARKERS,
  scanInboundLinks,
} from './archive-check.js';
export type { DetectionRule } from './doc-currency-shared-rules.js';
export {
  COMMON_EXON,
  SHARED_DETECTION_RULES,
  STRIPE_LIVE_EXON,
} from './doc-currency-shared-rules.js';
export type {
  ClearResult,
  CommentLike,
  EvaluateInput,
  EvaluateResult,
  HoldResult,
  NoMarkerResult,
  ReviewLike,
  Verdict,
  VerdictRecord,
} from './guardrail2-verdict.js';
export {
  APPROVE,
  collectVerdicts,
  evaluateGuardrail2,
  MARKER_CLOSE,
  MARKER_OPEN,
  REQUEST_CHANGES,
  verdictForBody,
} from './guardrail2-verdict.js';
