/**
 * Next.js utilities tests  -  validates getRevealUI singleton caching,
 * development HMR refresh behavior, and config change detection.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks  -  must be defined before imports
// ---------------------------------------------------------------------------

const mockGetRevealUICore = vi.fn();

vi.mock('../../config/runtime.js', () => ({
  getRevealUI: (...args: unknown[]) => mockGetRevealUICore(...args),
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

// We need to re-import the module for each test to reset module-level state.
// Use dynamic import with cache busting.

async function loadUtilities() {
  // Clear the module from vitest's module cache to reset module-level state
  vi.resetModules();

  // Re-mock after resetModules
  vi.doMock('../../config/runtime.js', () => ({
    getRevealUI: (...args: unknown[]) => mockGetRevealUICore(...args),
  }));

  const mod = await import('../../nextjs/utilities.js');
  return mod;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockRevealUIInstance {
  collections: Record<string, unknown>;
  config: Record<string, unknown>;
}

function createMockInstance(id = 'instance-1'): MockRevealUIInstance {
  return {
    collections: {},
    config: { id },
  };
}

function createMockConfig(name = 'test-config'): Record<string, unknown> {
  return { name, collections: [] };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockGetRevealUICore.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// =============================================================================
// getRevealUI  -  basic behavior
// =============================================================================

describe('getRevealUI  -  basic behavior', () => {
  it('returns a RevealUI instance', async () => {
    const mockInstance = createMockInstance();
    mockGetRevealUICore.mockResolvedValue(mockInstance);

    const { getRevealUI } = await loadUtilities();
    const config = createMockConfig();
    const result = await getRevealUI({ config });

    expect(result).toBe(mockInstance);
  });

  it('calls core getRevealUI with the config', async () => {
    const mockInstance = createMockInstance();
    mockGetRevealUICore.mockResolvedValue(mockInstance);

    const { getRevealUI } = await loadUtilities();
    const config = createMockConfig();
    await getRevealUI({ config });

    expect(mockGetRevealUICore).toHaveBeenCalledWith({ config });
  });
});

// =============================================================================
// getRevealUI  -  caching
// =============================================================================

describe('getRevealUI  -  caching', () => {
  it('returns cached instance for same config reference', async () => {
    const mockInstance = createMockInstance();
    mockGetRevealUICore.mockResolvedValue(mockInstance);

    const { getRevealUI } = await loadUtilities();
    const config = createMockConfig();

    // Set to production to enable caching
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const result1 = await getRevealUI({ config });
      const result2 = await getRevealUI({ config });

      expect(result1).toBe(result2);
      // Should only call core once since it's cached
      expect(mockGetRevealUICore).toHaveBeenCalledTimes(1);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('creates new instance when config reference changes', async () => {
    const instance1 = createMockInstance('instance-1');
    const instance2 = createMockInstance('instance-2');
    mockGetRevealUICore.mockResolvedValueOnce(instance1).mockResolvedValueOnce(instance2);

    const { getRevealUI } = await loadUtilities();

    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const config1 = createMockConfig('config-1');
      const config2 = createMockConfig('config-2');

      const result1 = await getRevealUI({ config: config1 });
      const result2 = await getRevealUI({ config: config2 });

      expect(result1).toBe(instance1);
      expect(result2).toBe(instance2);
      expect(mockGetRevealUICore).toHaveBeenCalledTimes(2);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});

// =============================================================================
// getRevealUI  -  development HMR behavior
// =============================================================================

describe('getRevealUI  -  development mode', () => {
  it('always creates a new instance in development', async () => {
    const instance1 = createMockInstance('instance-1');
    const instance2 = createMockInstance('instance-2');
    mockGetRevealUICore.mockResolvedValueOnce(instance1).mockResolvedValueOnce(instance2);

    const { getRevealUI } = await loadUtilities();

    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    try {
      const config = createMockConfig();

      const result1 = await getRevealUI({ config });
      const result2 = await getRevealUI({ config });

      // In development, each call creates a new instance (HMR support)
      expect(mockGetRevealUICore).toHaveBeenCalledTimes(2);
      expect(result1).toBe(instance1);
      expect(result2).toBe(instance2);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('clears cached instance in development mode', async () => {
    const instance1 = createMockInstance('first');
    const instance2 = createMockInstance('second');
    mockGetRevealUICore.mockResolvedValueOnce(instance1).mockResolvedValueOnce(instance2);

    const { getRevealUI } = await loadUtilities();
    const config = createMockConfig();

    // First call in production  -  caches
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      await getRevealUI({ config });
      expect(mockGetRevealUICore).toHaveBeenCalledTimes(1);

      // Switch to development  -  should clear cache
      process.env.NODE_ENV = 'development';
      const result = await getRevealUI({ config });

      expect(mockGetRevealUICore).toHaveBeenCalledTimes(2);
      expect(result).toBe(instance2);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});

// =============================================================================
// getRevealUI  -  error propagation
// =============================================================================

describe('getRevealUI  -  error handling', () => {
  it('propagates errors from core getRevealUI', async () => {
    mockGetRevealUICore.mockRejectedValue(new Error('Config validation failed'));

    const { getRevealUI } = await loadUtilities();
    const config = createMockConfig();

    await expect(getRevealUI({ config })).rejects.toThrow('Config validation failed');
  });

  it('does not cache failed instances', async () => {
    const mockInstance = createMockInstance();
    mockGetRevealUICore
      .mockRejectedValueOnce(new Error('First attempt failed'))
      .mockResolvedValueOnce(mockInstance);

    const { getRevealUI } = await loadUtilities();
    const config = createMockConfig();

    // First call fails
    await expect(getRevealUI({ config })).rejects.toThrow('First attempt failed');

    // Second call with same config should try again (not return cached error)
    const result = await getRevealUI({ config });
    expect(result).toBe(mockInstance);
    expect(mockGetRevealUICore).toHaveBeenCalledTimes(2);
  });
});

// =============================================================================
// getRevealUI  -  config identity check
// =============================================================================

describe('getRevealUI  -  config identity', () => {
  it('uses reference equality for config comparison', async () => {
    const instance1 = createMockInstance('instance-1');
    mockGetRevealUICore.mockResolvedValue(instance1);

    const { getRevealUI } = await loadUtilities();

    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      // Two structurally identical but referentially different configs
      const config1 = { name: 'same', collections: [] };
      const config2 = { name: 'same', collections: [] };

      await getRevealUI({ config: config1 });
      await getRevealUI({ config: config2 });

      // Should call twice because reference equality fails
      expect(mockGetRevealUICore).toHaveBeenCalledTimes(2);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
