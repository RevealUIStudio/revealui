/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isPreAuthPublicPath, redirectToLogin } from '../redirect-to-login';

describe('isPreAuthPublicPath', () => {
  it('recognizes MFA and login surfaces', () => {
    expect(isPreAuthPublicPath('/mfa')).toBe(true);
    expect(isPreAuthPublicPath('/mfa?upgrade=pro')).toBe(false); // pathname only
    expect(isPreAuthPublicPath('/login')).toBe(true);
    expect(isPreAuthPublicPath('/signup')).toBe(true);
    expect(isPreAuthPublicPath('/rotate-password')).toBe(true);
    expect(isPreAuthPublicPath('/reset-password')).toBe(true);
    expect(isPreAuthPublicPath('/setup')).toBe(true);
    expect(isPreAuthPublicPath('/')).toBe(false);
    expect(isPreAuthPublicPath('/settings/api-keys')).toBe(false);
  });
});

describe('redirectToLogin', () => {
  const assign = vi.fn();

  beforeEach(() => {
    assign.mockReset();
    vi.stubGlobal('window', {
      location: {
        pathname: '/',
        search: '',
        hash: '',
        assign,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not bounce when already on /mfa (MFA challenge has no full session)', () => {
    window.location.pathname = '/mfa';
    redirectToLogin();
    expect(assign).not.toHaveBeenCalled();
  });

  it('does not bounce when already on /login', () => {
    window.location.pathname = '/login';
    redirectToLogin();
    expect(assign).not.toHaveBeenCalled();
  });

  it('sends protected paths to login with returnUrl', () => {
    window.location.pathname = '/settings/api-keys';
    window.location.search = '';
    redirectToLogin();
    expect(assign).toHaveBeenCalledWith('/login?returnUrl=%2Fsettings%2Fapi-keys');
  });
});
