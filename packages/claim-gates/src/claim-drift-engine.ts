// console-allowed
/**
 * Claim Drift Detector — public entry (barrel).
 *
 * Implementation lives under `./claim-drift/` (fleet-redundancy C12 length split).
 * Historical import path `claim-drift-engine` is preserved for tests and package index.
 */

export type { Rule, Token } from '@revealui/contracts/marketing-voice';
export {
  checkRule,
  isIntegerWithCommas,
  isPositiveIntegerToken,
  stripCommas,
  tokenize,
} from '@revealui/contracts/marketing-voice';
export type { IgnoredPathPredicate, NumericClaimSpec } from './claim-drift/metrics.js';
export {
  CLI_TEMPLATE_CLAIM_SPECS,
  countCheckConstraints,
  countCliTemplates,
  countDbTables,
  countDirs,
  countEnforcementTests,
  countPgTableCalls,
  countTestFiles,
  countTrackedFiles,
  makeIgnoredPathPredicate,
  parseGitIgnoredOutput,
  TEST_FILE_SUFFIXES,
  WALK_EXCLUDED_DIRS,
} from './claim-drift/metrics.js';
export { runClaimDrift } from './claim-drift/run.js';

export type { LicenseSplitAntiShape, NumericClaimHit } from './claim-drift/scanners.js';
export {
  AGENT_COMMERCE_ENTRIES,
  extractRevealuiPackages,
  findAgentCommerceHits,
  findAspirationalBlocklistHits,
  findFleetProductHits,
  findFutureTenseMarker,
  findIncompleteProList,
  findLicenseSplitAntiPattern,
  hasAspirationalQualifier,
  hasFleetAttributionQualifier,
  hasFslLicenseLabel,
  hasMarketplaceLiveClaim,
  hasMitLicenseLabel,
  hasPhantomEditorsPackage,
  hasRvuiTickerLeak,
  hasTrackerSignal,
  hasX402LiveClaim,
  isMarkdownHeading,
  isRoadmapDeclaredFile,
  isYamlFrontmatterLine,
  scanNumericClaimsOnLine,
} from './claim-drift/scanners.js';
export { configureClaimGatesRoot, getClaimGatesRoot } from './claim-drift/state.js';
