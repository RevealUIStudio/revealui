import { describe, expect, it } from 'vitest';
import { cogsBreakerFlagsFromEnv, decideCogsBreakerTrip } from '../cogs-breaker.js';

describe('decideCogsBreakerTrip', () => {
  const flags = { enabled: true, dailyLimitCents: 100 };
  it('trips free over limit', () => {
    expect(
      decideCogsBreakerTrip({
        tier: 'free',
        costCents: 101,
        flags,
        alreadyTripped: false,
      }).action,
    ).toBe('trip');
  });
  it('exempts paid', () => {
    expect(
      decideCogsBreakerTrip({
        tier: 'pro',
        costCents: 9999,
        flags,
        alreadyTripped: false,
      }).action,
    ).toBe('none');
  });
  it('env flags', () => {
    const f = cogsBreakerFlagsFromEnv({
      COGS_BREAKER_ENABLED: 'true',
      COGS_BREAKER_DAILY_CENTS: '50',
    });
    expect(f.enabled).toBe(true);
    expect(f.dailyLimitCents).toBe(50);
  });
});
