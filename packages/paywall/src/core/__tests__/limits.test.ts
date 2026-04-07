import { describe, expect, it } from 'vitest';

import { getLimit, isOverLimit } from '../limits.js';
import type { LimitDefinition } from '../types.js';

type Tier = 'free' | 'pro' | 'max' | 'enterprise';

const limits: Record<string, LimitDefinition<Tier>> = {
  sites: { free: 1, pro: 5, max: 15, enterprise: Infinity },
  users: { free: 3, pro: 25, max: 100, enterprise: Infinity },
};

describe('getLimit', () => {
  it('returns the correct limit for each tier', () => {
    expect(getLimit(limits, 'sites', 'free')).toBe(1);
    expect(getLimit(limits, 'sites', 'pro')).toBe(5);
    expect(getLimit(limits, 'sites', 'max')).toBe(15);
    expect(getLimit(limits, 'sites', 'enterprise')).toBe(Infinity);
  });

  it('returns Infinity for unknown resources', () => {
    expect(getLimit(limits, 'unknown', 'pro')).toBe(Infinity);
  });

  it('returns Infinity for unknown tiers on known resources', () => {
    expect(getLimit(limits, 'sites', 'unknown' as Tier)).toBe(Infinity);
  });
});

describe('isOverLimit', () => {
  it('returns false when under the limit', () => {
    expect(isOverLimit(limits, 'sites', 'free', 0)).toBe(false);
    expect(isOverLimit(limits, 'users', 'pro', 10)).toBe(false);
  });

  it('returns true when at the limit (>= check)', () => {
    expect(isOverLimit(limits, 'sites', 'free', 1)).toBe(true);
    expect(isOverLimit(limits, 'users', 'free', 3)).toBe(true);
  });

  it('returns true when over the limit', () => {
    expect(isOverLimit(limits, 'sites', 'free', 5)).toBe(true);
    expect(isOverLimit(limits, 'users', 'pro', 100)).toBe(true);
  });

  it('enterprise is never over limit', () => {
    expect(isOverLimit(limits, 'sites', 'enterprise', 999_999)).toBe(false);
  });

  it('unknown resources are never over limit', () => {
    expect(isOverLimit(limits, 'unknown', 'free', 999_999)).toBe(false);
  });
});
