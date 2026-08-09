/**
 * GAP-256 PR-4b / HC15 — paid-pending feature map zeros AI (no free cohort AI).
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/core/features', () => ({
  getFeaturesForTier: () => ({
    aiLocal: true,
    ai: true,
    aiMemory: true,
    aiInference: true,
    audit: true,
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

import { buildPaidPendingFeatureMap } from '../ensure-paid-pending-entitlement.js';

describe('buildPaidPendingFeatureMap (HC15)', () => {
  it('forces AI-bearing features off while leaving other free features', () => {
    const features = buildPaidPendingFeatureMap();
    expect(features.aiLocal).toBe(false);
    expect(features.ai).toBe(false);
    expect(features.aiMemory).toBe(false);
    expect(features.aiInference).toBe(false);
    expect(features.audit).toBe(true);
  });
});
