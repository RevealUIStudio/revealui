import { describe, expect, it } from 'vitest';
import { getHostedLimitsForTier, getPerpetualLicenseMintLimits } from '../tier-limits.js';

describe('getPerpetualLicenseMintLimits (GAP-448 Agency Founding Kit)', () => {
  it('Agency / max perpetual is capped at 10 client deployments', () => {
    expect(getPerpetualLicenseMintLimits('max')).toEqual({
      maxSites: 10,
      maxUsers: 100,
    });
  });

  it('does not loosen hosted Max multi-site limits (15 sites)', () => {
    expect(getHostedLimitsForTier('max').maxSites).toBe(15);
    expect(getPerpetualLicenseMintLimits('max').maxSites).toBe(10);
  });

  it('pro perpetual keeps five sites', () => {
    expect(getPerpetualLicenseMintLimits('pro')).toEqual({
      maxSites: 5,
      maxUsers: 25,
    });
  });

  it('enterprise perpetual omits site/user caps', () => {
    expect(getPerpetualLicenseMintLimits('enterprise')).toEqual({});
  });
});
