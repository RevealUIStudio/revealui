/**
 * CSRF Helper Tests
 *
 * Covers readCsrfToken() cookie parsing and the postSignOut() request shape:
 * the X-CSRF-Token header is echoed exactly when the revealui-csrf cookie is
 * readable, and the request stays byte-identical to the historical bare fetch
 * (no `headers` key at all) when it is not. This package's vitest environment
 * is node, so `document` is absent by default and stubbed per test  -  no
 * happy-dom cookie-jar persistence applies; stubs reset in afterEach.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { postSignOut, readCsrfToken } from '../csrf.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('readCsrfToken', () => {
  it('returns undefined outside the browser (no document)', () => {
    expect(typeof document).toBe('undefined');
    expect(readCsrfToken()).toBeUndefined();
  });

  it('reads the revealui-csrf cookie among other cookies', () => {
    vi.stubGlobal('document', {
      cookie: 'other-cookie=unrelated; revealui-csrf=nonce123:hmac456; later=2',
    });
    expect(readCsrfToken()).toBe('nonce123:hmac456');
  });

  it('returns undefined when the cookie is absent', () => {
    vi.stubGlobal('document', { cookie: 'other-cookie=unrelated' });
    expect(readCsrfToken()).toBeUndefined();
  });

  it('returns undefined when the cookie value is empty', () => {
    vi.stubGlobal('document', { cookie: 'revealui-csrf=' });
    expect(readCsrfToken()).toBeUndefined();
  });

  it('returns the first match when duplicate cookies exist', () => {
    vi.stubGlobal('document', { cookie: 'revealui-csrf=first; revealui-csrf=second' });
    expect(readCsrfToken()).toBe('first');
  });

  it('URL-decodes the value — Next.js cookie.serialize() encodes the colon separator', () => {
    vi.stubGlobal('document', {
      cookie: 'revealui-csrf=nonce123%3Ahmac456',
    });
    expect(readCsrfToken()).toBe('nonce123:hmac456');
  });
});

describe('postSignOut - CSRF token attach', () => {
  it('echoes the revealui-csrf cookie as X-CSRF-Token', async () => {
    vi.stubGlobal('document', { cookie: 'revealui-csrf=nonce123:hmac456' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    await postSignOut();

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/auth/sign-out', {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRF-Token': 'nonce123:hmac456' },
    });
  });

  it('stays byte-identical to the bare fetch when no cookie exists (no headers key)', async () => {
    vi.stubGlobal('document', { cookie: 'other-cookie=unrelated' });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await postSignOut();

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/auth/sign-out', {
      method: 'POST',
      credentials: 'include',
    });
    const init: RequestInit | undefined = fetchMock.mock.calls[0]?.[1];
    expect(Object.keys(init ?? {})).toEqual(['method', 'credentials']);
  });

  it('omits the header when the cookie value is empty', async () => {
    vi.stubGlobal('document', { cookie: 'revealui-csrf=' });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await postSignOut();

    const init: RequestInit | undefined = fetchMock.mock.calls[0]?.[1];
    expect(Object.keys(init ?? {})).toEqual(['method', 'credentials']);
  });

  it('omits the header outside the browser (no document)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await postSignOut();

    const init: RequestInit | undefined = fetchMock.mock.calls[0]?.[1];
    expect(Object.keys(init ?? {})).toEqual(['method', 'credentials']);
  });

  it('re-reads the cookie on every call (proxy may reissue)', async () => {
    const doc = { cookie: 'revealui-csrf=token-before' };
    vi.stubGlobal('document', doc);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    await postSignOut();
    doc.cookie = 'revealui-csrf=token-rotated';
    await postSignOut();

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      '/api/auth/sign-out',
      expect.objectContaining({ headers: { 'X-CSRF-Token': 'token-before' } }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      '/api/auth/sign-out',
      expect.objectContaining({ headers: { 'X-CSRF-Token': 'token-rotated' } }),
    );
  });
});
