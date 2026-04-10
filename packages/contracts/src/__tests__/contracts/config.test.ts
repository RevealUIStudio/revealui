/**
 * Config Contract Tests
 *
 * Tests the ConfigContract for validation and type safety
 */

import { describe, expect, it } from 'vitest';
import {
  isConfigStructure,
  parseConfigStructure,
  validateConfigStructure,
} from '../../admin/config-contract.js';

describe('Config Contract', () => {
  describe('Validation', () => {
    it('validates valid config with minimal required fields', () => {
      const validConfig = {
        secret: 'test-secret-key',
        collections: [], // At least one collection or global required
      };

      const result = validateConfigStructure(validConfig);
      expect(result.success).toBe(false); // Should fail because collections is empty
      if (!result.success) {
        expect(result.errors.issues.some((e) => e.path.includes('collections'))).toBe(true);
      }
    });

    it('validates valid config with at least one collection', () => {
      const validConfig = {
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

      const result = validateConfigStructure(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.secret).toBe('test-secret-key');
        expect(result.data.collections).toHaveLength(1);
      }
    });

    it('validates valid config with collections and globals', () => {
      const validConfig = {
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

      const result = validateConfigStructure(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.collections).toHaveLength(1);
        expect(result.data.globals).toHaveLength(1);
      }
    });

    it('validates config with empty serverURL', () => {
      const validConfig = {
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

      const result = validateConfigStructure(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.serverURL).toBe('');
      }
    });

    it('validates config with valid serverURL', () => {
      const validConfig = {
        secret: 'test-secret-key',
        serverURL: 'https://example.com',
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

      const result = validateConfigStructure(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.serverURL).toBe('https://example.com');
      }
    });

    it('rejects invalid serverURL format', () => {
      const invalidConfig = {
        secret: 'test-secret-key',
        serverURL: 'not-a-valid-url',
      };

      const result = validateConfigStructure(invalidConfig);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.issues.length).toBeGreaterThan(0);
        expect(result.errors.issues.some((e) => e.path.includes('serverURL'))).toBe(true);
      }
    });

    it('rejects config without secret', () => {
      const invalidConfig = {
        collections: [],
      };

      const result = validateConfigStructure(invalidConfig);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.issues.some((e) => e.path.includes('secret'))).toBe(true);
      }
    });

    it('rejects config with empty secret', () => {
      const invalidConfig = {
        secret: '',
      };

      const result = validateConfigStructure(invalidConfig);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.issues.some((e) => e.path.includes('secret'))).toBe(true);
      }
    });

    it('rejects invalid collections type (not array)', () => {
      const invalidConfig = {
        secret: 'test-secret-key',
        collections: 'not-an-array',
      };

      const result = validateConfigStructure(invalidConfig);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.issues.some((e) => e.path.includes('collections'))).toBe(true);
      }
    });

    it('rejects invalid globals type (not array)', () => {
      const invalidConfig = {
        secret: 'test-secret-key',
        globals: 'not-an-array',
      };

      const result = validateConfigStructure(invalidConfig);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.issues.some((e) => e.path.includes('globals'))).toBe(true);
      }
    });

    it('validates config with admin configuration', () => {
      const validConfig = {
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
        admin: {
          user: 'users',
          meta: {
            titleSuffix: '- My Site',
            favicon: '/favicon.ico',
          },
        },
      };

      const result = validateConfigStructure(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.admin?.user).toBe('users');
        expect(result.data.admin?.meta?.titleSuffix).toBe('- My Site');
      }
    });

    it('validates config with email configuration', () => {
      const validConfig = {
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
        email: {
          fromName: 'My Site',
          fromAddress: 'noreply@example.com',
        },
      };

      const result = validateConfigStructure(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email?.fromAddress).toBe('noreply@example.com');
      }
    });

    it('rejects invalid email address', () => {
      const invalidConfig = {
        secret: 'test-secret-key',
        email: {
          fromAddress: 'not-an-email',
        },
      };

      const result = validateConfigStructure(invalidConfig);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.issues.some((e) => e.path.includes('fromAddress'))).toBe(true);
      }
    });

    it('validates config with localization', () => {
      const validConfig = {
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
        localization: {
          locales: ['en', 'es'],
          defaultLocale: 'en',
          fallback: true,
        },
      };

      const result = validateConfigStructure(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.localization?.defaultLocale).toBe('en');
      }
    });

    it('validates config with localization set to false', () => {
      const validConfig = {
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
        localization: false,
      };

      const result = validateConfigStructure(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.localization).toBe(false);
      }
    });

    it('validates config with custom properties in custom field', () => {
      const validConfig = {
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
        custom: {
          myCustomProp: 'value',
          anotherProp: 123,
        },
      };

      const result = validateConfigStructure(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.custom?.myCustomProp).toBe('value');
      }
    });

    it('rejects null values for required fields', () => {
      const invalidConfig = {
        secret: null,
      };

      const result = validateConfigStructure(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('rejects undefined for required fields', () => {
      const invalidConfig = {} as unknown;

      const result = validateConfigStructure(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('rejects wrong types for optional fields', () => {
      const invalidConfig = {
        secret: 'test-secret-key',
        debug: 'not-a-boolean',
      };

      const result = validateConfigStructure(invalidConfig);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.issues.some((e) => e.path.includes('debug'))).toBe(true);
      }
    });
  });

  describe('Type Guards', () => {
    it('isConfigStructure returns true for valid config', () => {
      const validConfig = {
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

      expect(isConfigStructure(validConfig)).toBe(true);
    });

    it('isConfigStructure returns false for invalid config', () => {
      const invalidConfig = {
        secret: '',
      };

      expect(isConfigStructure(invalidConfig)).toBe(false);
    });

    it('isConfigStructure returns false for non-object', () => {
      expect(isConfigStructure(null)).toBe(false);
      expect(isConfigStructure(undefined)).toBe(false);
      expect(isConfigStructure('string')).toBe(false);
      expect(isConfigStructure(123)).toBe(false);
    });
  });

  describe('Parse', () => {
    it('parseConfigStructure returns validated data for valid config', () => {
      const validConfig = {
        secret: 'test-secret-key',
        serverURL: 'https://example.com',
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

      const result = parseConfigStructure(validConfig);
      expect(result.secret).toBe('test-secret-key');
      expect(result.serverURL).toBe('https://example.com');
    });

    it('parseConfigStructure throws for invalid config', () => {
      const invalidConfig = {
        secret: '',
      };

      expect(() => parseConfigStructure(invalidConfig)).toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('handles config with all optional fields', () => {
      const config = {
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
        serverURL: 'https://example.com',
        admin: {
          user: 'users',
        },
        email: {
          fromAddress: 'test@example.com',
        },
        localization: {
          locales: ['en'],
          defaultLocale: 'en',
        },
        cors: ['https://example.com'],
        csrf: ['https://example.com'],
        rateLimit: {
          window: 60000,
          max: 100,
        },
        upload: {
          limits: {
            fileSize: 1000000,
          },
        },
        debug: true,
        typescript: {
          outputFile: 'types.ts',
        },
        telemetry: false,
      };

      const result = validateConfigStructure(config);
      expect(result.success).toBe(true);
    });

    it('handles config with CORS as string', () => {
      const config = {
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
        cors: 'https://example.com',
      };

      const result = validateConfigStructure(config);
      expect(result.success).toBe(true);
    });

    it('handles config with CORS as array', () => {
      const config = {
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
        cors: ['https://example.com', 'https://another.com'],
      };

      const result = validateConfigStructure(config);
      expect(result.success).toBe(true);
    });

    it('handles config with CORS as object', () => {
      const config = {
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
        cors: {
          origins: ['https://example.com'],
          headers: ['Content-Type'],
        },
      };

      const result = validateConfigStructure(config);
      expect(result.success).toBe(true);
    });
  });
});
