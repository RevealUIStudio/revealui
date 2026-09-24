import { describe, expect, it } from 'vitest';
import { resolveSentryEnvironment } from '../sentry-environment.js';

describe('resolveSentryEnvironment', () => {
  it('tags the staging API host as staging even when NODE_ENV is production', () => {
    expect(
      resolveSentryEnvironment({
        NODE_ENV: 'production',
        REVEALUI_API_URL: 'https://api.staging.revealui.com',
      }),
    ).toBe('staging');
  });

  it('never lets an explicit production label override a staging host', () => {
    expect(
      resolveSentryEnvironment({
        NODE_ENV: 'production',
        SENTRY_ENVIRONMENT: 'production',
        REVEALUI_API_URL: 'https://api.staging.revealui.com',
      }),
    ).toBe('staging');
  });

  it('allows the locked preview name on a staging host', () => {
    expect(
      resolveSentryEnvironment({
        NODE_ENV: 'production',
        SENTRY_ENVIRONMENT: 'preview',
        NEXT_PUBLIC_SERVER_URL: 'https://admin.staging.revealui.com',
      }),
    ).toBe('preview');
  });

  it('tags the production API host as production', () => {
    expect(
      resolveSentryEnvironment({
        NODE_ENV: 'production',
        REVEALUI_API_URL: 'https://api.revealui.com',
      }),
    ).toBe('production');
  });

  it('reads SENTRY_ENVIRONMENT before REVEALUI_DEPLOY_ENV', () => {
    expect(
      resolveSentryEnvironment({
        NODE_ENV: 'production',
        SENTRY_ENVIRONMENT: 'staging',
        REVEALUI_DEPLOY_ENV: 'production',
        REVEALUI_API_URL: 'https://api.revealui.com',
      }),
    ).toBe('staging');
  });

  it('accepts NEXT_PUBLIC_SENTRY_ENVIRONMENT when the server name is unset', () => {
    expect(
      resolveSentryEnvironment({
        NODE_ENV: 'production',
        NEXT_PUBLIC_SENTRY_ENVIRONMENT: 'staging',
      }),
    ).toBe('staging');
  });

  it('treats the staging cookie domain as a staging deploy', () => {
    expect(
      resolveSentryEnvironment({
        NODE_ENV: 'production',
        SESSION_COOKIE_DOMAIN: 'staging.revealui.com',
      }),
    ).toBe('staging');
  });

  it('uses preview for Vercel preview when no staging host is configured', () => {
    expect(
      resolveSentryEnvironment({
        NODE_ENV: 'production',
        VERCEL_ENV: 'preview',
        VERCEL_URL: 'revealui-api-git-test.vercel.app',
      }),
    ).toBe('preview');
  });

  it('keeps a production NODE_ENV deploy as production when no staging signal exists', () => {
    expect(resolveSentryEnvironment({ NODE_ENV: 'production' })).toBe('production');
  });

  it('does not treat lookalike hosts as staging', () => {
    expect(
      resolveSentryEnvironment({
        NODE_ENV: 'production',
        REVEALUI_API_URL: 'https://evilstaging.revealui.com',
      }),
    ).toBe('production');
  });

  it('defaults local and test runs away from production', () => {
    expect(resolveSentryEnvironment({ NODE_ENV: 'development' })).toBe('development');
    expect(resolveSentryEnvironment({ NODE_ENV: 'test' })).toBe('test');
    expect(resolveSentryEnvironment({})).toBe('development');
  });
});
