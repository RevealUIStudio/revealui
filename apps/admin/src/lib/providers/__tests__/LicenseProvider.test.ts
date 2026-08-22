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
});
