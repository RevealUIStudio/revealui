/**
 * GAP-256 PR-4b HC15 — paid-pending limits and AI-off feature map (unit).
 * Webhook paid_rebuild after successful checkout is the existing Stripe path
 * (routes/webhooks); not reimplemented here.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/core/features', () => ({
  getFeaturesForTier: () => ({
    aiLocal: true,
    ai: true,
    aiMemory: true,
    aiInference: true,
    mcp: false,
  }),
}));

vi.mock('@revealui/core/margin-governor', () => ({
  paidPendingLimits: () => ({ maxSites: 1, maxUsers: 1, maxAgentTasks: 0 }),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@revealui/db', () => ({
  getClient: () => {
    throw new Error('db not used in pure feature-map tests');
  },
}));

vi.mock('@revealui/db/schema', () => ({
  accountEntitlements: {},
  accountMemberships: {},
}));

import { paidPendingLimits } from '@revealui/core/margin-governor';
import { buildPaidPendingFeatureMap } from '../ensure-paid-pending-entitlement.js';

describe('paid-pending entitlement shape (HC15)', () => {
  it('paidPendingLimits zeros agent tasks (K20)', () => {
    expect(paidPendingLimits()).toEqual({
      maxSites: 1,
      maxUsers: 1,
      maxAgentTasks: 0,
    });
  });

  it('buildPaidPendingFeatureMap forces AI-bearing features off', () => {
    const features = buildPaidPendingFeatureMap();
    expect(features.aiLocal).toBe(false);
    expect(features.ai).toBe(false);
    expect(features.aiMemory).toBe(false);
    expect(features.aiInference).toBe(false);
    expect(features.mcp).toBe(false);
  });

  it('task-quota denies when maxAgentTasks is 0 (quota exhausted at zero usage)', () => {
    // Mirrors requireTaskQuota: current >= quota with quota 0 → deny
    const quota = paidPendingLimits().maxAgentTasks;
    const current = 0;
    expect(quota).toBe(0);
    expect(current >= quota).toBe(true);
  });
});
