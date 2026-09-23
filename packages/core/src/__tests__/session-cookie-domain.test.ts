import { describe, expect, it } from 'vitest';
import {
  isStagingRevealHost,
  normalizeRequestHost,
  requestHostFromHeaders,
  STAGING_SESSION_COOKIE_DOMAIN,
  sessionCookieDomainForHost,
} from '../session-cookie-domain.js';

describe('normalizeRequestHost', () => {
  it('lowercases and trims', () => {
    expect(normalizeRequestHost('  API.Staging.RevealUI.com  ')).toBe('api.staging.revealui.com');
  });

  it('strips a numeric port and a trailing dot', () => {
    expect(normalizeRequestHost('admin.staging.revealui.com.:443')).toBe(
      'admin.staging.revealui.com',
    );
  });

  it('uses the first forwarded-host entry and drops a scheme or path', () => {
    expect(normalizeRequestHost('https://Staging.RevealUI.com/login, api.revealui.com')).toBe(
      'staging.revealui.com',
    );
  });

  it('returns null for empty input', () => {
    expect(normalizeRequestHost(null)).toBeNull();
    expect(normalizeRequestHost('   ')).toBeNull();
    expect(normalizeRequestHost(',api.revealui.com')).toBeNull();
  });
});

describe('isStagingRevealHost', () => {
  it('matches the apex and any subdomain', () => {
    expect(isStagingRevealHost('staging.revealui.com')).toBe(true);
    expect(isStagingRevealHost('api.staging.revealui.com')).toBe(true);
    expect(isStagingRevealHost('admin.staging.revealui.com')).toBe(true);
    expect(isStagingRevealHost('a.b.staging.revealui.com')).toBe(true);
  });

  it('rejects production hosts and lookalikes', () => {
    expect(isStagingRevealHost('revealui.com')).toBe(false);
    expect(isStagingRevealHost('admin.revealui.com')).toBe(false);
    expect(isStagingRevealHost('api.revealui.com')).toBe(false);
    expect(isStagingRevealHost('evilstaging.revealui.com')).toBe(false);
    expect(isStagingRevealHost('staging.revealui.com.evil.com')).toBe(false);
    expect(isStagingRevealHost('notstaging.revealui.com')).toBe(false);
    expect(isStagingRevealHost(undefined)).toBe(false);
  });
});

describe('sessionCookieDomainForHost', () => {
  it('resolves staging hosts to staging.revealui.com even when production domain is configured', () => {
    expect(sessionCookieDomainForHost('staging.revealui.com', '.revealui.com')).toBe(
      STAGING_SESSION_COOKIE_DOMAIN,
    );
    expect(sessionCookieDomainForHost('api.staging.revealui.com:443', '.revealui.com')).toBe(
      'staging.revealui.com',
    );
    expect(sessionCookieDomainForHost('Admin.Staging.RevealUI.com', undefined)).toBe(
      'staging.revealui.com',
    );
  });

  it('returns the configured domain unchanged for production hosts', () => {
    expect(sessionCookieDomainForHost('admin.revealui.com', '.revealui.com')).toBe('.revealui.com');
    expect(sessionCookieDomainForHost('api.revealui.com', '.revealui.com')).toBe('.revealui.com');
    expect(sessionCookieDomainForHost('revealui.com', '.revealui.com')).toBe('.revealui.com');
  });

  it('returns the configured domain exactly when the host is missing', () => {
    expect(sessionCookieDomainForHost(undefined, '.revealui.com')).toBe('.revealui.com');
    expect(sessionCookieDomainForHost(null, undefined)).toBeUndefined();
    expect(sessionCookieDomainForHost('localhost:3000', undefined)).toBeUndefined();
  });
});

describe('requestHostFromHeaders', () => {
  it('prefers Host over X-Forwarded-Host', () => {
    const headers = new Map<string, string>([
      ['host', 'admin.revealui.com'],
      ['x-forwarded-host', 'admin.staging.revealui.com'],
    ]);
    expect(requestHostFromHeaders((name) => headers.get(name))).toBe('admin.revealui.com');
  });

  it('falls back to X-Forwarded-Host when Host is absent', () => {
    const headers = new Map<string, string>([['x-forwarded-host', 'api.staging.revealui.com']]);
    expect(requestHostFromHeaders((name) => headers.get(name))).toBe('api.staging.revealui.com');
  });
});
