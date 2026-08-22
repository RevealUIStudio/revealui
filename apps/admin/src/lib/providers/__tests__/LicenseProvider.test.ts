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

function setSessionCookie(value: string): void {
  document.cookie = `revealui-session=${value}; path=/`;
}

function clearSessionCookie(): void {
  document.cookie = 'revealui-session=; max-age=0; path=/';
}

describe('resolveSaasTier — cross-origin subscription 401', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.revealui.com');
    clearSessionCookie();
    window.history.replaceState({}, '', '/account/license');
  });

  afterEach(() => {
    clearSessionCookie();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('does not redirectToLogin on 401 when revealui-session is present (treat unavailable)', async () => {
    setSessionCookie('sess-abc');
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
