/**
 * Cron Authentication Tests
 *
 * Tests for verifyCronAuth() — timing-safe token verification for Vercel cron jobs.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };
const TEST_SECRET = 'aaaa-bbbb-cccc-dddd'; // gitleaks:allow

describe('verifyCronAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVEALUI_CRON_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  async function loadFn() {
    const mod = await import('../cron-auth.js');
    return mod.verifyCronAuth;
  }

  function makeRequest(authHeader?: string) {
    return {
      headers: {
        get: (key: string) => (key === 'authorization' ? (authHeader ?? null) : null),
      },
    } as never;
  }

  it('returns true when token matches secret', async () => {
    const verify = await loadFn();
    const result = verify(makeRequest(`Bearer ${TEST_SECRET}`));
    expect(result).toBe(true);
  });

  it('returns false when no secret is configured', async () => {
    delete process.env.REVEALUI_CRON_SECRET;
    const verify = await loadFn();
    const result = verify(makeRequest('Bearer anything'));
    expect(result).toBe(false);
  });

  it('returns false when no authorization header', async () => {
    const verify = await loadFn();
    const result = verify(makeRequest());
    expect(result).toBe(false);
  });

  it('returns false when authorization header is not Bearer', async () => {
    const verify = await loadFn();
    const result = verify(makeRequest('Basic dXNlcjpwYXNz'));
    expect(result).toBe(false);
  });

  it('returns false when token does not match', async () => {
    const verify = await loadFn();
    const result = verify(makeRequest('Bearer xxxx-yyyy-zzzz-wwww'));
    expect(result).toBe(false);
  });

  it('returns false when token length differs from secret', async () => {
    const verify = await loadFn();
    const result = verify(makeRequest('Bearer short'));
    expect(result).toBe(false);
  });

  it('uses timing-safe comparison (same length, wrong value)', async () => {
    const verify = await loadFn();
    // Same length as TEST_SECRET (19 chars)
    const result = verify(makeRequest('Bearer zzzz-zzzz-zzzz-zzzz'));
    expect(result).toBe(false);
  });
});
