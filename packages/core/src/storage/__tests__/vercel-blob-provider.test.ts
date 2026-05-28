import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @vercel/blob — capture put/del calls, return canned list responses.
// ---------------------------------------------------------------------------
const putCalls: Array<{ pathname: string; body: unknown; options: Record<string, unknown> }> = [];
const delCalls: Array<{ url: string; options: Record<string, unknown> }> = [];
const listCalls: Array<Record<string, unknown>> = [];
const listResponses: unknown[] = [];

vi.mock('@vercel/blob', () => ({
  put: vi.fn(async (pathname: string, body: unknown, options: Record<string, unknown>) => {
    putCalls.push({ pathname, body, options });
    return { url: `https://store.public.blob.vercel-storage.com/${pathname}`, pathname };
  }),
  del: vi.fn(async (url: string, options: Record<string, unknown>) => {
    delCalls.push({ url, options });
  }),
  list: vi.fn(async (options: Record<string, unknown>) => {
    listCalls.push(options);
    return listResponses.shift() ?? { blobs: [], cursor: undefined, hasMore: false };
  }),
}));

import { createVercelBlobProvider } from '../vercel-blob-provider.js';

describe('createVercelBlobProvider', () => {
  beforeEach(() => {
    putCalls.length = 0;
    delCalls.length = 0;
    listCalls.length = 0;
    listResponses.length = 0;
  });

  describe('construction', () => {
    it('throws when token is empty', () => {
      expect(() => createVercelBlobProvider({ token: '' })).toThrow(
        /requires VercelBlobConfig.token/,
      );
    });

    it('exposes provider="vercel-blob"', () => {
      expect(createVercelBlobProvider({ token: 'tok' }).provider).toBe('vercel-blob');
    });
  });

  describe('put', () => {
    it('calls @vercel/blob put with public access, explicit token, and no random suffix', async () => {
      const provider = createVercelBlobProvider({ token: 'vercel_blob_rw_test' });
      const result = await provider.put('media/a.png', new Uint8Array([1, 2, 3]), {
        contentType: 'image/png',
      });

      expect(putCalls).toHaveLength(1);
      expect(putCalls[0].pathname).toBe('media/a.png');
      expect(putCalls[0].options).toMatchObject({
        access: 'public',
        token: 'vercel_blob_rw_test',
        contentType: 'image/png',
        addRandomSuffix: false,
      });
      expect(result).toEqual({
        key: 'media/a.png',
        url: 'https://store.public.blob.vercel-storage.com/media/a.png',
        size: 3,
        provider: 'vercel-blob',
      });
    });

    it("throws when access:'private' is requested", async () => {
      const provider = createVercelBlobProvider({ token: 'tok' });
      await expect(provider.put('p', new Uint8Array([1]), { access: 'private' })).rejects.toThrow(
        /does not support access: 'private'/,
      );
      expect(putCalls).toHaveLength(0);
    });

    it('reports size from the normalized body for Blob input', async () => {
      const provider = createVercelBlobProvider({ token: 'tok' });
      const result = await provider.put('b', new Blob(['hello']));
      expect(result.size).toBe(5);
    });
  });

  describe('del', () => {
    it('forwards the URL and token to @vercel/blob del', async () => {
      const provider = createVercelBlobProvider({ token: 'tok' });
      await provider.del('https://store.public.blob.vercel-storage.com/media/a.png');
      expect(delCalls).toEqual([
        {
          url: 'https://store.public.blob.vercel-storage.com/media/a.png',
          options: { token: 'tok' },
        },
      ]);
    });
  });

  describe('list', () => {
    it('maps blob entries to ListItem and passes prefix/limit/cursor', async () => {
      listResponses.push({
        blobs: [
          {
            pathname: 'media/a.png',
            url: 'https://store.public.blob.vercel-storage.com/media/a.png',
            size: 10,
            uploadedAt: new Date('2026-05-18T10:00:00Z'),
          },
        ],
        cursor: 'next',
        hasMore: true,
      });
      const provider = createVercelBlobProvider({ token: 'tok' });
      const result = await provider.list({ prefix: 'media/', limit: 50, cursor: 'start' });

      expect(listCalls[0]).toMatchObject({
        prefix: 'media/',
        limit: 50,
        cursor: 'start',
        token: 'tok',
      });
      expect(result).toEqual({
        items: [
          {
            key: 'media/a.png',
            url: 'https://store.public.blob.vercel-storage.com/media/a.png',
            size: 10,
            uploadedAt: new Date('2026-05-18T10:00:00Z'),
          },
        ],
        cursor: 'next',
        hasMore: true,
      });
    });

    it('defaults limit to 1000 when not provided', async () => {
      listResponses.push({ blobs: [], cursor: undefined, hasMore: false });
      const provider = createVercelBlobProvider({ token: 'tok' });
      await provider.list();
      expect(listCalls[0]).toMatchObject({ limit: 1000 });
    });
  });
});
