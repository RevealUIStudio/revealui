/**
 * Tests for revalidation hooks:
 * - revalidatePage: conditional revalidation on published pages
 * - revalidateRedirects: cache tag invalidation for redirects
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRevalidate = vi.fn();

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

vi.mock('../revalidate', () => ({
  revalidate: (...args: unknown[]) => mockRevalidate(...args),
}));

describe('revalidatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadHook() {
    const mod = await import('../revalidatePage.js');
    return mod.revalidatePage;
  }

  it('revalidates when doc is published with a slug', async () => {
    const hook = await loadHook();
    const doc = { id: '1', _status: 'published', slug: 'hello-world' };
    const req = { revealui: {} };

    const result = hook({ doc, req } as never);

    expect(result).toBe(doc);
    expect(mockRevalidate).toHaveBeenCalledWith({
      revealui: req.revealui,
      collection: 'pages',
      slug: 'hello-world',
    });
  });

  it('skips revalidation when doc is draft', async () => {
    const hook = await loadHook();
    const doc = { id: '1', _status: 'draft', slug: 'hello-world' };
    const req = { revealui: {} };

    const result = hook({ doc, req } as never);

    expect(result).toBe(doc);
    expect(mockRevalidate).not.toHaveBeenCalled();
  });

  it('skips revalidation when doc has no slug', async () => {
    const hook = await loadHook();
    const doc = { id: '1', _status: 'published' };
    const req = { revealui: {} };

    const result = hook({ doc, req } as never);

    expect(result).toBe(doc);
    expect(mockRevalidate).not.toHaveBeenCalled();
  });

  it('skips revalidation when req has no revealui instance', async () => {
    const hook = await loadHook();
    const doc = { id: '1', _status: 'published', slug: 'hello-world' };
    const req = {};

    const result = hook({ doc, req } as never);

    expect(result).toBe(doc);
    expect(mockRevalidate).not.toHaveBeenCalled();
  });

  it('always returns the doc unchanged', async () => {
    const hook = await loadHook();
    const doc = { id: '1', _status: 'draft', slug: 'test', customField: 'value' };
    const req = {};

    const result = hook({ doc, req } as never);

    expect(result).toEqual(doc);
    expect(result).toBe(doc);
  });
});

describe('revalidateRedirects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadHook() {
    const mod = await import('../revalidateRedirects.js');
    return mod.revalidateRedirects;
  }

  it('calls revalidateTag and returns the doc', async () => {
    const { revalidateTag } = await import('next/cache');
    const hook = await loadHook();
    const doc = { id: '1', from: '/old', to: '/new' };

    const result = hook({ doc });

    expect(result).toBe(doc);
    expect(revalidateTag).toHaveBeenCalledWith('redirects', 'page');
  });

  it('logs the operation when context is provided', async () => {
    const hook = await loadHook();
    const mockLogger = { info: vi.fn(), error: vi.fn() };
    const doc = { id: '1' };
    const context = {
      revealui: { logger: mockLogger },
      operation: 'update',
    };

    hook({ doc, context } as never);

    expect(mockLogger.info).toHaveBeenCalledWith('Revalidating redirects after update operation');
  });

  it('does not throw when logging fails', async () => {
    const hook = await loadHook();
    const doc = { id: '1' };
    const context = {
      revealui: {
        logger: {
          info: () => {
            throw new Error('log fail');
          },
        },
      },
    };

    expect(() => hook({ doc, context } as never)).not.toThrow();
  });
});
