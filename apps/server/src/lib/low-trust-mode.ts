/**
 * REVEALUI_LOW_TRUST_MODE = off (default) | shadow | enforce.
 * Tests override the process env through configureAgentLowTrustMode.
 */

import { type LowTrustMode, parseLowTrustMode } from '@revealui/security';

let override: LowTrustMode | null = null;

export function configureAgentLowTrustMode(mode: LowTrustMode | null): void {
  override = mode;
}

export function currentLowTrustMode(): LowTrustMode {
  if (override !== null) return override;
  return parseLowTrustMode(process.env.REVEALUI_LOW_TRUST_MODE);
}
