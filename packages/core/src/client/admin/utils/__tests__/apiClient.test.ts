import { afterEach, describe, expect, it, vi } from 'vitest';
import { APIClient, APIErrorType } from '../apiClient.js';

afterEach(() => vi.unstubAllGlobals());

describe('collection request scope', () => {
  it('preserves a correctable conflict through the normal write transport', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ message: 'Choose another address.' }), { status: 409 }),
        ),
    );
    await expect(
      new APIClient().create({ collection: 'sites', data: { name: 'New', slug: 'taken' } }),
    ).rejects.toMatchObject({
      type: APIErrorType.Validation,
      status: 409,
      message: 'Choose another address.',
    });
  });
  it('encodes an explicit scope and offset through the existing collection transport', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ docs: [], totalDocs: 3, limit: 1, offset: 1 }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetch);
    const result = await new APIClient({ baseURL: 'https://admin.example' }).find({
      collection: 'pages',
      offset: 1,
      limit: 1,
      scope: { field: 'siteId', value: 'owned/site' },
    });
    const url = new URL(fetch.mock.calls[0]?.[0]);
    expect(url.pathname).toBe('/api/collections/pages');
    expect(url.searchParams.get('siteId')).toBe('owned/site');
    expect(url.searchParams.get('offset')).toBe('1');
    expect(result).toMatchObject({ totalDocs: 3, limit: 1, offset: 1 });
  });

  it('leaves unrelated collection requests unchanged', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ docs: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    await new APIClient({ baseURL: 'https://admin.example' }).find({
      collection: 'posts',
      page: 2,
    });
    expect(fetch.mock.calls[0]?.[0]).toBe(
      'https://admin.example/api/collections/posts?page=2&limit=10',
    );
  });

  it('rejects scope fields that would overwrite pagination before making a request', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(
      new APIClient().find({ collection: 'pages', scope: { field: 'limit', value: '1' } }),
    ).rejects.toMatchObject({ type: APIErrorType.Validation });
    expect(fetch).not.toHaveBeenCalled();
  });
});
