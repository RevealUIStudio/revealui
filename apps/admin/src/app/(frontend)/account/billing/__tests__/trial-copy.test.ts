import { TIER_LABELS } from '@revealui/contracts/pricing';
import { describe, expect, it } from 'vitest';
import {
  perpetualActivatedMessage,
  planLabel,
  resubscribeTier,
  subscriptionActivatedMessage,
  subscriptionExpiredMessage,
  trialEndsBody,
  trialEndsTitle,
} from '../trial-copy';

const TRIAL_END = '2026-08-27T00:00:00.000Z';

describe('billing trial copy is plan-specific', () => {
  it('labels Max as Max, not Pro', () => {
    expect(planLabel('max')).toBe('Max');
    expect(planLabel('max')).toBe(TIER_LABELS.max);
    expect(trialEndsTitle('max', TRIAL_END)).toContain('Max');
    expect(trialEndsTitle('max', TRIAL_END)).not.toContain('Pro');
    expect(subscriptionActivatedMessage('max')).toContain('Max');
    expect(subscriptionActivatedMessage('max')).not.toContain('Pro');
    expect(subscriptionExpiredMessage('max')).toContain('Max');
    expect(subscriptionExpiredMessage('max')).not.toContain('Pro');
    expect(perpetualActivatedMessage('max')).toContain('Max');
    expect(perpetualActivatedMessage('max')).not.toContain('Pro');
  });

  it('labels Pro as Pro', () => {
    expect(planLabel('pro')).toBe('Pro');
    expect(trialEndsTitle('pro', TRIAL_END)).toContain('Pro');
    expect(subscriptionActivatedMessage('pro')).toContain('Pro');
  });

  it('formats the stored trial end date into the title', () => {
    const title = trialEndsTitle('max', TRIAL_END);
    expect(title).toContain('August 27, 2026');
    expect(trialEndsBody('$299/mo')).toContain('$299/mo');
  });

  it('resubscribes Max trials to Max, not Pro', () => {
    expect(resubscribeTier('max')).toBe('max');
    expect(resubscribeTier('pro')).toBe('pro');
    expect(resubscribeTier('enterprise')).toBe('pro');
  });
});
