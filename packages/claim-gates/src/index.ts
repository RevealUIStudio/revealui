/**
 * @revealui/claim-gates — fleet claim honesty engines (GAP-462 Phase 1).
 */

export type {
  IgnoredPathPredicate,
  LicenseSplitAntiShape,
  NumericClaimHit,
  NumericClaimSpec,
  Rule,
  Token,
} from './claim-drift-engine.js';
export {
  AGENT_COMMERCE_ENTRIES,
  CLI_TEMPLATE_CLAIM_SPECS,
  checkRule,
  configureClaimGatesRoot,
  countCliTemplates,
  countDbTables,
  countDirs,
  countEnforcementTests,
  countPgTableCalls,
  countTestFiles,
  countTrackedFiles,
  extractRevealuiPackages,
  findAgentCommerceHits,
  findAspirationalBlocklistHits,
  findFleetProductHits,
  findFutureTenseMarker,
  findIncompleteProList,
  findLicenseSplitAntiPattern,
  getClaimGatesRoot,
  hasAspirationalQualifier,
  hasFleetAttributionQualifier,
  hasFslLicenseLabel,
  hasMarketplaceLiveClaim,
  hasMitLicenseLabel,
  hasPhantomEditorsPackage,
  hasRvuiTickerLeak,
  hasTrackerSignal,
  hasX402LiveClaim,
  isIntegerWithCommas,
  isMarkdownHeading,
  isPositiveIntegerToken,
  isRoadmapDeclaredFile,
  isYamlFrontmatterLine,
  makeIgnoredPathPredicate,
  parseGitIgnoredOutput,
  runClaimDrift,
  scanNumericClaimsOnLine,
  stripCommas,
  TEST_FILE_SUFFIXES,
  tokenize,
  WALK_EXCLUDED_DIRS,
} from './claim-drift-engine.js';
export { runClaimGatesCli } from './cli.js';
export type { ClaimProfile } from './profiles.js';
export { getProfile, PROFILES, resolveProfile } from './profiles.js';
export { runClaimGates } from './run.js';
export type {
  CapabilityAdvisorySlice,
  CapabilityGateSlice,
  CapabilityViolationSlice,
  ClaimGateResult,
  ClaimGateRootSpec,
  ClaimGateRunOptions,
  ClaimGatesCliOptions,
  ClaimProfileName,
} from './types.js';
