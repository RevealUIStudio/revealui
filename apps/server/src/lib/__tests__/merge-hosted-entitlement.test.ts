/**
 * GAP-256 PR-3 — mergeHostedEntitlementUpdate (K21 / HC12 shape).
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
  getHostedLimitsForTier: vi.fn(() => ({
    maxSites: 1,
    maxUsers: 3,
    maxAgentTasks: 1_000,
  })),
}));

import {
  buildHostedEntitlementValues,
  mergeHostedEntitlementUpdate,
} from '../hosted-entitlement.js';

describe('mergeHostedEntitlementUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const now = new Date('2026-08-09T00:00:00.000Z');

  it('free_preserve keeps limits and breaker columns', () => {
    const next = buildHostedEntitlementValues({
      tier: 'free',
      status: 'active',
      mode: 'live',
      lastEventAt: null,
      now,
      source: 'reconciler',
      limits: { maxSites: 1, maxUsers: 3, maxAgentTasks: 999 },
    });
    const merged = mergeHostedEntitlementUpdate({
      existing: {
        limits: { maxSites: 1, maxUsers: 3, maxAgentTasks: 250 },
        source: 'signup',
        cogsBreakerTrippedAt: new Date('2026-08-01T00:00:00.000Z'),
        cogsBreakerReason: 'daily',
      },
      next,
      reason: 'free_preserve',
    });
    expect(merged.limits.maxAgentTasks).toBe(250);
    expect(merged.source).toBe('signup');
    expect(merged.cogsBreakerReason).toBe('daily');
    expect(merged.cogsBreakerTrippedAt).toEqual(new Date('2026-08-01T00:00:00.000Z'));
  });

  it('paid_rebuild clears breaker', () => {
    const next = buildHostedEntitlementValues({
      tier: 'pro',
      status: 'active',
      mode: 'live',
      lastEventAt: now,
      now,
      source: 'stripe',
    });
    const merged = mergeHostedEntitlementUpdate({
      existing: {
        limits: { maxSites: 1, maxUsers: 3, maxAgentTasks: 0 },
        source: 'signup',
        cogsBreakerTrippedAt: now,
        cogsBreakerReason: 'x',
      },
      next,
      reason: 'paid_rebuild',
    });
    expect(merged.cogsBreakerTrippedAt).toBeNull();
    expect(merged.source).toBe('stripe');
    expect(merged.tier).toBe('pro');
  });

  it('accepts signup source on build (HC16)', () => {
    const next = buildHostedEntitlementValues({
      tier: 'free',
      status: 'active',
      mode: 'live',
      lastEventAt: null,
      now,
      source: 'signup',
    });
    expect(next.source).toBe('signup');
  });
});
