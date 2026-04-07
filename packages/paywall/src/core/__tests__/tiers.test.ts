import { describe, expect, it } from 'vitest';

import { buildTierRanks, getTierRank, tierMeetsRequirement } from '../tiers.js';

describe('buildTierRanks', () => {
  it('assigns ascending ranks from the tier array', () => {
    const ranks = buildTierRanks(['free', 'pro', 'max', 'enterprise']);
    expect(ranks.get('free')).toBe(0);
    expect(ranks.get('pro')).toBe(1);
    expect(ranks.get('max')).toBe(2);
    expect(ranks.get('enterprise')).toBe(3);
  });

  it('works with custom tier names', () => {
    const ranks = buildTierRanks(['starter', 'growth', 'scale']);
    expect(ranks.get('starter')).toBe(0);
    expect(ranks.get('growth')).toBe(1);
    expect(ranks.get('scale')).toBe(2);
  });

  it('handles a single tier', () => {
    const ranks = buildTierRanks(['solo']);
    expect(ranks.get('solo')).toBe(0);
    expect(ranks.size).toBe(1);
  });

  it('handles empty tier array', () => {
    const ranks = buildTierRanks([]);
    expect(ranks.size).toBe(0);
  });
});

describe('tierMeetsRequirement', () => {
  const ranks = buildTierRanks(['free', 'pro', 'max', 'enterprise']);

  it('same tier meets requirement', () => {
    expect(tierMeetsRequirement(ranks, 'pro', 'pro')).toBe(true);
  });

  it('higher tier meets lower requirement', () => {
    expect(tierMeetsRequirement(ranks, 'enterprise', 'free')).toBe(true);
    expect(tierMeetsRequirement(ranks, 'max', 'pro')).toBe(true);
  });

  it('lower tier does not meet higher requirement', () => {
    expect(tierMeetsRequirement(ranks, 'free', 'pro')).toBe(false);
    expect(tierMeetsRequirement(ranks, 'pro', 'enterprise')).toBe(false);
  });

  it('free meets free', () => {
    expect(tierMeetsRequirement(ranks, 'free', 'free')).toBe(true);
  });

  it('unknown tier returns false', () => {
    expect(tierMeetsRequirement(ranks, 'unknown' as string, 'free')).toBe(false);
    expect(tierMeetsRequirement(ranks, 'free', 'unknown' as string)).toBe(false);
  });
});

describe('getTierRank', () => {
  const ranks = buildTierRanks(['free', 'pro', 'max', 'enterprise']);

  it('returns the rank index for known tiers', () => {
    expect(getTierRank(ranks, 'free')).toBe(0);
    expect(getTierRank(ranks, 'enterprise')).toBe(3);
  });

  it('returns -1 for unknown tiers', () => {
    expect(getTierRank(ranks, 'unknown' as string)).toBe(-1);
  });
});
