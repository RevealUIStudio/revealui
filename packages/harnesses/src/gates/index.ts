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
export type { DispositionGateResult } from './disposition-command-gate.js';
export {
  checkDispositionCommand,
  isGhPrMergeCommand,
  isSecuritySelfClearCommand,
} from './disposition-command-gate.js';
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
export type { LabelGateResult, StatusCheckLike } from './sec-review-label-gate.js';
export {
  checkSecReviewLabelApply,
  evaluateSecurityAuditRollup,
  isSecReviewApprovedLabelAdd,
  REQUIRED_SECURITY_AUDIT_CHECKS,
  SEC_REVIEW_APPROVED_LABEL,
} from './sec-review-label-gate.js';
export type { ExtractedCommentBody, PublicCommentGateResult } from './public-security-comment-gate.js';
export {
  checkPublicSecurityComment,
  extractCommentBody,
  isGithubCommentCommand,
  PUBLIC_VERDICT_MAX_CHARS,
  renderPublicGuardrail2Comment,
} from './public-security-comment-gate.js';
