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
    document.cookie = 'revealui-session=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    window.history.replaceState({}, '', '/account/license');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('does not redirectToLogin on 401 when revealui-session is present (treat unavailable)', async () => {
    document.cookie = 'revealui-session=sess-abc';
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

  it('redirects to login on 401 when no session cookie is present', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ status: 401, ok: false })),
    );

    await expect(resolveSaasTier()).rejects.toMatchObject({
      kind: 'auth-required',
      name: 'LicenseResolveFailure',
    });
    expect(mockRedirectToLogin).toHaveBeenCalledOnce();
  });
});
