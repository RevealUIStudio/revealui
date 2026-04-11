import { describe, expect, it } from 'vitest';
import type { RevealUIConfig } from '../../types/index.js';
import { redirectsPlugin } from '../redirects.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createBaseConfig(collections: { slug: string; fields: unknown[] }[] = []): RevealUIConfig {
  // biome-ignore lint/suspicious/noExplicitAny: test helper  -  minimal config shape
  return { collections } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('redirectsPlugin', () => {
  it('adds a redirects collection with default fields', () => {
    const plugin = redirectsPlugin();
    const config = createBaseConfig();

    const result = plugin(config);

    const redirects = result.collections?.find((c) => c.slug === 'redirects');
    expect(redirects).toBeDefined();
    expect(redirects?.fields).toHaveLength(3);

    const fieldNames = redirects?.fields.map((f) => ('name' in f ? f.name : null));
    expect(fieldNames).toContain('from');
    expect(fieldNames).toContain('to');
    expect(fieldNames).toContain('status');
  });

  it('uses default collections for relationship target', () => {
    const plugin = redirectsPlugin();
    const config = createBaseConfig();

    const result = plugin(config);

    const redirects = result.collections?.find((c) => c.slug === 'redirects');
    const toField = redirects?.fields.find((f) => 'name' in f && f.name === 'to');
    expect(toField).toHaveProperty('relationTo', ['pages', 'posts']);
  });

  it('uses custom collections for relationship target', () => {
    const plugin = redirectsPlugin({ collections: ['articles', 'docs'] });
    const config = createBaseConfig();

    const result = plugin(config);

    const redirects = result.collections?.find((c) => c.slug === 'redirects');
    const toField = redirects?.fields.find((f) => 'name' in f && f.name === 'to');
    expect(toField).toHaveProperty('relationTo', ['articles', 'docs']);
  });

  it('preserves existing collections', () => {
    const plugin = redirectsPlugin();
    const config = createBaseConfig([{ slug: 'pages', fields: [] }]);

    const result = plugin(config);

    const slugs = result.collections?.map((c) => c.slug);
    expect(slugs).toContain('pages');
    expect(slugs).toContain('redirects');
  });

  it('applies field overrides', () => {
    const plugin = redirectsPlugin({
      overrides: {
        fields: ({ defaultFields }) => [...defaultFields, { name: 'notes', type: 'text' } as never],
      },
    });
    const config = createBaseConfig();

    const result = plugin(config);

    const redirects = result.collections?.find((c) => c.slug === 'redirects');
    expect(redirects?.fields).toHaveLength(4);
  });

  it('applies afterChange hook overrides', () => {
    const afterChangeHook = async () => ({ id: '1' }) as never;
    const plugin = redirectsPlugin({
      overrides: {
        hooks: {
          afterChange: [afterChangeHook],
        },
      },
    });
    const config = createBaseConfig();

    const result = plugin(config);

    const redirects = result.collections?.find((c) => c.slug === 'redirects');
    expect(redirects?.hooks?.afterChange).toHaveLength(1);
  });

  it('sets admin config', () => {
    const plugin = redirectsPlugin();
    const config = createBaseConfig();

    const result = plugin(config);

    const redirects = result.collections?.find((c) => c.slug === 'redirects');
    expect(redirects?.admin?.useAsTitle).toBe('from');
    expect(redirects?.admin?.defaultColumns).toEqual(['from', 'to', 'status']);
  });

  it('status field defaults to 301', () => {
    const plugin = redirectsPlugin();
    const config = createBaseConfig();

    const result = plugin(config);

    const redirects = result.collections?.find((c) => c.slug === 'redirects');
    const statusField = redirects?.fields.find((f) => 'name' in f && f.name === 'status');
    expect(statusField).toHaveProperty('defaultValue', '301');
  });

  it('handles empty incoming config', () => {
    const plugin = redirectsPlugin();
    // biome-ignore lint/suspicious/noExplicitAny: test helper
    const config = {} as any;

    const result = plugin(config);

    expect(result.collections).toHaveLength(1);
    expect(result.collections?.[0]).toHaveProperty('slug', 'redirects');
  });
});
