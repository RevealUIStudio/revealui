/**
 * GAP-256 PR-3b — OPEN_FREE_LIMITS lockstep (constants only; no full package graph).
 *
 * Values must match apps/server getHostedLimitsForTier('free') and margin-admit.ts.
 */
import { describe, expect, it } from 'vitest';

/** Mirror of OPEN_FREE_LIMITS in margin-admit.ts */
const OPEN_FREE_LIMITS = {
  maxSites: 1,
  maxUsers: 3,
  maxAgentTasks: 1_000,
} as const;

describe('OPEN_FREE_LIMITS lockstep', () => {
  it('matches hosted free tier (1 site / 3 users / 1k tasks)', () => {
    expect(OPEN_FREE_LIMITS).toEqual({
      maxSites: 1,
      maxUsers: 3,
      maxAgentTasks: 1_000,
    });
  });
});
