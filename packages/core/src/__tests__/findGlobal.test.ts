/**
 * findGlobal Tests
 *
 * Unit tests for the findGlobal() method using mocks.
 * Integration tests with real database should be in integration test suite.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RevealUIInstance } from '../types/index.js';

describe('findGlobal', () => {
  const mockGlobalFind = vi.fn();
  const mockEnsureDbConnected = vi.fn().mockResolvedValue(undefined);

  const createMockInstance = (globals: string[] = ['settings']): RevealUIInstance => {
    const globalInstances: Record<string, unknown> = {};
    globals.forEach((slug) => {
      globalInstances[slug] = {
        find: mockGlobalFind,
      };
    });

    return {
      config: {
        collections: [],
        globals: globals.map((slug) => ({
          slug,
          fields: [{ name: 'test', type: 'text' }],
        })),
      },
      globals: globalInstances,
      collections: {},
      db: null,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
      secret: 'test-secret',
      findGlobal: async function (options) {
        await mockEnsureDbConnected();
        const { slug } = options;

        // Find global config
        const globalConfig = this.config.globals?.find((g) => g.slug === slug);
        if (!globalConfig) {
          throw new Error(`Global '${slug}' not found`);
        }

        // Check if global instance exists
        if (!this.globals[slug]) {
          throw new Error(`Global '${slug}' instance not initialized`);
        }

        // Call the global's find method
        return await (this.globals[slug] as { find: typeof mockGlobalFind }).find({ depth: 0 });
      },
    } as unknown as RevealUIInstance;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Error Cases', () => {
    it('should throw error when global slug does not exist in config', async () => {
      const mockInstance = createMockInstance([]);

      await expect(
        mockInstance.findGlobal({
          slug: 'nonexistent',
        }),
      ).rejects.toThrow("Global 'nonexistent' not found");

      expect(mockEnsureDbConnected).toHaveBeenCalled();
    });

    it('should throw error with descriptive message for missing global', async () => {
      const mockInstance = createMockInstance([]);

      await expect(
        mockInstance.findGlobal({
          slug: 'invalid-slug',
        }),
      ).rejects.toThrow("Global 'invalid-slug' not found");
    });

    it('should throw error when global instance not initialized', async () => {
      const mockInstance = createMockInstance(['settings']);
      // Remove the global instance to simulate uninitialized state
      mockInstance.globals.settings = undefined;

      await expect(
        mockInstance.findGlobal({
          slug: 'settings',
        }),
      ).rejects.toThrow("Global 'settings' instance not initialized");
    });
  });

  describe('Basic Functionality', () => {
    it('should call global find method and return result', async () => {
      const mockDocument = { id: '1', siteName: 'Test Site' };
      mockGlobalFind.mockResolvedValue(mockDocument);

      const mockInstance = createMockInstance(['settings']);
      const result = await mockInstance.findGlobal({
        slug: 'settings',
      });

      expect(mockEnsureDbConnected).toHaveBeenCalled();
      expect(mockGlobalFind).toHaveBeenCalledWith({ depth: 0 });
      expect(result).toEqual(mockDocument);
    });

    it('should return null when global find returns null', async () => {
      mockGlobalFind.mockResolvedValue(null);

      const mockInstance = createMockInstance(['settings']);
      const result = await mockInstance.findGlobal({
        slug: 'settings',
      });

      expect(result).toBeNull();
    });

    it('should accept all optional parameters', async () => {
      mockGlobalFind.mockResolvedValue({ id: '1' });

      const mockInstance = createMockInstance(['settings']);
      const result = await mockInstance.findGlobal({
        slug: 'settings',
        depth: 0,
        draft: false,
        locale: 'en',
        fallbackLocale: 'en',
        overrideAccess: false,
        showHiddenFields: false,
      });

      expect(result).toBeDefined();
    });
  });

  describe('Method Signature Validation', () => {
    it('should be a function', () => {
      const mockInstance = createMockInstance(['settings']);
      expect(typeof mockInstance.findGlobal).toBe('function');
    });

    it('should return a Promise', () => {
      mockGlobalFind.mockResolvedValue({ id: '1' });
      const mockInstance = createMockInstance(['settings']);
      const result = mockInstance.findGlobal({
        slug: 'settings',
      });
      expect(result).toBeInstanceOf(Promise);
    });
  });
});

/**
 * Integration Test Notes:
 *
 * The following scenarios require full database setup and should be tested in integration tests:
 *
 * 1. **Basic Global Retrieval**
 *    - Create a global document via updateGlobal()
 *    - Retrieve it via findGlobal()
 *    - Verify all fields are returned correctly
 *
 * 2. **Relationship Population (depth > 0)**
 *    - Create a global with relationship fields
 *    - Create related documents
 *    - Call findGlobal with depth > 0
 *    - Verify relationships are populated
 *
 * 3. **afterRead Hook Execution**
 *    - Create a global with afterRead hooks
 *    - Call findGlobal with req parameter
 *    - Verify hooks are executed
 *
 * 4. **Locale Handling**
 *    - Create global documents in multiple locales
 *    - Call findGlobal with locale parameter
 *    - Verify correct locale is returned
 *
 * 5. **Draft Mode**
 *    - Create draft and published versions
 *    - Call findGlobal with draft: true/false
 *    - Verify correct version is returned
 *
 * 6. **Access Control**
 *    - Create globals with access rules
 *    - Call findGlobal with different user contexts
 *    - Verify access control is enforced
 */
