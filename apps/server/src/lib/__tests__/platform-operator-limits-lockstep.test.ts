import { describe, expect, it } from 'vitest';
import { getHostedLimitsForTier } from '../tier-limits.js';

/** Must stay equal to PLATFORM_OPERATOR_LIMITS in @revealui/auth platform-operator. */
describe('platform operator limits lockstep', () => {
  it('enterprise hosted limits stay unlimited tasks', () => {
    expect(getHostedLimitsForTier('enterprise')).toEqual({
      maxAgentTasks: Number.MAX_SAFE_INTEGER,
    });
  });
});
