/**
 * Hosted-tier resource limits — single source of truth for the four hosted tiers.
 *
 * Originally inlined in `apps/server/src/routes/webhooks.ts` where it was applied
 * to `accountEntitlements` on subscription events. Extracted so the seat-count
 * guard in `./seat-count-guard.ts` and any future limit-driven paths can share
 * the same values without re-declaring them.
 *
 * Enterprise is tier-coded for Forge self-hosted deployments; it gets an
 * effectively-unlimited agent-task budget and intentionally omits site/user
 * caps (Forge operators set their own).
 */

export type HostedTierId = 'free' | 'pro' | 'max' | 'enterprise';

export interface HostedTierLimits {
  maxSites?: number;
  maxUsers?: number;
  maxAgentTasks?: number;
}

export function getHostedLimitsForTier(tier: HostedTierId): HostedTierLimits {
  if (tier === 'enterprise') return { maxAgentTasks: Number.MAX_SAFE_INTEGER };
  if (tier === 'max') return { maxSites: 15, maxUsers: 100, maxAgentTasks: 50_000 };
  if (tier === 'pro') return { maxSites: 5, maxUsers: 25, maxAgentTasks: 10_000 };
  return { maxSites: 1, maxUsers: 3, maxAgentTasks: 1_000 };
}
