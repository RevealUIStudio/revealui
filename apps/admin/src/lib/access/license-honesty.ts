/**
 * Hosted license honesty — GAP-300 fleet-operator / Unlimited mismatch.
 *
 * Sidebar usage chrome treats quota < 0 as "Unlimited" (enterprise / operator
 * grant). Route LicenseGates used to read only the SaaS subscription feature
 * map, so an operator session could show Unlimited and still hit the Pro
 * upgrade card. This helper is the single client-safe rule:
 *
 * - Free stays locked (no unlock of `ai` on Free / aiLocal-only).
 * - Fleet-operator, Unlimited quota, and enterprise-equivalent tiers unlock
 *   the same features as Enterprise.
 * - Otherwise the resolved feature map wins.
 */

import type { LicenseTierId } from '@revealui/contracts/pricing';
import { type FeatureFlags, getFeaturesForTier } from '@revealui/core/features';

const COMMERCIAL_TIERS: ReadonlySet<string> = new Set(['free', 'pro', 'max', 'enterprise']);
const ENTERPRISE_EQUIVALENT_TIERS: ReadonlySet<string> = new Set(['enterprise', 'unlimited']);

/** Billing usage sentinel: WeeklyUsageChrome and GET /api/billing/usage. */
export function isUnlimitedOperatorQuota(quota: unknown): boolean {
  return typeof quota === 'number' && quota < 0;
}

export function isEnterpriseEquivalentTier(tier: string | null | undefined): boolean {
  return typeof tier === 'string' && ENTERPRISE_EQUIVALENT_TIERS.has(tier);
}

export function coerceLicenseTier(tier: string | null | undefined): LicenseTierId | null {
  if (typeof tier === 'string' && COMMERCIAL_TIERS.has(tier)) {
    return tier as LicenseTierId;
  }
  if (isEnterpriseEquivalentTier(tier)) {
    return 'enterprise';
  }
  return null;
}

/**
 * Collapse subscription + usage + operator identity into a commercial tier.
 * Unlimited quota / fleet-operator are Enterprise-equivalent. Unknown paid
 * strings do not invent Pro.
 */
export function resolveHonestLicenseTier(input: {
  subscriptionTier?: string | null;
  usageQuota?: number | null;
  isFleetOperator?: boolean;
}): LicenseTierId {
  if (input.isFleetOperator) return 'enterprise';
  if (isUnlimitedOperatorQuota(input.usageQuota)) return 'enterprise';
  return coerceLicenseTier(input.subscriptionTier) ?? 'free';
}

/**
 * Whether a LicenseGate feature should render for this session.
 * Enterprise-equivalent and fleet-operator use the Enterprise feature map
 * so a missing/stale SaaS features object cannot Pro-gate an operator.
 */
export function isLicensedFeatureUnlocked(input: {
  feature: keyof FeatureFlags;
  features?: Partial<FeatureFlags> | null;
  tier?: string | null;
  isFleetOperator?: boolean;
}): boolean {
  if (input.isFleetOperator || isEnterpriseEquivalentTier(input.tier)) {
    return getFeaturesForTier('enterprise')[input.feature] === true;
  }
  return input.features?.[input.feature] === true;
}
