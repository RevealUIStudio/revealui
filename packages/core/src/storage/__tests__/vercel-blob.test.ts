import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
const mockPut = vi.fn();
const mockDel = vi.fn();

vi.mock('@vercel/blob', () => ({
  put: (...args: unknown[]) => mockPut(...args),
  del: (...args: unknown[]) => mockDel(...args),
}));

vi.mock('../../instance/logger.js', () => ({
  defaultLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { vercelBlobStorage } from '../vercel-blob.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
// biome-ignore lint/suspicious/noExplicitAny: test helper  -  minimal config shape
function createBaseConfig(collections: any[] = []) {
  // biome-ignore lint/suspicious/noExplicitAny: test helper
  return { collections } as any;
}

function createCollection(slug: string) {
  return { slug, fields: [], upload: undefined };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('vercelBlobStorage', () => {
  describe('plugin configuration', () => {
    it('adds upload config to targeted collections', () => {
      const plugin = vercelBlobStorage({
        collections: { media: true },
        token: 'test-token',
      });
      const config = createBaseConfig([createCollection('media')]);

      const result = plugin(config);

      const media = result.collections.find((c: { slug: string }) => c.slug === 'media');
      expect(media.upload).toBeDefined();
    });

    it('does not modify untargeted collections', () => {
      const plugin = vercelBlobStorage({
        collections: { media: true },
        token: 'test-token',
      });
      const config = createBaseConfig([createCollection('posts')]);

      const result = plugin(config);

      const posts = result.collections.find((c: { slug: string }) => c.slug === 'posts');
      expect(posts.upload).toBeUndefined();
    });

    it('returns config unchanged when enabled is false', () => {
      const plugin = vercelBlobStorage({
        enabled: false,
        collections: { media: true },
        token: 'test-token',
      });
      const config = createBaseConfig([createCollection('media')]);

      const result = plugin(config);

      const media = result.collections.find((c: { slug: string }) => c.slug === 'media');
      expect(media.upload).toBeUndefined();
    });

    it('skips disabled collections', () => {
      const plugin = vercelBlobStorage({
        collections: { media: false },
        token: 'test-token',
      });
      const config = createBaseConfig([createCollection('media')]);

      const result = plugin(config);

      const media = result.collections.find((c: { slug: string }) => c.slug === 'media');
      expect(media.upload).toBeUndefined();
    });

    it('sets correct MIME types', () => {
      const plugin = vercelBlobStorage({
        collections: { media: true },
        token: 'test-token',
      });
      const config = createBaseConfig([createCollection('media')]);

      const result = plugin(config);

      const media = result.collections.find((c: { slug: string }) => c.slug === 'media');
      expect(media.upload.mimeTypes).toEqual(['image/*', 'video/*', 'audio/*', 'application/pdf']);
    });

    it('uses custom prefix', () => {
      const plugin = vercelBlobStorage({
        collections: { media: true },
        token: 'test-token',
        prefix: 'assets',
      });
      const config = createBaseConfig([createCollection('media')]);

      const result = plugin(config);

      const media = result.collections.find((c: { slug: string }) => c.slug === 'media');
      const adapter = media.upload.adapters[0].adapter;
      expect(adapter.generateURL({ filename: 'test.jpg' })).toBe('assets/test.jpg');
    });

    it('uses default prefix', () => {
      const plugin = vercelBlobStorage({
        collections: { media: true },
        token: 'test-token',
      });
      const config = createBaseConfig([createCollection('media')]);

      const result = plugin(config);

      const media = result.collections.find((c: { slug: string }) => c.slug === 'media');
      const adapter = media.upload.adapters[0].adapter;
      expect(adapter.generateURL({ filename: 'test.jpg' })).toBe('uploads/test.jpg');
    });
  });

  describe('upload adapter', () => {
    it('uploads file with correct parameters', async () => {
      mockPut.mockResolvedValue({ url: 'https://blob.vercel.dev/test.jpg' });

      const plugin = vercelBlobStorage({
        collections: { media: true },
        token: 'my-token',
      });
      const config = createBaseConfig([createCollection('media')]);
      plugin(config);

      const media = config.collections.find((c: { slug: string }) => c.slug === 'media');
      const adapter = media.upload.adapters[0].adapter;

      const result = await adapter.upload({
        name: 'test.jpg',
        data: Buffer.from('fake-image'),
        size: 1024,
        mimetype: 'image/jpeg',
        width: 800,
        height: 600,
      });

      expect(result.url).toBe('https://blob.vercel.dev/test.jpg');
      expect(result.filename).toBe('test.jpg');
      expect(result.filesize).toBe(1024);
      expect(result.mimeType).toBe('image/jpeg');
      expect(result.width).toBe(800);
      expect(result.height).toBe(600);

      expect(mockPut).toHaveBeenCalledWith(
        expect.stringContaining('uploads/media/'),
        expect.any(Buffer),
        { access: 'public', token: 'my-token', addRandomSuffix: false },
      );
    });

    it('throws when token is not configured', async () => {
      const plugin = vercelBlobStorage({
        collections: { media: true },
      });
      const config = createBaseConfig([createCollection('media')]);
      plugin(config);

      const media = config.collections.find((c: { slug: string }) => c.slug === 'media');
      const adapter = media.upload.adapters[0].adapter;

      await expect(
        adapter.upload({
          name: 'test.jpg',
          data: Buffer.from('data'),
          size: 100,
          mimetype: 'image/jpeg',
        }),
      ).rejects.toThrow('Vercel blob token is required');
    });

    it('rethrows upload errors', async () => {
      mockPut.mockRejectedValue(new Error('Network error'));

      const plugin = vercelBlobStorage({
        collections: { media: true },
        token: 'token',
      });
      const config = createBaseConfig([createCollection('media')]);
      plugin(config);

      const media = config.collections.find((c: { slug: string }) => c.slug === 'media');
      const adapter = media.upload.adapters[0].adapter;

      await expect(
        adapter.upload({
          name: 'test.jpg',
          data: Buffer.from('data'),
          size: 100,
          mimetype: 'image/jpeg',
        }),
      ).rejects.toThrow('Network error');
    });
  });

  describe('delete adapter', () => {
    it('deletes file by URL', async () => {
      mockDel.mockResolvedValue(undefined);

      const plugin = vercelBlobStorage({
        collections: { media: true },
        token: 'token',
      });
      const config = createBaseConfig([createCollection('media')]);
      plugin(config);

      const media = config.collections.find((c: { slug: string }) => c.slug === 'media');
      const adapter = media.upload.adapters[0].adapter;

      await adapter.delete('https://blob.vercel.dev/test.jpg');

      expect(mockDel).toHaveBeenCalledWith('https://blob.vercel.dev/test.jpg');
    });

    it('constructs path for non-URL filenames', async () => {
      mockDel.mockResolvedValue(undefined);

      const plugin = vercelBlobStorage({
        collections: { media: true },
        token: 'token',
      });
      const config = createBaseConfig([createCollection('media')]);
      plugin(config);

      const media = config.collections.find((c: { slug: string }) => c.slug === 'media');
      const adapter = media.upload.adapters[0].adapter;

      await adapter.delete('test.jpg');

      expect(mockDel).toHaveBeenCalledWith('uploads/test.jpg');
    });

    it('rethrows delete errors', async () => {
      mockDel.mockRejectedValue(new Error('Not found'));

      const plugin = vercelBlobStorage({
        collections: { media: true },
        token: 'token',
      });
      const config = createBaseConfig([createCollection('media')]);
      plugin(config);

      const media = config.collections.find((c: { slug: string }) => c.slug === 'media');
      const adapter = media.upload.adapters[0].adapter;

      await expect(adapter.delete('test.jpg')).rejects.toThrow('Not found');
    });
  });

  describe('generateFileURL', () => {
    it('generates correct file URL with collection slug', () => {
      const plugin = vercelBlobStorage({
        collections: { media: true },
        token: 'token',
        prefix: 'files',
      });
      const config = createBaseConfig([createCollection('media')]);
      plugin(config);

      const media = config.collections.find((c: { slug: string }) => c.slug === 'media');
      const adapter = media.upload.adapters[0].adapter;

      expect(adapter.generateFileURL({ filename: 'photo.png' })).toBe('files/media/photo.png');
    });
  });
});
