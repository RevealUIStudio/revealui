import { describe, expect, it, vi } from 'vitest';
import { nestedDocsPlugin } from '../nested-docs.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
// biome-ignore lint/suspicious/noExplicitAny: test helper  -  minimal config shape
function createBaseConfig(collections: any[] = []) {
  // biome-ignore lint/suspicious/noExplicitAny: test helper
  return { collections } as any;
}

function createCollection(slug: string, fields: unknown[] = []) {
  return { slug, fields, hooks: {} };
}

function createMockDb(rows: Record<string, unknown>[] = []) {
  return {
    execute: vi.fn().mockResolvedValue({ rows }),
  };
}

// ---------------------------------------------------------------------------
// Tests  -  plugin configuration
// ---------------------------------------------------------------------------
describe('nestedDocsPlugin', () => {
  describe('plugin configuration', () => {
    it('adds parent and breadcrumbs fields to targeted collections', () => {
      const plugin = nestedDocsPlugin({ collections: ['pages'] });
      const config = createBaseConfig([createCollection('pages')]);

      const result = plugin(config);

      const pages = result.collections.find((c: { slug: string }) => c.slug === 'pages');
      const fieldNames = pages.fields.map((f: { name?: string }) => f.name);
      expect(fieldNames).toContain('parent');
      expect(fieldNames).toContain('breadcrumbs');
    });

    it('does not modify collections not in the target list', () => {
      const plugin = nestedDocsPlugin({ collections: ['pages'] });
      const posts = createCollection('posts', [{ name: 'title', type: 'text' }]);
      const config = createBaseConfig([posts]);

      const result = plugin(config);

      const resultPosts = result.collections.find((c: { slug: string }) => c.slug === 'posts');
      expect(resultPosts.fields).toHaveLength(1);
    });

    it('uses custom parent field slug', () => {
      const plugin = nestedDocsPlugin({
        collections: ['pages'],
        parentFieldSlug: 'parentPage',
      });
      const config = createBaseConfig([createCollection('pages')]);

      const result = plugin(config);

      const pages = result.collections.find((c: { slug: string }) => c.slug === 'pages');
      const fieldNames = pages.fields.map((f: { name?: string }) => f.name);
      expect(fieldNames).toContain('parentPage');
    });

    it('uses custom breadcrumbs field slug', () => {
      const plugin = nestedDocsPlugin({
        collections: ['pages'],
        breadcrumbsFieldSlug: 'trail',
      });
      const config = createBaseConfig([createCollection('pages')]);

      const result = plugin(config);

      const pages = result.collections.find((c: { slug: string }) => c.slug === 'pages');
      const fieldNames = pages.fields.map((f: { name?: string }) => f.name);
      expect(fieldNames).toContain('trail');
    });

    it('parent field is a self-referencing relationship', () => {
      const plugin = nestedDocsPlugin({ collections: ['pages'] });
      const config = createBaseConfig([createCollection('pages')]);

      const result = plugin(config);

      const pages = result.collections.find((c: { slug: string }) => c.slug === 'pages');
      const parentField = pages.fields.find((f: { name?: string }) => f.name === 'parent');
      expect(parentField.relationTo).toBe('pages');
      expect(parentField.type).toBe('relationship');
    });

    it('breadcrumbs field is an array with doc, url, label subfields', () => {
      const plugin = nestedDocsPlugin({ collections: ['pages'] });
      const config = createBaseConfig([createCollection('pages')]);

      const result = plugin(config);

      const pages = result.collections.find((c: { slug: string }) => c.slug === 'pages');
      const breadcrumbs = pages.fields.find((f: { name?: string }) => f.name === 'breadcrumbs');
      expect(breadcrumbs.type).toBe('array');
      const subFieldNames = breadcrumbs.fields.map((f: { name: string }) => f.name);
      expect(subFieldNames).toEqual(['doc', 'url', 'label']);
    });

    it('adds a beforeChange hook to targeted collections', () => {
      const plugin = nestedDocsPlugin({ collections: ['pages'] });
      const config = createBaseConfig([createCollection('pages')]);

      const result = plugin(config);

      const pages = result.collections.find((c: { slug: string }) => c.slug === 'pages');
      expect(pages.hooks.beforeChange).toHaveLength(1);
    });

    it('preserves existing beforeChange hooks', () => {
      const existingHook = vi.fn();
      const plugin = nestedDocsPlugin({ collections: ['pages'] });
      const pages = createCollection('pages');
      pages.hooks = { beforeChange: [existingHook] };
      const config = createBaseConfig([pages]);

      const result = plugin(config);

      const resultPages = result.collections.find((c: { slug: string }) => c.slug === 'pages');
      expect(resultPages.hooks.beforeChange).toHaveLength(2);
    });

    it('handles empty collections config', () => {
      const plugin = nestedDocsPlugin({ collections: ['pages'] });
      // biome-ignore lint/suspicious/noExplicitAny: test helper
      const config = { collections: undefined } as any;

      const result = plugin(config);

      expect(result.collections).toBeUndefined();
    });

    it('defaults to empty collections array', () => {
      const plugin = nestedDocsPlugin();
      const config = createBaseConfig([createCollection('pages')]);

      const result = plugin(config);

      // No collections targeted → no fields added
      const pages = result.collections.find((c: { slug: string }) => c.slug === 'pages');
      expect(pages.fields).toHaveLength(0);
    });
  });

  describe('beforeChange hook  -  breadcrumb building', () => {
    it('sets empty breadcrumbs when no parent', async () => {
      const plugin = nestedDocsPlugin({
        collections: ['pages'],
        getDb: () => createMockDb(),
      });
      const config = createBaseConfig([createCollection('pages')]);
      plugin(config);

      const pages = config.collections.find((c: { slug: string }) => c.slug === 'pages');
      const hook = pages.hooks.beforeChange[0];

      const data: Record<string, unknown> = { title: 'Test' };
      const result = await hook({ data });

      expect(result.breadcrumbs).toEqual([]);
    });

    it('builds breadcrumbs from parent chain', async () => {
      const mockDb = createMockDb();
      mockDb.execute.mockResolvedValueOnce({
        rows: [{ id: 'parent-1', title: 'Parent', parent: null }],
      });

      const plugin = nestedDocsPlugin({
        collections: ['pages'],
        getDb: () => mockDb,
      });
      const config = createBaseConfig([createCollection('pages')]);
      plugin(config);

      const pages = config.collections.find((c: { slug: string }) => c.slug === 'pages');
      const hook = pages.hooks.beforeChange[0];

      const data: Record<string, unknown> = { title: 'Child', parent: 'parent-1' };
      const result = await hook({ data });

      expect(result.breadcrumbs).toEqual([
        { doc: 'parent-1', url: '/pages/parent-1', label: 'Parent' },
      ]);
    });

    it('walks multiple levels of parent chain', async () => {
      const mockDb = createMockDb();
      mockDb.execute
        .mockResolvedValueOnce({
          rows: [{ id: 'mid', title: 'Middle', parent: 'root' }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 'root', title: 'Root', parent: null }],
        });

      const plugin = nestedDocsPlugin({
        collections: ['pages'],
        getDb: () => mockDb,
      });
      const config = createBaseConfig([createCollection('pages')]);
      plugin(config);

      const pages = config.collections.find((c: { slug: string }) => c.slug === 'pages');
      const hook = pages.hooks.beforeChange[0];

      const data: Record<string, unknown> = { title: 'Leaf', parent: 'mid' };
      const result = await hook({ data });

      expect(result.breadcrumbs).toHaveLength(2);
      expect(result.breadcrumbs[0].label).toBe('Root');
      expect(result.breadcrumbs[1].label).toBe('Middle');
    });

    it('sets empty breadcrumbs when no getDb provided', async () => {
      const plugin = nestedDocsPlugin({ collections: ['pages'] });
      const config = createBaseConfig([createCollection('pages')]);
      plugin(config);

      const pages = config.collections.find((c: { slug: string }) => c.slug === 'pages');
      const hook = pages.hooks.beforeChange[0];

      const data: Record<string, unknown> = { title: 'Test', parent: 'some-id' };
      const result = await hook({ data });

      expect(result.breadcrumbs).toEqual([]);
    });

    it('uses id as label fallback when label field is missing', async () => {
      const mockDb = createMockDb();
      mockDb.execute.mockResolvedValueOnce({
        rows: [{ id: 'parent-1', parent: null }],
      });

      const plugin = nestedDocsPlugin({
        collections: ['pages'],
        getDb: () => mockDb,
      });
      const config = createBaseConfig([createCollection('pages')]);
      plugin(config);

      const pages = config.collections.find((c: { slug: string }) => c.slug === 'pages');
      const hook = pages.hooks.beforeChange[0];

      const data: Record<string, unknown> = { title: 'Child', parent: 'parent-1' };
      const result = await hook({ data });

      expect(result.breadcrumbs[0].label).toBe('parent-1');
    });

    it('stops at max depth to prevent infinite loops', async () => {
      const mockDb = createMockDb();
      // Create a chain deeper than default maxDepth (10)
      for (let i = 0; i < 15; i++) {
        mockDb.execute.mockResolvedValueOnce({
          rows: [{ id: `id-${i}`, title: `Level ${i}`, parent: i < 14 ? `id-${i + 1}` : null }],
        });
      }

      const plugin = nestedDocsPlugin({
        collections: ['pages'],
        getDb: () => mockDb,
      });
      const config = createBaseConfig([createCollection('pages')]);
      plugin(config);

      const pages = config.collections.find((c: { slug: string }) => c.slug === 'pages');
      const hook = pages.hooks.beforeChange[0];

      const data: Record<string, unknown> = { title: 'Deep', parent: 'id-0' };
      const result = await hook({ data });

      // maxDepth=10 means at most 10 breadcrumbs
      expect(result.breadcrumbs.length).toBeLessThanOrEqual(10);
    });

    it('handles DB errors gracefully', async () => {
      const mockDb = createMockDb();
      mockDb.execute.mockRejectedValueOnce(new Error('DB connection failed'));

      const plugin = nestedDocsPlugin({
        collections: ['pages'],
        getDb: () => mockDb,
      });
      const config = createBaseConfig([createCollection('pages')]);
      plugin(config);

      const pages = config.collections.find((c: { slug: string }) => c.slug === 'pages');
      const hook = pages.hooks.beforeChange[0];

      const data: Record<string, unknown> = { title: 'Test', parent: 'parent-1' };
      const result = await hook({ data });

      // Should return empty breadcrumbs, not throw
      expect(result.breadcrumbs).toEqual([]);
    });
  });

  describe('SQL injection protection', () => {
    it('rejects invalid collection slugs', async () => {
      const mockDb = createMockDb();
      const plugin = nestedDocsPlugin({
        collections: ['pages; DROP TABLE'],
        getDb: () => mockDb,
      });
      const col = createCollection('pages; DROP TABLE');
      const config = createBaseConfig([col]);
      plugin(config);

      const target = config.collections.find(
        (c: { slug: string }) => c.slug === 'pages; DROP TABLE',
      );
      const hook = target.hooks.beforeChange[0];

      const data: Record<string, unknown> = { title: 'Test', parent: 'id-1' };
      const result = await hook({ data });

      // Should silently return empty breadcrumbs (identifier validation fails)
      expect(result.breadcrumbs).toEqual([]);
      expect(mockDb.execute).not.toHaveBeenCalled();
    });

    it('rejects invalid label field names', async () => {
      const mockDb = createMockDb();
      const plugin = nestedDocsPlugin({
        collections: ['pages'],
        labelField: 'title"; DROP TABLE pages--',
        getDb: () => mockDb,
      });
      const config = createBaseConfig([createCollection('pages')]);
      plugin(config);

      const pages = config.collections.find((c: { slug: string }) => c.slug === 'pages');
      const hook = pages.hooks.beforeChange[0];

      const data: Record<string, unknown> = { title: 'Test', parent: 'id-1' };
      const result = await hook({ data });

      expect(result.breadcrumbs).toEqual([]);
      expect(mockDb.execute).not.toHaveBeenCalled();
    });
  });
});
