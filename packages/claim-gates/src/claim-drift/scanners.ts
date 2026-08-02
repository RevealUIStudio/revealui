// console-allowed
/**
 * Claim-drift scanners public surface (barrel).
 * Implementation split across license / numeric / prose / fleet / rvui modules.
 */

export type { FleetProductMatch, FleetProductRuleEntry } from './fleet-attribution.js';
export {
  FLEET_ATTRIBUTION_ALLOWLIST,
  FLEET_ATTRIBUTION_ALLOWLIST_PREFIXES,
  FLEET_GITHUB_ORG,
  FLEET_MAP_PATH_MARKERS,
  FLEET_PRODUCT_RULES,
  FLEET_REPO_NAMES,
  findFleetProductHits,
  hasFleetAttributionQualifier,
  hasPhantomEditorsPackage,
  hasWordNear,
  LIVES_IN_TARGETS,
  PHANTOM_EDITORS_LABEL,
  SEE_TARGETS,
  SEPARATE_TARGETS,
  SHIPS_IN_TARGETS,
  scanForFleetProductLeaks,
} from './fleet-attribution.js';
export type {
  IncompleteProMatch,
  LicenseSplit,
  LicenseSplitAntiMatch,
  LicenseSplitAntiShape,
  MembershipMatch,
  PackageLicenseMap,
  PhantomMatch,
  PhantomPackage,
} from './license.js';
export {
  buildPackageLicenseMap,
  countLicenseSplit,
  extractRevealuiPackages,
  findIncompleteProList,
  findLicenseSplitAntiPattern,
  hasFslLicenseLabel,
  hasMitLicenseLabel,
  isMarkdownHeading,
  isOneOrTwoDigitPositive,
  isYamlFrontmatterLine,
  LICENSE_SCAN_EXTENSIONS_FULL,
  LICENSE_SCAN_EXTENSIONS_PACKAGES,
  LICENSE_SPLIT_ANTIPATTERN_ALLOWLIST,
  matchFairSourceAt,
  matchFsl11MitAt,
  nextNonWs,
  PHANTOM_EDITORS_HINT,
  PHANTOM_PACKAGES,
  scanForIncompleteProList,
  scanForLicenseMembershipDrift,
  scanForLicenseSplitAntiPatterns,
  scanForPhantomPackages,
  skipWs,
  walkLicenseScanFiles,
  wordAt,
} from './license.js';
export type { ClaimMatch, NumericClaimHit } from './numeric-claims.js';
export {
  assertScanDirsExist,
  EXCLUDE_FILES,
  matchLicenseShape,
  matchWordSeqFrom,
  PUBLIC_PLAN_SNAPSHOT,
  parseCountToken,
  scanForClaims,
  scanNumericClaimsOnLine,
} from './numeric-claims.js';
export type {
  AgentCommerceEntry,
  AspirationalBlocklistEntry,
  AspirationalMatch,
  FutureClaimMatch,
} from './prose-future.js';
export {
  AGENT_COMMERCE_ENTRIES,
  ASPIRATIONAL_BLOCKLIST,
  FUTURE_TENSE_PAREN_PREFIXES,
  findAgentCommerceHits,
  findAspirationalBlocklistHits,
  findFutureTenseMarker,
  hasAspirationalQualifier,
  hasMarketplaceLiveClaim,
  hasTrackerSignal,
  hasX402LiveClaim,
  isRoadmapDeclaredFile,
  MARKETPLACE_LIVE_STATUS,
  marketplaceAnchorLen,
  QUALIFIER_PAREN_PREFIXES,
  scanForAspirationalFeatures,
  scanForCopyDependentHolds,
  scanForFutureTenseClaims,
  wordTexts,
  X402_LIVE_STATUS,
} from './prose-future.js';

export type {
  MarketingMetricCheck,
  MarketingMetricDrift,
  RvuiLeakMatch,
} from './rvui-marketing.js';
export {
  checkMarketingMetrics,
  hasRvuiTickerLeak,
  MARKETING_SITE_FILE,
  RVUI_LEAK_ALLOWLIST,
  readDeclaredMetric,
  scanForRvuiTickerLeaks,
} from './rvui-marketing.js';
