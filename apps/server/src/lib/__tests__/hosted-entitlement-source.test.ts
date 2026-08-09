/**
 * GAP-444 — entitlement source lockstep on buildHostedEntitlementValues.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/core/features', () => ({
  getFeaturesForTier: vi.fn(() => ({ agents: true })),
}));

vi.mock('@revealui/core/observability/logger', () => {
  const mockLog = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
  return { logger: mockLog, createLogger: () => mockLog };
});

vi.mock('../tier-limits.js', () => ({
  getHostedLimitsForTier: vi.fn(() => ({ maxSites: 1, maxUsers: 1, maxAgentTasks: 10 })),
}));

import { buildHostedEntitlementValues } from '../hosted-entitlement.js';

describe('buildHostedEntitlementValues source (GAP-444)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const base = {
    tier: 'pro' as const,
    status: 'active',
    mode: 'live' as const,
    lastEventAt: null,
    now: new Date('2026-07-31T00:00:00.000Z'),
  };

  it('defaults source to stripe for paid paths', () => {
    const values = buildHostedEntitlementValues(base);
    expect(values.source).toBe('stripe');
  });

  it('accepts grant for CLI gifts', () => {
    const values = buildHostedEntitlementValues({ ...base, source: 'grant' });
    expect(values.source).toBe('grant');
  });

  it('accepts reconciler for heal path', () => {
    const values = buildHostedEntitlementValues({ ...base, source: 'reconciler' });
    expect(values.source).toBe('reconciler');
  });

  it('accepts signup for free@t0 and paid-pending (GAP-256)', () => {
    const values = buildHostedEntitlementValues({
      ...base,
      tier: 'free',
      source: 'signup',
    });
    expect(values.source).toBe('signup');
  });
});
