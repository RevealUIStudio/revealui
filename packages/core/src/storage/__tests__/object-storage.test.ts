import { describe, expect, it, vi } from 'vitest';
import type { StorageProvider } from '../types.js';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
const mockPut = vi.fn();
const mockDel = vi.fn();
const mockList = vi.fn();

vi.mock('../../observability/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { objectStorage } from '../object-storage.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createMockProvider(tag = 'mock'): StorageProvider {
  return {
    provider: tag,
    put: (...args: unknown[]) => mockPut(...args),
    del: (...args: unknown[]) => mockDel(...args),
    list: (...args: unknown[]) => mockList(...args),
    createPresignedPutUrl: vi.fn(),
    headObject: vi.fn(),
    getObjectRange: vi.fn(),
  } as unknown as StorageProvider;
}

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
describe('objectStorage', () => {
  describe('plugin configuration', () => {
    it('adds upload config to targeted collections', () => {
      const plugin = objectStorage({
        collections: { media: true },
        resolveProvider: () => createMockProvider(),
      });
      const config = createBaseConfig([createCollection('media')]);

      const result = plugin(config);

      const media = result.collections.find((c: { slug: string }) => c.slug === 'media');
      expect(media.upload).toBeDefined();
    });

    it('does not modify untargeted collections', () => {
      const plugin = objectStorage({
        collections: { media: true },
        resolveProvider: () => createMockProvider(),
      });
      const config = createBaseConfig([createCollection('posts')]);

      const result = plugin(config);

      const posts = result.collections.find((c: { slug: string }) => c.slug === 'posts');
      expect(posts.upload).toBeUndefined();
    });

    it('returns config unchanged when enabled is false', () => {
      const plugin = objectStorage({
        enabled: false,
        collections: { media: true },
        resolveProvider: () => createMockProvider(),
      });
      const config = createBaseConfig([createCollection('media')]);

      const result = plugin(config);

      const media = result.collections.find((c: { slug: string }) => c.slug === 'media');
      expect(media.upload).toBeUndefined();
    });

    it('skips disabled collections', () => {
      const plugin = objectStorage({
        collections: { media: false },
        resolveProvider: () => createMockProvider(),
      });
      const config = createBaseConfig([createCollection('media')]);

      const result = plugin(config);

      const media = result.collections.find((c: { slug: string }) => c.slug === 'media');
      expect(media.upload).toBeUndefined();
    });

    it('sets correct MIME types', () => {
      const plugin = objectStorage({
        collections: { media: true },
        resolveProvider: () => createMockProvider(),
      });
      const config = createBaseConfig([createCollection('media')]);

      const result = plugin(config);

      const media = result.collections.find((c: { slug: string }) => c.slug === 'media');
      expect(media.upload.mimeTypes).toEqual(['image/*', 'video/*', 'audio/*', 'application/pdf']);
    });

    it('uses custom prefix', () => {
      const plugin = objectStorage({
        collections: { media: true },
        resolveProvider: () => createMockProvider(),
        prefix: 'assets',
      });
      const config = createBaseConfig([createCollection('media')]);

      const result = plugin(config);

      const media = result.collections.find((c: { slug: string }) => c.slug === 'media');
      const adapter = media.upload.adapters[0].adapter;
      expect(adapter.generateURL({ filename: 'test.jpg' })).toBe('assets/test.jpg');
    });

    it('uses default prefix', () => {
      const plugin = objectStorage({
        collections: { media: true },
        resolveProvider: () => createMockProvider(),
      });
      const config = createBaseConfig([createCollection('media')]);

      const result = plugin(config);

      const media = result.collections.find((c: { slug: string }) => c.slug === 'media');
      const adapter = media.upload.adapters[0].adapter;
      expect(adapter.generateURL({ filename: 'test.jpg' })).toBe('uploads/test.jpg');
    });
  });

  describe('lazy provider resolution', () => {
    it('does not resolve the provider at config-build time', () => {
      const resolveProvider = vi.fn(() => createMockProvider());
      const plugin = objectStorage({ collections: { media: true }, resolveProvider });
      const config = createBaseConfig([createCollection('media')]);

      plugin(config);

      expect(resolveProvider).not.toHaveBeenCalled();
    });

    it('resolves the provider once (memoized) across multiple operations', async () => {
      mockPut.mockResolvedValue({
        key: 'k',
        url: 'https://cdn.example/k',
        size: 1,
        provider: 'mock',
      });
      mockDel.mockResolvedValue(undefined);
      const resolveProvider = vi.fn(() => createMockProvider());
      const plugin = objectStorage({ collections: { media: true }, resolveProvider });
      const config = createBaseConfig([createCollection('media')]);
      plugin(config);

      const media = config.collections.find((c: { slug: string }) => c.slug === 'media');
      const adapter = media.upload.adapters[0].adapter;

      await adapter.upload({
        name: 'a.jpg',
        data: Buffer.from('a'),
        size: 1,
        mimetype: 'image/jpeg',
      });
      await adapter.delete('https://cdn.example/k');

      expect(resolveProvider).toHaveBeenCalledTimes(1);
    });
  });

  describe('upload adapter', () => {
    it('uploads via the provider with a prefixed key and maps the result', async () => {
      mockPut.mockResolvedValue({
        key: 'uploads/media/123-test.jpg',
        url: 'https://cdn.example/uploads/media/123-test.jpg',
        size: 1024,
        provider: 'r2',
      });

      const plugin = objectStorage({
        collections: { media: true },
        resolveProvider: () => createMockProvider('r2'),
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

      expect(result.url).toBe('https://cdn.example/uploads/media/123-test.jpg');
      expect(result.filename).toBe('test.jpg');
      expect(result.filesize).toBe(1024);
      expect(result.mimeType).toBe('image/jpeg');
      expect(result.width).toBe(800);
      expect(result.height).toBe(600);

      expect(mockPut).toHaveBeenCalledWith(
        expect.stringContaining('uploads/media/'),
        expect.any(Buffer),
        { access: 'public', contentType: 'image/jpeg' },
      );
    });

    it('rethrows upload errors', async () => {
      mockPut.mockRejectedValue(new Error('Network error'));

      const plugin = objectStorage({
        collections: { media: true },
        resolveProvider: () => createMockProvider(),
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

    it('propagates a resolveProvider throw (no backend configured)', async () => {
      const plugin = objectStorage({
        collections: { media: true },
        resolveProvider: () => {
          throw new Error('No object-storage backend configured');
        },
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
      ).rejects.toThrow('No object-storage backend configured');
    });
  });

  describe('delete adapter', () => {
    it('deletes by URL (passed through to the provider)', async () => {
      mockDel.mockResolvedValue(undefined);

      const plugin = objectStorage({
        collections: { media: true },
        resolveProvider: () => createMockProvider(),
      });
      const config = createBaseConfig([createCollection('media')]);
      plugin(config);

      const media = config.collections.find((c: { slug: string }) => c.slug === 'media');
      const adapter = media.upload.adapters[0].adapter;

      await adapter.delete('https://cdn.example/uploads/media/test.jpg');

      expect(mockDel).toHaveBeenCalledWith('https://cdn.example/uploads/media/test.jpg');
    });

    it('prefixes non-URL filenames before delete', async () => {
      mockDel.mockResolvedValue(undefined);

      const plugin = objectStorage({
        collections: { media: true },
        resolveProvider: () => createMockProvider(),
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

      const plugin = objectStorage({
        collections: { media: true },
        resolveProvider: () => createMockProvider(),
      });
      const config = createBaseConfig([createCollection('media')]);
      plugin(config);

      const media = config.collections.find((c: { slug: string }) => c.slug === 'media');
      const adapter = media.upload.adapters[0].adapter;

      await expect(adapter.delete('test.jpg')).rejects.toThrow('Not found');
    });
  });

  describe('generateFileURL', () => {
    it('generates a file URL that includes the collection slug', () => {
      const plugin = objectStorage({
        collections: { media: true },
        resolveProvider: () => createMockProvider(),
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
