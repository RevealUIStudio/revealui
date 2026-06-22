import { afterEach, describe, expect, it, vi } from 'vitest';
import { csrfHeaders, getCsrfToken } from '../csrf.js';

function seedCookie(cookie: string): void {
  document.cookie = cookie;
}

function expireCookie(name: string): void {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

afterEach(() => {
  // Unstub before touching document — a test may have stubbed it to undefined
  vi.unstubAllGlobals();
  expireCookie('revealui-csrf');
  expireCookie('other');
  expireCookie('x-revealui-csrf');
});

describe('getCsrfToken', () => {
  it('returns null when the cookie is absent', () => {
    expect(getCsrfToken()).toBeNull();
  });

  it('reads the token value', () => {
    seedCookie('revealui-csrf=tok-123');
    expect(getCsrfToken()).toBe('tok-123');
  });

  it('finds the token among other cookies', () => {
    seedCookie('other=1');
    seedCookie('revealui-csrf=tok-456');
    expect(getCsrfToken()).toBe('tok-456');
  });

  it('returns null for an empty value', () => {
    seedCookie('revealui-csrf=');
    expect(getCsrfToken()).toBeNull();
  });

  it('does not match cookie names that merely contain the csrf cookie name', () => {
    seedCookie('x-revealui-csrf=evil');
    expect(getCsrfToken()).toBeNull();
  });

  it('returns null outside a browser context', () => {
    vi.stubGlobal('document', undefined);
    expect(getCsrfToken()).toBeNull();
  });
});

describe('csrfHeaders', () => {
  it('returns the header for a relative URL when the cookie is set', () => {
    seedCookie('revealui-csrf=tok-123');
    expect(csrfHeaders('/api/sync/items')).toEqual({ 'X-CSRF-Token': 'tok-123' });
  });

  it('returns the header for an absolute same-origin URL', () => {
    seedCookie('revealui-csrf=tok-123');
    expect(csrfHeaders(`${window.location.origin}/api/sync/items`)).toEqual({
      'X-CSRF-Token': 'tok-123',
    });
  });

  it('returns an empty object for a cross-origin URL', () => {
    seedCookie('revealui-csrf=tok-123');
    expect(csrfHeaders('https://admin.example.com/api/sync/items')).toEqual({});
  });

  it('returns an empty object for an unparseable URL', () => {
    seedCookie('revealui-csrf=tok-123');
    expect(csrfHeaders('http://')).toEqual({});
  });

  it('returns an empty object when the cookie is not set', () => {
    expect(csrfHeaders('/api/sync/items')).toEqual({});
  });

  it('returns an empty object outside a browser context', () => {
    vi.stubGlobal('window', undefined);
    expect(csrfHeaders('/api/sync/items')).toEqual({});
  });
});
