import { runClaimDrift } from './claim-drift-engine.js';
import { resolveProfile } from './profiles.js';
import type { ClaimGateResult, ClaimGateRunOptions } from './types.js';

/**
 * Run claim honesty gates for a single root.
 * Parity entry for revealui `pnpm validate:claims` and future multi-root drivers.
 */
export function runClaimGates(options: ClaimGateRunOptions): ClaimGateResult {
  const profile = resolveProfile(options.root, options.profile);
  return runClaimDrift({
    ...options,
    profile,
  });
}
