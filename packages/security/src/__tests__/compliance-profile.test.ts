import { afterEach, describe, expect, it } from 'vitest';
import {
  HIPAA_COMPLIANCE_PROFILE,
  HIPAA_IDLE_TIMEOUT_SECONDS,
  isHipaaProfile,
  parseComplianceProfileId,
  resolveComplianceProfile,
  STANDARD_COMPLIANCE_PROFILE,
} from '../compliance-profile.js';

afterEach(() => {
  delete process.env.REVEALUI_COMPLIANCE_PROFILE;
  delete process.env.VITE_COMPLIANCE_PROFILE;
  delete process.env.NEXT_PUBLIC_COMPLIANCE_PROFILE;
});

describe('parseComplianceProfileId', () => {
  it('defaults unknown and empty values to standard', () => {
    expect(parseComplianceProfileId(undefined)).toBe('standard');
    expect(parseComplianceProfileId('')).toBe('standard');
    expect(parseComplianceProfileId('soc2')).toBe('standard');
  });

  it('accepts hipaa case-insensitively', () => {
    expect(parseComplianceProfileId('HIPAA')).toBe('hipaa');
    expect(parseComplianceProfileId(' hipaa ')).toBe('hipaa');
  });
});

describe('resolveComplianceProfile', () => {
  it('returns the standard profile by default', () => {
    expect(resolveComplianceProfile({})).toEqual(STANDARD_COMPLIANCE_PROFILE);
    expect(STANDARD_COMPLIANCE_PROFILE.allowThirdPartyTelemetry).toBe(true);
    expect(STANDARD_COMPLIANCE_PROFILE.allowOptionalCookies).toBe(true);
    expect(STANDARD_COMPLIANCE_PROFILE.sessionIdleTimeoutSeconds).toBe(0);
  });

  it('returns the HIPAA profile from REVEALUI_COMPLIANCE_PROFILE', () => {
    const profile = resolveComplianceProfile({ REVEALUI_COMPLIANCE_PROFILE: 'hipaa' });
    expect(profile).toEqual(HIPAA_COMPLIANCE_PROFILE);
    expect(isHipaaProfile(profile)).toBe(true);
    expect(profile.allowThirdPartyTelemetry).toBe(false);
    expect(profile.allowOptionalCookies).toBe(false);
    expect(profile.sessionIdleTimeoutSeconds).toBe(HIPAA_IDLE_TIMEOUT_SECONDS);
    expect(HIPAA_IDLE_TIMEOUT_SECONDS).toBe(15 * 60);
  });

  it('reads Vite and Next public aliases', () => {
    expect(resolveComplianceProfile({ VITE_COMPLIANCE_PROFILE: 'hipaa' }).id).toBe('hipaa');
    expect(resolveComplianceProfile({ NEXT_PUBLIC_COMPLIANCE_PROFILE: 'hipaa' }).id).toBe('hipaa');
  });
});
