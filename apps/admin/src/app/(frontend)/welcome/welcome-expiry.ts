import type { LicenseTierId } from '@revealui/contracts/pricing';
import { formatTrialEndDate, planLabel, trialEndsTitle } from '../account/billing/trial-copy';

export function isLicenseTierId(value: unknown): value is LicenseTierId {
  return value === 'free' || value === 'pro' || value === 'max' || value === 'enterprise';
}

export function welcomeExpiryCopy(input: {
  tier: unknown;
  expiresAt: unknown;
  status?: unknown;
  perpetual?: unknown;
}): string | null {
  if (input.perpetual === true) return null;
  if (typeof input.expiresAt !== 'string' || input.expiresAt.length === 0) return null;
  if (!Number.isFinite(Date.parse(input.expiresAt))) return null;
  const tier: LicenseTierId = isLicenseTierId(input.tier) ? input.tier : 'free';
  if (input.status === 'trialing') {
    return trialEndsTitle(tier, input.expiresAt);
  }
  return `Your ${planLabel(tier)} subscription ends on ${formatTrialEndDate(input.expiresAt)}.`;
}
