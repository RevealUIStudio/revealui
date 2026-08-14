import { describe, expect, it } from 'vitest';
import { shouldInitClientSentry, shouldInitSentry, shouldInitSentryFromEnv } from '../sentry-gate';

describe('shouldInitClientSentry', () => {
  it('skips init when NEXT_PUBLIC_COMPLIANCE_PROFILE is hipaa', () => {
    expect(shouldInitClientSentry('hipaa')).toBe(false);
    expect(shouldInitClientSentry('HIPAA')).toBe(false);
  });

  it('inits on the standard public profile', () => {
    expect(shouldInitClientSentry(undefined)).toBe(true);
    expect(shouldInitClientSentry('')).toBe(true);
    expect(shouldInitClientSentry('standard')).toBe(true);
  });
});

describe('shouldInitSentry', () => {
  it('inits only when the server-passed telemetry flag is true', () => {
    expect(shouldInitSentry(true)).toBe(true);
    expect(shouldInitSentry(false)).toBe(false);
  });
});

describe('shouldInitSentryFromEnv', () => {
  it('skips Sentry in the HIPAA profile', () => {
    expect(shouldInitSentryFromEnv({ REVEALUI_COMPLIANCE_PROFILE: 'hipaa' })).toBe(false);
  });

  it('allows Sentry on the standard profile', () => {
    expect(shouldInitSentryFromEnv({})).toBe(true);
  });
});
