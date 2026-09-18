/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockRedirectToLogin = vi.fn();

vi.mock('@/lib/auth/redirect-to-login', () => ({
  isPreAuthPublicPath: (pathname: string) =>
    pathname === '/login' || pathname === '/mfa' || pathname === '/signup',
  redirectToLogin: (...args: unknown[]) => mockRedirectToLogin(...args),
}));

import { resolveSaasTier } from '../LicenseProvider';

describe('resolveSaasTier — cross-origin subscription 401', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.revealui.com');
    window.history.replaceState({}, '', '/account/license');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('treats a subscription 401 as unavailable and does not redirectToLogin', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ status: 401, ok: false })),
    );

    await expect(resolveSaasTier()).rejects.toMatchObject({
      kind: 'unavailable',
      name: 'LicenseResolveFailure',
    });
    expect(mockRedirectToLogin).not.toHaveBeenCalled();
  });

  it('probes subscription on the same-origin proxy, not the API host', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.staging.revealui.com');
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        status: 200,
        ok: true,
        json: () => Promise.resolve({ tier: 'pro' }),
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(resolveSaasTier()).resolves.toBe('pro');
    expect(fetchMock).toHaveBeenCalledWith('/api/billing/subscription', {
      credentials: 'include',
    });
  });

  it('promotes Free + Unlimited usage quota to enterprise (fleet-operator honesty)', async () => {
    const fetchMock = vi.fn((input: RequestInfo) => {
      const url = String(input);
      if (url.includes('/api/billing/subscription')) {
        return Promise.resolve({
          status: 200,
          ok: true,
          json: () => Promise.resolve({ tier: 'free' }),
        });
      }
      return Promise.resolve({
        status: 200,
        ok: true,
        json: () => Promise.resolve({ quota: -1, weekUsed: 0 }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(resolveSaasTier()).resolves.toBe('enterprise');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.revealui.com/api/billing/usage',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('promotes a failed subscription probe to enterprise when usage is Unlimited', async () => {
    const fetchMock = vi.fn((input: RequestInfo) => {
      const url = String(input);
      if (url.includes('/api/billing/subscription')) {
        return Promise.resolve({ status: 401, ok: false });
      }
      return Promise.resolve({
        status: 200,
        ok: true,
        json: () => Promise.resolve({ quota: -1 }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(resolveSaasTier()).resolves.toBe('enterprise');
  });

  it('keeps Free locked when usage is a finite Free/Pro allotment', async () => {
    const fetchMock = vi.fn((input: RequestInfo) => {
      const url = String(input);
      if (url.includes('/api/billing/subscription')) {
        return Promise.resolve({
          status: 200,
          ok: true,
          json: () => Promise.resolve({ tier: 'free' }),
        });
      }
      return Promise.resolve({
        status: 200,
        ok: true,
        json: () => Promise.resolve({ quota: 0, weekUsed: 0 }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(resolveSaasTier()).resolves.toBe('free');
  });
});
