import { describe, expect, it } from 'vitest';
import { getStudioDomainConfig, getStudioFulfillmentConfig } from '../modules/optional.js';
import { envSchema } from '../schema.js';

const secret = 'test-studio-owner-session-32-characters';
const required = {
  REVEALUI_SECRET: secret,
  REVEALUI_PUBLIC_SERVER_URL: 'https://admin.example.test',
  NEXT_PUBLIC_SERVER_URL: 'https://admin.example.test',
  POSTGRES_URL: 'postgresql://synthetic/test',
};
describe('optional Studio fulfillment configuration', () => {
  it('leaves the feature absent for self-hosts and empty injected values', () => {
    expect(getStudioFulfillmentConfig({})).toBeNull();
    expect(
      getStudioFulfillmentConfig({ STUDIO_SITE_URL: '', STUDIO_OWNER_SESSION: ' ' }),
    ).toBeNull();
    expect(envSchema.safeParse(required).success).toBe(true);
  });
  it('supports only a complete server destination and owner credential', () => {
    expect(
      getStudioFulfillmentConfig({
        STUDIO_SITE_URL: 'https://studio.example.test/',
        STUDIO_OWNER_SESSION: secret,
      }),
    ).toEqual({ origin: 'https://studio.example.test', ownerSession: secret });
    for (const env of [
      { STUDIO_SITE_URL: 'https://studio.example.test' },
      { STUDIO_OWNER_SESSION: secret },
    ]) {
      expect(() => getStudioFulfillmentConfig(env)).toThrow('configured together');
      expect(envSchema.safeParse({ ...required, ...env }).success).toBe(false);
    }
  });
  it.each([
    'http://studio.example.test',
    'https://user:pass@studio.example.test',
    'https://studio.example.test/path',
    'https://studio.example.test/?token=x',
    'https://studio.example.test/#fragment',
  ])('rejects unsafe destination %s', (origin) => {
    expect(() =>
      getStudioFulfillmentConfig({ STUDIO_SITE_URL: origin, STUDIO_OWNER_SESSION: secret }),
    ).toThrow();
  });
  it('rejects a short credential', () => {
    expect(() =>
      getStudioFulfillmentConfig({
        STUDIO_SITE_URL: 'https://studio.example.test',
        STUDIO_OWNER_SESSION: 'short',
      }),
    ).toThrow('32 characters');
  });
});

describe('optional Studio provider domain configuration', () => {
  it('does not require domains for self-hosts or unrelated Vercel token usage', () => {
    expect(getStudioDomainConfig({})).toBeNull();
    expect(getStudioDomainConfig({ VERCEL_TOKEN: 'existing-token' })).toBeNull();
    expect(
      getStudioDomainConfig({ STUDIO_VERCEL_TOKEN: '', STUDIO_VERCEL_PROJECT_ID: '' }),
    ).toBeNull();
  });
  it('uses a canonical project and optional team with a dedicated server-only token', () => {
    expect(
      getStudioDomainConfig({
        STUDIO_VERCEL_TOKEN: 'scoped-token',
        STUDIO_VERCEL_PROJECT_ID: 'prj_123',
        STUDIO_VERCEL_TEAM_ID: 'team_123',
      }),
    ).toEqual({ token: 'scoped-token', projectId: 'prj_123', teamId: 'team_123' });
    expect(
      getStudioDomainConfig({
        STUDIO_VERCEL_TOKEN: 'scoped-token',
        STUDIO_VERCEL_PROJECT_ID: 'prj_123',
      }),
    ).toEqual({ token: 'scoped-token', projectId: 'prj_123' });
  });
  it.each([
    { STUDIO_VERCEL_PROJECT_ID: 'prj_123' },
    { STUDIO_VERCEL_TOKEN: 'scoped-token' },
    { STUDIO_VERCEL_TOKEN: 'scoped-token', STUDIO_VERCEL_TEAM_ID: 'team_123' },
    { STUDIO_VERCEL_TOKEN: 'scoped-token', STUDIO_VERCEL_PROJECT_ID: '../wrong' },
    {
      STUDIO_VERCEL_TOKEN: 'scoped-token',
      STUDIO_VERCEL_PROJECT_ID: 'prj_123',
      STUDIO_VERCEL_TEAM_ID: '?team=wrong',
    },
  ])('rejects incomplete or noncanonical provider configuration %j', (env) => {
    expect(() => getStudioDomainConfig(env)).toThrow();
    expect(envSchema.safeParse({ ...required, ...env }).success).toBe(false);
  });
});
