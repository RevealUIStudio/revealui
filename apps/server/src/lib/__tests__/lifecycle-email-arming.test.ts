/**
 * Hosted-test lifecycle email arming — fail closed, no CI mail, no production flip.
 */
import { describe, expect, it } from 'vitest';
import {
  HOSTED_TEST_HOSTNAMES,
  HOSTED_TEST_ROOT_DOMAIN,
  isLifecycleEligibleTier,
  isLifecycleMailboxConfigured,
  resolveLifecycleEmailArming,
} from '../lifecycle-email-arming.js';

const MAILBOX = {
  GOOGLE_SERVICE_ACCOUNT_EMAIL: 'sa@project.iam.gserviceaccount.com',
  GOOGLE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----',
} as const;

describe('isLifecycleMailboxConfigured', () => {
  it('requires both Gmail service-account fields', () => {
    expect(isLifecycleMailboxConfigured({})).toBe(false);
    expect(
      isLifecycleMailboxConfigured({
        GOOGLE_SERVICE_ACCOUNT_EMAIL: MAILBOX.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      }),
    ).toBe(false);
    expect(isLifecycleMailboxConfigured({ GOOGLE_PRIVATE_KEY: MAILBOX.GOOGLE_PRIVATE_KEY })).toBe(
      false,
    );
    expect(isLifecycleMailboxConfigured(MAILBOX)).toBe(true);
  });
});

describe('isLifecycleEligibleTier', () => {
  it('allows Pro and Max only', () => {
    expect(isLifecycleEligibleTier('pro')).toBe(true);
    expect(isLifecycleEligibleTier('max')).toBe(true);
    expect(isLifecycleEligibleTier('free')).toBe(false);
    expect(isLifecycleEligibleTier('enterprise')).toBe(false);
  });
});

describe('resolveLifecycleEmailArming', () => {
  it('never arms in CI (NODE_ENV=test), even with mailbox + flag', () => {
    const result = resolveLifecycleEmailArming({
      ...MAILBOX,
      NODE_ENV: 'test',
      LIFECYCLE_EMAILS_ENABLED: 'true',
      VERCEL_ENV: 'preview',
    });
    expect(result.armed).toBe(false);
    expect(result.reason).toBe('ci');
  });

  it('fails closed when the Gmail mailbox path is missing', () => {
    const hostedTest = resolveLifecycleEmailArming({
      NODE_ENV: 'production',
      VERCEL_ENV: 'preview',
      LIFECYCLE_EMAILS_ENABLED: 'true',
    });
    expect(hostedTest.armed).toBe(false);
    expect(hostedTest.reason).toBe('mailbox-missing');
  });

  it('arms the hosted test path when mailbox is present (staging host)', () => {
    expect(HOSTED_TEST_HOSTNAMES).toContain(`api.${HOSTED_TEST_ROOT_DOMAIN}`);
    for (const hostname of HOSTED_TEST_HOSTNAMES) {
      const result = resolveLifecycleEmailArming({
        ...MAILBOX,
        NODE_ENV: 'production',
        REVEALUI_API_URL: `https://${hostname}/v1`,
      });
      expect(result.armed).toBe(true);
      expect(result.reason).toBe('hosted-test-mailbox');
    }
  });

  it('does not treat a substring of staging.revealui.com as hosted test', () => {
    const spoofedQuery = resolveLifecycleEmailArming({
      ...MAILBOX,
      NODE_ENV: 'production',
      VERCEL_ENV: 'production',
      VERCEL_GIT_COMMIT_REF: 'main',
      REVEALUI_API_URL: `https://evil.example.com/?next=https://api.${HOSTED_TEST_ROOT_DOMAIN}`,
    });
    expect(spoofedQuery.armed).toBe(false);
    expect(spoofedQuery.reason).toBe('production-hold');

    const spoofedPrefix = resolveLifecycleEmailArming({
      ...MAILBOX,
      NODE_ENV: 'production',
      VERCEL_ENV: 'production',
      VERCEL_GIT_COMMIT_REF: 'main',
      REVEALUI_API_URL: `https://not${HOSTED_TEST_ROOT_DOMAIN}`,
    });
    expect(spoofedPrefix.armed).toBe(false);

    const spoofedSuffixHost = resolveLifecycleEmailArming({
      ...MAILBOX,
      NODE_ENV: 'production',
      VERCEL_ENV: 'production',
      VERCEL_GIT_COMMIT_REF: 'main',
      REVEALUI_API_URL: `https://${HOSTED_TEST_ROOT_DOMAIN}.evil.example`,
    });
    expect(spoofedSuffixHost.armed).toBe(false);
  });

  it('fails closed on an unparseable URL instead of scanning the string', () => {
    const result = resolveLifecycleEmailArming({
      ...MAILBOX,
      NODE_ENV: 'production',
      VERCEL_ENV: 'production',
      VERCEL_GIT_COMMIT_REF: 'main',
      REVEALUI_API_URL: `not-a-url/${HOSTED_TEST_ROOT_DOMAIN}`,
    });
    expect(result.armed).toBe(false);
    expect(result.reason).toBe('production-hold');
  });

  it('arms Vercel preview when mailbox is present', () => {
    const result = resolveLifecycleEmailArming({
      ...MAILBOX,
      NODE_ENV: 'production',
      VERCEL_ENV: 'preview',
    });
    expect(result.armed).toBe(true);
    expect(result.reason).toBe('hosted-test-mailbox');
  });

  it('arms the test git branch when mailbox is present', () => {
    const result = resolveLifecycleEmailArming({
      ...MAILBOX,
      NODE_ENV: 'production',
      VERCEL_ENV: 'production',
      VERCEL_GIT_COMMIT_REF: 'test',
    });
    expect(result.armed).toBe(true);
    expect(result.reason).toBe('hosted-test-mailbox');
  });

  it('keeps production (main) disarmed without an explicit flag', () => {
    const result = resolveLifecycleEmailArming({
      ...MAILBOX,
      NODE_ENV: 'production',
      VERCEL_ENV: 'production',
      VERCEL_GIT_COMMIT_REF: 'main',
    });
    expect(result.armed).toBe(false);
    expect(result.reason).toBe('production-hold');
  });

  it('does not treat an explicit production flag as a test-env arm', () => {
    const result = resolveLifecycleEmailArming({
      ...MAILBOX,
      NODE_ENV: 'production',
      VERCEL_ENV: 'production',
      VERCEL_GIT_COMMIT_REF: 'main',
      LIFECYCLE_EMAILS_ENABLED: 'true',
    });
    expect(result.armed).toBe(true);
    expect(result.reason).toBe('explicit-flag');
  });

  it('honors an explicit disable even on hosted test', () => {
    const result = resolveLifecycleEmailArming({
      ...MAILBOX,
      NODE_ENV: 'production',
      VERCEL_ENV: 'preview',
      LIFECYCLE_EMAILS_ENABLED: 'false',
    });
    expect(result.armed).toBe(false);
    expect(result.reason).toBe('explicitly-disabled');
  });
});
