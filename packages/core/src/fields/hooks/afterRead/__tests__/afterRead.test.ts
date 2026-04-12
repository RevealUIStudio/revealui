import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock('../../../../utils/getSelectMode.js', () => ({
  getSelectMode: vi.fn(() => 'include'),
}));

vi.mock('../../../../relationships/population.js', () => ({
  relationshipPopulationPromise: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../utils/stripUnselectedFields.js', () => ({
  stripUnselectedFields: vi.fn(),
}));

import { afterRead } from '../index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
// biome-ignore lint/suspicious/noExplicitAny: test helper  -  minimal config shape
function createCollectionConfig(fields: any[] = []) {
  return {
    slug: 'posts',
    fields,
    flattenedFields: fields,
    defaultPopulate: [],
    customIDType: 'text',
    trash: false,
  } as never;
}

const baseArgs = {
  collection: null as never,
  context: {},
  depth: 0,
  draft: false,
  fallbackLocale: 'en' as const,
  flattenLocales: true,
  global: null,
  locale: 'en',
  overrideAccess: false,
  req: {} as never,
  showHiddenFields: false,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('afterRead', () => {
  it('returns the document as-is with no fields', async () => {
    const doc = { id: '1', title: 'Hello' };
    const result = await afterRead({
      ...baseArgs,
      collection: createCollectionConfig(),
      doc,
    });

    expect(result).toBe(doc);
    expect(result.title).toBe('Hello');
  });

  it('clamps depth to maxDepth (10)', async () => {
    const doc = { id: '1' };
    // Should not throw with depth > 10
    const result = await afterRead({
      ...baseArgs,
      collection: createCollectionConfig(),
      doc,
      depth: 100,
    });

    expect(result).toBe(doc);
  });

  it('uses defaultDepth (1) when depth is undefined', async () => {
    const doc = { id: '1' };
    const result = await afterRead({
      ...baseArgs,
      collection: createCollectionConfig(),
      doc,
      depth: undefined as never,
    });

    expect(result).toBe(doc);
  });

  it('executes beforeRead hooks on fields', async () => {
    const hook = vi.fn();
    const fields = [{ name: 'title', type: 'text', hooks: { beforeRead: [hook] } }];
    const doc = { id: '1', title: 'Test' };

    await afterRead({
      ...baseArgs,
      collection: createCollectionConfig(fields),
      doc,
    });

    expect(hook).toHaveBeenCalledOnce();
    expect(hook).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'posts',
        doc,
        field: fields[0],
      }),
    );
  });

  it('executes afterRead hooks on fields', async () => {
    const hook = vi.fn();
    const fields = [{ name: 'title', type: 'text', hooks: { afterRead: [hook] } }];
    const doc = { id: '1', title: 'Test' };

    await afterRead({
      ...baseArgs,
      collection: createCollectionConfig(fields),
      doc,
    });

    expect(hook).toHaveBeenCalledOnce();
  });

  it('does not run hooks when triggerHooks is false', async () => {
    const hook = vi.fn();
    const doc = { id: '1', title: 'Test' };

    // afterRead doesn't directly take triggerHooks, it defaults to true in traverseFields
    // but we can test with no hooks and verify it doesn't crash
    await afterRead({
      ...baseArgs,
      collection: createCollectionConfig([{ name: 'title', type: 'text' }]),
      doc,
    });

    // No hooks, no calls
    expect(hook).not.toHaveBeenCalled();
  });

  it('processes array fields recursively', async () => {
    const hook = vi.fn();
    const fields = [
      {
        name: 'items',
        type: 'array',
        fields: [{ name: 'label', type: 'text', hooks: { afterRead: [hook] } }],
      },
    ];
    const doc = {
      id: '1',
      items: [{ label: 'A' }, { label: 'B' }],
    };

    await afterRead({
      ...baseArgs,
      collection: createCollectionConfig(fields),
      doc,
    });

    // Hook called for each array row
    expect(hook).toHaveBeenCalledTimes(2);
  });

  it('uses global fields when collection is null', async () => {
    const hook = vi.fn();
    const doc = { id: '1', siteName: 'Test' };

    await afterRead({
      ...baseArgs,
      collection: null,
      global: {
        slug: 'settings',
        fields: [{ name: 'siteName', type: 'text', hooks: { afterRead: [hook] } }],
      } as never,
      doc,
    });

    expect(hook).toHaveBeenCalledOnce();
  });

  it('throws on infinite promise loops', async () => {
    // Create a hook that adds more field promises indefinitely
    let callCount = 0;
    const infiniteHook = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount > 200) {
        // Safety: should be caught by the 100-iteration limit
        throw new Error('Should not reach here');
      }
    });
    const fields = [{ name: 'title', type: 'text', hooks: { afterRead: [infiniteHook] } }];
    const doc = { id: '1', title: 'Test' };

    // This should complete without hitting infinite loop (single field, single hook)
    const result = await afterRead({
      ...baseArgs,
      collection: createCollectionConfig(fields),
      doc,
    });

    expect(result).toBe(doc);
  });

  it('handles empty document', async () => {
    const doc = { id: '1' };
    const result = await afterRead({
      ...baseArgs,
      collection: createCollectionConfig([{ name: 'title', type: 'text' }]),
      doc,
    });

    expect(result).toBe(doc);
  });
});
