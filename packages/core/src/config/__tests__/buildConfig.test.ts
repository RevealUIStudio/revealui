/**
 * buildConfig Integration Tests
 *
 * Tests the buildConfig function with ConfigContract validation
 */

import { ConfigValidationError } from '@revealui/contracts/admin';
import { describe, expect, it } from 'vitest';
import type { Config } from '../../../types/index.js';
import { buildConfig } from '../index.js';

describe('buildConfig Integration', () => {
  describe('Valid Configs', () => {
    it('builds config with minimal required fields', () => {
      const config: Config = {
        secret: 'test-secret-key',
        collections: [
          {
            slug: 'posts',
            fields: [
              {
                type: 'text',
                name: 'title',
              },
            ],
          },
        ],
      };

      const result = buildConfig(config);
      expect(result.secret).toBe('test-secret-key');
      expect(result.collections).toHaveLength(1);
      expect(result.globals).toEqual([]);
    });

    it('builds config with collections and globals', () => {
      const config: Config = {
        secret: 'test-secret-key',
        collections: [
          {
            slug: 'posts',
            fields: [
              {
                type: 'text',
                name: 'title',
              },
            ],
          },
        ],
        globals: [
          {
            slug: 'settings',
            fields: [
              {
                type: 'text',
                name: 'siteName',
              },
            ],
          },
        ],
      };

      const result = buildConfig(config);
      expect(result.collections).toHaveLength(1);
      expect(result.globals).toHaveLength(1);
    });

    it('builds config with empty serverURL', () => {
      const config: Config = {
        secret: 'test-secret-key',
        serverURL: '',
        collections: [
          {
            slug: 'posts',
            fields: [
              {
                type: 'text',
                name: 'title',
              },
            ],
          },
        ],
      };

      const result = buildConfig(config);
      expect(result.serverURL).toBe('');
    });

    it('applies default values correctly', () => {
      const config: Config = {
        secret: 'test-secret-key',
        collections: [
          {
            slug: 'posts',
            fields: [
              {
                type: 'text',
                name: 'title',
              },
            ],
          },
        ],
      };

      const result = buildConfig(config);
      expect(result.admin?.importMap?.autoGenerate).toBe(true);
      expect(result.typescript?.autoGenerate).toBe(true);
      expect(result.localization?.defaultLocale).toBe('en');
    });

    it('merges user config with defaults', () => {
      const config: Config = {
        secret: 'test-secret-key',
        collections: [
          {
            slug: 'posts',
            fields: [
              {
                type: 'text',
                name: 'title',
              },
            ],
          },
        ],
        typescript: {
          outputFile: 'custom-types.ts',
        },
      };

      const result = buildConfig(config);
      expect(result.typescript?.outputFile).toBe('custom-types.ts');
      expect(result.typescript?.autoGenerate).toBe(true); // From defaults
    });
  });

  describe('Invalid Configs', () => {
    it('throws ConfigValidationError for missing secret', () => {
      const config = {} as Config;

      expect(() => buildConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws ConfigValidationError for empty secret', () => {
      const config: Config = {
        secret: '',
      };

      expect(() => buildConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws ConfigValidationError for invalid serverURL', () => {
      const config: Config = {
        secret: 'test-secret-key',
        serverURL: 'not-a-valid-url',
      };

      expect(() => buildConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws ConfigValidationError for invalid collections type', () => {
      const config = {
        secret: 'test-secret-key',
        collections: 'not-an-array',
      } as unknown as Config;

      expect(() => buildConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws ConfigValidationError for invalid globals type', () => {
      const config = {
        secret: 'test-secret-key',
        globals: 'not-an-array',
      } as unknown as Config;

      expect(() => buildConfig(config)).toThrow(ConfigValidationError);
    });

    it('provides detailed error messages', () => {
      const config = {
        secret: '',
        serverURL: 'invalid-url',
      } as Config;

      try {
        buildConfig(config);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigValidationError);
        if (error instanceof ConfigValidationError) {
          expect(error.message).toContain('Invalid config configuration');
          expect(error.issues.length).toBeGreaterThan(0);
          expect(error.getMessages().length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Real Config Integration', () => {
    it('validates real config structure from admin app', () => {
      // This tests with a realistic config structure
      const realConfig: Config = {
        secret: 'test-secret-key',
        serverURL: 'https://example.com',
        admin: {
          user: 'users',
          importMap: {
            autoGenerate: true,
            baseDir: '/path/to/app',
          },
          meta: {
            titleSuffix: '- My Site',
            favicon: '/favicon.ico',
          },
        },
        collections: [
          {
            slug: 'posts',
            fields: [
              {
                type: 'text',
                name: 'title',
              },
            ],
          },
        ],
        globals: [
          {
            slug: 'settings',
            fields: [
              {
                type: 'text',
                name: 'siteName',
              },
            ],
          },
        ],
        localization: {
          locales: ['en', 'es'],
          defaultLocale: 'en',
          fallback: true,
        },
        cors: ['https://example.com'],
        typescript: {
          autoGenerate: true,
          outputFile: 'src/types/revealui.ts',
        },
      };

      const result = buildConfig(realConfig);
      expect(result.secret).toBe('test-secret-key');
      expect(result.collections).toHaveLength(1);
      expect(result.globals).toHaveLength(1);
      expect(result.localization?.defaultLocale).toBe('en');
    });
  });

  describe('Plugin Processing', () => {
    it('processes plugins after validation', () => {
      const config: Config = {
        secret: 'test-secret-key',
        collections: [
          {
            slug: 'posts',
            fields: [
              {
                type: 'text',
                name: 'title',
              },
            ],
          },
        ],
        plugins: [
          (cfg) => {
            return {
              ...cfg,
              custom: {
                pluginAdded: true,
              },
            };
          },
        ],
      };

      const result = buildConfig(config);
      expect(result.custom).toEqual({ pluginAdded: true });
    });

    it('handles empty plugins array', () => {
      const config: Config = {
        secret: 'test-secret-key',
        collections: [
          {
            slug: 'posts',
            fields: [
              {
                type: 'text',
                name: 'title',
              },
            ],
          },
        ],
        plugins: [],
      };

      const result = buildConfig(config);
      expect(result).toBeDefined();
    });
  });
});
