/**
 * Create Method Tests
 *
 * Unit tests for the create instance method.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RevealDocument, RevealUIInstance } from '../../../types/index.js';
import { create } from '../create.js';
import { callHooks } from '../hooks.js';

// Mock callHooks
vi.mock('../hooks', () => ({
  callHooks: vi.fn(),
}));

describe('create method', () => {
  const mockInstance: RevealUIInstance = {
    collections: {
      'test-collection': {
        create: vi.fn(),
      } as never,
    },
    globals: {},
    config: {
      collections: [
        {
          slug: 'test-collection',
          hooks: {
            afterChange: [],
          },
        } as never,
      ],
      globals: [],
    },
    db: null,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    secret: undefined,
  };

  const mockEnsureDbConnected = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call collection create method', async () => {
    const options = {
      collection: 'test-collection',
      data: {
        title: 'Test',
      },
    };

    const mockDoc: RevealDocument = {
      id: 'test-id',
      title: 'Test',
    };

    vi.mocked(mockInstance.collections['test-collection'].create).mockResolvedValue(mockDoc);
    vi.mocked(callHooks).mockResolvedValue(mockDoc);

    const result = await create(mockInstance, mockEnsureDbConnected, options);

    expect(result).toEqual(mockDoc);
    expect(mockEnsureDbConnected).toHaveBeenCalled();
    expect(mockInstance.collections['test-collection'].create).toHaveBeenCalledWith(options);
  });

  it('should call hooks if configured', async () => {
    const options = {
      collection: 'test-collection',
      data: {
        title: 'Test',
      },
      req: {} as never,
    };

    const mockDoc: RevealDocument = {
      id: 'test-id',
      title: 'Test',
    };

    vi.mocked(mockInstance.collections['test-collection'].create).mockResolvedValue(mockDoc);
    vi.mocked(callHooks).mockResolvedValue(mockDoc);

    await create(mockInstance, mockEnsureDbConnected, options);

    expect(callHooks).toHaveBeenCalled();
  });

  it('should throw error if collection not found', async () => {
    const options = {
      collection: 'non-existent',
      data: {
        title: 'Test',
      },
    };

    await expect(create(mockInstance, mockEnsureDbConnected, options)).rejects.toThrow(
      "Collection 'non-existent' not found",
    );
  });

  it('should enforce access.create when overrideAccess is not set', async () => {
    const accessDenyingInstance: RevealUIInstance = {
      ...mockInstance,
      config: {
        collections: [
          {
            slug: 'test-collection',
            access: { create: async () => false },
            hooks: { afterChange: [] },
          } as never,
        ],
        globals: [],
      },
    };

    const options = {
      collection: 'test-collection',
      data: { title: 'Test' },
      req: {} as never,
    };

    await expect(create(accessDenyingInstance, mockEnsureDbConnected, options)).rejects.toThrow(
      'Access denied',
    );
    expect(accessDenyingInstance.collections['test-collection'].create).not.toHaveBeenCalled();
  });

  it('should skip access.create check when overrideAccess is true (regression for bootstrap flow)', async () => {
    const accessDenyingInstance: RevealUIInstance = {
      ...mockInstance,
      config: {
        collections: [
          {
            slug: 'test-collection',
            access: { create: async () => false },
            hooks: { afterChange: [] },
          } as never,
        ],
        globals: [],
      },
    };

    const mockDoc: RevealDocument = { id: 'bootstrap-admin', title: 'First admin' };
    vi.mocked(accessDenyingInstance.collections['test-collection'].create).mockResolvedValue(
      mockDoc,
    );

    // No req — bootstrap flow doesn't have an authenticated user in-request;
    // that's exactly the scenario overrideAccess is for. Without req, the
    // afterChange hooks path also doesn't fire, so the result is whatever
    // the low-level collection.create returns.
    const options = {
      collection: 'test-collection',
      data: { title: 'First admin' },
      overrideAccess: true,
    };

    const result = await create(accessDenyingInstance, mockEnsureDbConnected, options);

    expect(result).toEqual(mockDoc);
    expect(accessDenyingInstance.collections['test-collection'].create).toHaveBeenCalledWith(
      options,
    );
  });
});
