/**
 * Session Cookie Domain Helper Tests
 *
 * Unit tests for sessionCookieDomain / requireSessionCookieDomain  -  the
 * shared derivation behind every auth-cookie set site and the sign-out
 * clearing path (route-level coverage lives in the auth route suites).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { logger } from '@revealui/utils/logger';
import { requireSessionCookieDomain, sessionCookieDomain } from '../../lib/utils/session-cookies';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('sessionCookieDomain', () => {
  it('returns undefined outside production even when the variable is set', () => {
    vi.stubEnv('SESSION_COOKIE_DOMAIN', '.revealui.com');
    expect(sessionCookieDomain()).toBeUndefined();
  });

  it('returns the configured domain in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SESSION_COOKIE_DOMAIN', '.revealui.com');
    expect(sessionCookieDomain()).toBe('.revealui.com');
  });

  it('treats an empty string as unset so the cookie stays host-only', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SESSION_COOKIE_DOMAIN', '');
    expect(sessionCookieDomain()).toBeUndefined();
  });

  it('stays silent on a missing variable without logIfMissing', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SESSION_COOKIE_DOMAIN', '');
    sessionCookieDomain();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs an error on a missing variable in production with logIfMissing', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SESSION_COOKIE_DOMAIN', '');
    expect(sessionCookieDomain({ logIfMissing: true })).toBeUndefined();
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      'SESSION_COOKIE_DOMAIN env var is required in production  -  session cookie will not be set cross-subdomain',
    );
  });

  it('does not log when the variable is set in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SESSION_COOKIE_DOMAIN', '.revealui.com');
    expect(sessionCookieDomain({ logIfMissing: true })).toBe('.revealui.com');
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('does not log outside production even with logIfMissing', () => {
    vi.stubEnv('SESSION_COOKIE_DOMAIN', '');
    expect(sessionCookieDomain({ logIfMissing: true })).toBeUndefined();
    expect(logger.error).not.toHaveBeenCalled();
  });
});

describe('requireSessionCookieDomain', () => {
  it('returns undefined outside production without throwing', () => {
    vi.stubEnv('SESSION_COOKIE_DOMAIN', '');
    expect(requireSessionCookieDomain()).toBeUndefined();
  });

  it('returns the configured domain in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SESSION_COOKIE_DOMAIN', '.revealui.com');
    expect(requireSessionCookieDomain()).toBe('.revealui.com');
  });

  it('throws in production on a hosted deployment when the variable is missing', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SESSION_COOKIE_DOMAIN', '');
    // Hosted SaaS signal: REVEALUI_LICENSE_PRIVATE_KEY present (see
    // @revealui/core/deployment-mode isHostedDeployment).
    vi.stubEnv('REVEALUI_LICENSE_PRIVATE_KEY', 'a-private-key');
    expect(() => requireSessionCookieDomain()).toThrow(
      'SESSION_COOKIE_DOMAIN env var is required in production for cross-subdomain auth on a RevealUI Studio hosted deployment',
    );
  });

  it('falls back to host-only under REVEALUI_FLEET_MODE instead of throwing', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SESSION_COOKIE_DOMAIN', '');
    vi.stubEnv('REVEALUI_FLEET_MODE', 'true');
    expect(requireSessionCookieDomain()).toBeUndefined();
  });

  // GAP-446: a fresh, unlicensed self-host (e.g. the Railway marketplace
  // template) has no REVEALUI_LICENSE_PRIVATE_KEY, no REVEALUI_DEPLOYMENT_MODE,
  // and no REVEALUI_FLEET_MODE — exactly the env shape env-validation.ts's
  // `isSaasHosted` already treats as "SESSION_COOKIE_DOMAIN not required" at
  // boot. This must agree at request time too, or a correct login 500s.
  it('falls back to host-only on a plain unlicensed self-host instead of throwing', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SESSION_COOKIE_DOMAIN', '');
    expect(requireSessionCookieDomain()).toBeUndefined();
  });
});
