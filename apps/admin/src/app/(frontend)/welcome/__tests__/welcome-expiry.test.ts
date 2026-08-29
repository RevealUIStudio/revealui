import { describe, expect, it } from 'vitest';
import { formatTrialEndDate } from '../../account/billing/trial-copy';
import { isLicenseTierId, welcomeExpiryCopy } from '../welcome-expiry';

const TRIAL_END = '2026-08-27T00:00:00.000Z';

describe('welcomeExpiryCopy', () => {
  it('returns trial copy when status is trialing and expiresAt is present', () => {
    expect(
      welcomeExpiryCopy({
        tier: 'pro',
        status: 'trialing',
        expiresAt: TRIAL_END,
      }),
    ).toBe(`Your Pro trial ends on ${formatTrialEndDate(TRIAL_END)}`);
  });

  it('returns Max trial copy, not Pro', () => {
    const copy = welcomeExpiryCopy({
      tier: 'max',
      status: 'trialing',
      expiresAt: TRIAL_END,
    });
    expect(copy).toBe(`Your Max trial ends on ${formatTrialEndDate(TRIAL_END)}`);
    expect(copy).not.toContain('Pro');
  });

  it('returns null when expiresAt is missing or invalid', () => {
    expect(welcomeExpiryCopy({ tier: 'pro', status: 'trialing', expiresAt: null })).toBeNull();
    expect(welcomeExpiryCopy({ tier: 'pro', status: 'trialing', expiresAt: '' })).toBeNull();
    expect(
      welcomeExpiryCopy({ tier: 'pro', status: 'trialing', expiresAt: 'not-a-date' }),
    ).toBeNull();
  });

  it('returns null for perpetual licenses even when a date is present', () => {
    expect(
      welcomeExpiryCopy({
        tier: 'pro',
        status: 'active',
        expiresAt: TRIAL_END,
        perpetual: true,
      }),
    ).toBeNull();
  });

  it('names a non-trial end date without calling it a trial', () => {
    const copy = welcomeExpiryCopy({
      tier: 'pro',
      status: 'active',
      expiresAt: TRIAL_END,
    });
    expect(copy).toBe(`Your Pro subscription ends on ${formatTrialEndDate(TRIAL_END)}`);
    expect(copy).not.toContain('trial');
  });
});

describe('isLicenseTierId', () => {
  it('accepts known tiers only', () => {
    expect(isLicenseTierId('pro')).toBe(true);
    expect(isLicenseTierId('max')).toBe(true);
    expect(isLicenseTierId('starter')).toBe(false);
    expect(isLicenseTierId(null)).toBe(false);
  });
});
