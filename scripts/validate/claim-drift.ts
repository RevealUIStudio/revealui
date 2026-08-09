// console-allowed
/**
 * Claim Drift Detector — thin monorepo wrapper (GAP-462 Phase 1).
 *
 * Engine lives in `@revealui/claim-gates`. This script:
 *   1. Resolves the revealui monorepo root
 *   2. Runs GAP-354 capability proof-obligation (claims-evidence local)
 *   3. Invokes the shared engine with product-runtime profile
 *
 * Usage:
 *   pnpm validate:claims
 *   pnpm validate:claims -- --fix
 *   pnpm validate:claims -- --update-capability-baseline
 */

import path from 'node:path';
import { type CapabilityGateSlice, runClaimGatesCli } from '@revealui/claim-gates';
import { CLAIMS } from '../../apps/marketing/app/content/claims-evidence.js';
import {
  checkCapabilityClaims,
  computeBaselineKeys,
  loadCapabilityBaseline,
  writeCapabilityBaseline,
} from './capability-claims.js';

export * from '@revealui/claim-gates';

const ROOT = path.resolve(import.meta.dirname, '../..');
const CAPABILITY_BASELINE_PATH = path.join(
  ROOT,
  'scripts/validate/capability-claims-baseline.json',
);

const argv = process.argv;
const updateCapabilityBaseline = argv.includes('--update-capability-baseline');

if (updateCapabilityBaseline) {
  const keys = computeBaselineKeys(CLAIMS, ROOT);
  const n = writeCapabilityBaseline(CAPABILITY_BASELINE_PATH, keys);
  console.log(`Capability-claims baseline regenerated: ${n} grandfathered (file::claim) keys.`);
  process.exit(0);
}

const capabilityBaseline = loadCapabilityBaseline(CAPABILITY_BASELINE_PATH);
const capability: CapabilityGateSlice = checkCapabilityClaims(CLAIMS, capabilityBaseline, ROOT);

runClaimGatesCli({
  root: ROOT,
  profile: 'product-runtime',
  argv,
  capability,
  exit: true,
});
