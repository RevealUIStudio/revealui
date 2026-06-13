/**
 * Media-upload CSRF helper tests
 *
 * Covers the postMediaUpload() request shape: the X-CSRF-Token header is
 * echoed exactly when the revealui-csrf cookie is readable, and the request
 * stays byte-identical to the historical bare fetch (no `headers` key at
 * all) when it is not. Content-Type is asserted ABSENT in every case -
 * fetch must derive the multipart boundary from the FormData body. This
 * package's vitest environment is node, so `document` is absent by default
 * and stubbed per test; stubs reset in afterEach.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { postMediaUpload } from '../upload.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function makeUpload(): { body: FormData; signal: AbortSignal } {
  const body = new FormData();
  body.append('file', new Blob(['x'], { type: 'image/png' }), 'x.png');
  return { body, signal: new AbortController().signal };
}

describe('postMediaUpload - CSRF token attach', () => {
  it('echoes the revealui-csrf cookie as X-CSRF-Token', async () => {
    vi.stubGlobal('document', { cookie: 'revealui-csrf=nonce123:hmac456' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    const { body, signal } = makeUpload();

    await postMediaUpload('/api/media', body, signal);

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/media', {
      method: 'POST',
      body,
      signal,
      headers: { 'X-CSRF-Token': 'nonce123:hmac456' },
    });
  });

  it('never sets Content-Type (FormData owns the multipart boundary)', async () => {
    vi.stubGlobal('document', { cookie: 'revealui-csrf=nonce123:hmac456' });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const { body, signal } = makeUpload();

    await postMediaUpload('/api/media', body, signal);

    const init: RequestInit | undefined = fetchMock.mock.calls[0]?.[1];
    expect(Object.keys(init?.headers ?? {})).toEqual(['X-CSRF-Token']);
  });

  it('stays byte-identical to the bare fetch when no cookie exists (no headers key)', async () => {
    vi.stubGlobal('document', { cookie: 'other-cookie=unrelated' });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const { body, signal } = makeUpload();

    await postMediaUpload('/api/media', body, signal);

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/media', {
      method: 'POST',
      body,
      signal,
    });
    const init: RequestInit | undefined = fetchMock.mock.calls[0]?.[1];
    expect(Object.keys(init ?? {})).toEqual(['method', 'body', 'signal']);
  });

  it('omits the header when the cookie value is empty', async () => {
    vi.stubGlobal('document', { cookie: 'revealui-csrf=' });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const { body, signal } = makeUpload();

    await postMediaUpload('/api/media', body, signal);

    const init: RequestInit | undefined = fetchMock.mock.calls[0]?.[1];
    expect(Object.keys(init ?? {})).toEqual(['method', 'body', 'signal']);
  });

  it('omits the header outside the browser (no document)', async () => {
    expect(typeof document).toBe('undefined');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const { body, signal } = makeUpload();

    await postMediaUpload('/api/media', body, signal);

    const init: RequestInit | undefined = fetchMock.mock.calls[0]?.[1];
    expect(Object.keys(init ?? {})).toEqual(['method', 'body', 'signal']);
  });

  it('re-reads the cookie on every call and posts to the given endpoint', async () => {
    const doc = { cookie: 'revealui-csrf=token-before' };
    vi.stubGlobal('document', doc);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    const { body, signal } = makeUpload();

    await postMediaUpload('/custom/upload', body, signal);
    doc.cookie = 'revealui-csrf=token-rotated';
    await postMediaUpload('/custom/upload', body, signal);

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      '/custom/upload',
      expect.objectContaining({ headers: { 'X-CSRF-Token': 'token-before' } }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      '/custom/upload',
      expect.objectContaining({ headers: { 'X-CSRF-Token': 'token-rotated' } }),
    );
  });
});
