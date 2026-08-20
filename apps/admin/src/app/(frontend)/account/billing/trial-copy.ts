import { type LicenseTierId, TIER_LABELS } from '@revealui/contracts/pricing';

/** Customer-facing plan name. Max must never render as Pro. */
export function planLabel(tier: LicenseTierId): string {
  return TIER_LABELS[tier];
}

export function formatTrialEndDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function trialEndsTitle(tier: LicenseTierId, expiresAt: string): string {
  return `Your ${planLabel(tier)} trial ends on ${formatTrialEndDate(expiresAt)}`;
}

export function trialEndsBody(priceLabel: string): string {
  return `After that, you'll be charged ${priceLabel}. Cancel anytime before then.`;
}

export function subscriptionActivatedMessage(tier: LicenseTierId): string {
  return `Subscription activated! Your ${planLabel(tier)} features are now available.`;
}

export function subscriptionExpiredMessage(tier: LicenseTierId): string {
  return `Your subscription has expired. ${planLabel(tier)} features are no longer available.`;
}

export function perpetualActivatedMessage(tier: LicenseTierId): string {
  return `Perpetual license activated! Your ${planLabel(tier)} features are permanently unlocked. Your license includes 1 year of support and updates.`;
}

/** Self-serve resubscribe target. Enterprise stays Contact sales. */
export function resubscribeTier(tier: LicenseTierId): 'pro' | 'max' {
  return tier === 'max' ? 'max' : 'pro';
}
