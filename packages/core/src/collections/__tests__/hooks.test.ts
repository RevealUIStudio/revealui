import { describe, expect, it, vi } from 'vitest';
import type { RevealCollectionConfig, RevealDocument, RevealRequest } from '../../types/index.js';
import { callAfterChangeHooks } from '../hooks.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createConfig(
  slug: string,
  // biome-ignore lint/suspicious/noExplicitAny: test helper  -  hook signature varies
  hooks?: { afterChange?: any[] },
): RevealCollectionConfig {
  // biome-ignore lint/suspicious/noExplicitAny: test helper
  return { slug, fields: [], hooks } as any;
}

const mockReq = {} as RevealRequest;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('callAfterChangeHooks', () => {
  it('returns the document unchanged when no hooks defined', async () => {
    const config = createConfig('posts');
    const doc = { id: '1', title: 'Hello' } as unknown as RevealDocument;

    const result = await callAfterChangeHooks(config, doc, mockReq, 'create');

    expect(result).toBe(doc);
  });

  it('returns the document unchanged when hooks is undefined', async () => {
    const config = createConfig('posts', undefined);
    const doc = { id: '1' } as unknown as RevealDocument;

    const result = await callAfterChangeHooks(config, doc, mockReq, 'update');

    expect(result).toBe(doc);
  });

  it('calls a single afterChange hook', async () => {
    const hook = vi.fn().mockResolvedValue({ id: '1', title: 'Modified' });
    const config = createConfig('posts', { afterChange: [hook] });
    const doc = { id: '1', title: 'Original' } as unknown as RevealDocument;

    const result = await callAfterChangeHooks(config, doc, mockReq, 'create');

    expect(result).toEqual({ id: '1', title: 'Modified' });
    expect(hook).toHaveBeenCalledOnce();
  });

  it('passes correct arguments to hook', async () => {
    const hook = vi.fn().mockReturnValue(undefined);
    const config = createConfig('posts', { afterChange: [hook] });
    const doc = { id: '1' } as unknown as RevealDocument;
    const previousDoc = { id: '1', title: 'Old' } as unknown as RevealDocument;

    await callAfterChangeHooks(config, doc, mockReq, 'update', previousDoc);

    const args = hook.mock.calls[0]![0];
    expect(args.doc).toBe(doc);
    expect(args.req).toBe(mockReq);
    expect(args.operation).toBe('update');
    expect(args.previousDoc).toBe(previousDoc);
    expect(args.collection).toBe('posts');
    expect(args.context.collection).toBe('posts');
    expect(args.context.operation).toBe('update');
  });

  it('chains multiple hooks sequentially', async () => {
    const hook1 = vi.fn().mockResolvedValue({ id: '1', step: 1 });
    const hook2 = vi.fn().mockResolvedValue({ id: '1', step: 2 });
    const config = createConfig('posts', { afterChange: [hook1, hook2] });
    const doc = { id: '1', step: 0 } as unknown as RevealDocument;

    const result = await callAfterChangeHooks(config, doc, mockReq, 'create');

    expect(result).toEqual({ id: '1', step: 2 });
    // hook2 receives the output of hook1
    expect(hook2.mock.calls[0]![0].doc).toEqual({ id: '1', step: 1 });
  });

  it('preserves original doc when hook returns undefined', async () => {
    const hook = vi.fn().mockReturnValue(undefined);
    const config = createConfig('posts', { afterChange: [hook] });
    const doc = { id: '1', title: 'Unchanged' } as unknown as RevealDocument;

    const result = await callAfterChangeHooks(config, doc, mockReq, 'create');

    expect(result).toEqual({ id: '1', title: 'Unchanged' });
  });

  it('passes revealui instance in context', async () => {
    const hook = vi.fn().mockReturnValue(undefined);
    const config = createConfig('posts', { afterChange: [hook] });
    const doc = { id: '1' } as unknown as RevealDocument;
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const mockInstance = { config: {} } as any;

    await callAfterChangeHooks(config, doc, mockReq, 'create', undefined, mockInstance);

    expect(hook.mock.calls[0]![0].context.revealui).toBe(mockInstance);
  });

  it('handles async hooks', async () => {
    const hook = vi.fn().mockImplementation(async ({ doc }: { doc: RevealDocument }) => {
      await new Promise((r) => setTimeout(r, 1));
      return { ...doc, processed: true };
    });
    const config = createConfig('posts', { afterChange: [hook] });
    const doc = { id: '1' } as unknown as RevealDocument;

    const result = await callAfterChangeHooks(config, doc, mockReq, 'create');

    expect(result).toHaveProperty('processed', true);
  });
});
