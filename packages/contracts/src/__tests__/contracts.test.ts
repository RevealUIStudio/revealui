/**
 * Contracts Integration Tests
 *
 * Tests the hybrid contract system with:
 * 1. Mocked admin types (no external dependencies)
 * 2. Real validation scenarios
 * 3. Type safety verification
 * 4. Error handling
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ZodError } from 'zod/v4';
import type { Field, RevealRequest } from '../admin/index.js';
import {
  applyPluginExtensions,
  assertValidSlug,
  CollectionStructureSchema,
  // Error handling
  ConfigValidationError,
  clearCustomFieldTypes,
  clearPluginExtensions,
  // Structure schemas
  FieldStructureSchema,
  GlobalStructureSchema,
  getValidFieldTypes,
  isValidFieldType,
  // admin compat
  isValidSlug,
  // Extensibility
  registerCustomFieldType,
  registerPluginExtension,
  safeValidate,
  toSlug,
  unregisterCustomFieldType,
  validateWithErrors,
} from '../admin/index.js';

import {
  createAdminRequest,
  createMockCollectionConfig,
  createMockRequest,
  MockPostsCollection,
  MockSettingsGlobal,
  MockUsersCollection,
  mockAccessAdmin,
  mockAccessAllow,
} from './mocks/revealui.js';

describe('Contract Error Handling', () => {
  describe('ConfigValidationError', () => {
    it('formats error message with config type', () => {
      const mockZodError = new ZodError([
        {
          path: ['slug'],
          message: 'Required',
          code: 'invalid_type',
        },
      ]);

      const error = new ConfigValidationError(mockZodError, 'collection', 'posts');

      expect(error.message).toContain('Invalid collection configuration "posts"');
      expect(error.message).toContain('[slug] Required');
      expect(error.message).toContain('revealui.dev/docs');
    });

    it('provides helper methods for issue access', () => {
      const mockZodError = new ZodError([
        {
          path: ['fields', 0, 'name'],
          message: 'Required',
          code: 'invalid_type',
        },
        {
          path: ['slug'],
          message: 'Invalid format',
          code: 'custom',
        },
      ]);

      const error = new ConfigValidationError(mockZodError, 'collection');

      expect(error.hasFieldError('fields')).toBe(true);
      expect(error.hasFieldError('slug')).toBe(true);
      expect(error.hasFieldError('nonexistent')).toBe(false);
      expect(error.getMessages()).toHaveLength(2);
    });

    it('serializes to JSON correctly', () => {
      const mockZodError = new ZodError([
        {
          path: ['slug'],
          message: 'Required',
          code: 'invalid_type',
        },
      ]);

      const error = new ConfigValidationError(mockZodError, 'collection', 'test');
      const json = error.toJSON();

      expect(json.name).toBe('ConfigValidationError');
      expect(json.configType).toBe('collection');
      expect(json.configName).toBe('test');
      expect(json.issues).toHaveLength(1);
    });
  });

  describe('validateWithErrors', () => {
    it('returns valid data on success', () => {
      const field = { type: 'text', name: 'title' };
      const result = validateWithErrors(FieldStructureSchema, field, 'field');

      expect(result.type).toBe('text');
      expect(result.name).toBe('title');
    });

    it('throws ConfigValidationError on failure', () => {
      const invalidField = { name: 'title' }; // Missing type

      expect(() => {
        validateWithErrors(FieldStructureSchema, invalidField, 'field');
      }).toThrow(ConfigValidationError);
    });
  });

  describe('safeValidate', () => {
    it('returns success result for valid data', () => {
      const field = { type: 'text', name: 'title' };
      const result = safeValidate(FieldStructureSchema, field, 'field');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('text');
      }
    });

    it('returns error result for invalid data', () => {
      const invalidField = { name: 'title' };
      const result = safeValidate(FieldStructureSchema, invalidField, 'field');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ConfigValidationError);
      }
    });
  });
});

describe('Structure Schema Validation', () => {
  describe('FieldStructureSchema', () => {
    it('validates minimal field', () => {
      const field = { type: 'text' };
      const result = FieldStructureSchema.safeParse(field);
      expect(result.success).toBe(true);
    });

    it('validates field with all common properties', () => {
      const field = {
        type: 'text',
        name: 'title',
        label: 'Title',
        required: true,
        unique: false,
        index: true,
        minLength: 1,
        maxLength: 200,
        admin: {
          position: 'sidebar',
          description: 'Enter title',
        },
      };

      const result = FieldStructureSchema.safeParse(field);
      expect(result.success).toBe(true);
    });

    it('validates nested fields (array type)', () => {
      const arrayField = {
        type: 'array',
        name: 'items',
        fields: [
          { type: 'text', name: 'title' },
          { type: 'number', name: 'quantity' },
        ],
      };

      const result = FieldStructureSchema.safeParse(arrayField);
      expect(result.success).toBe(true);
    });

    it('rejects invalid field type', () => {
      const field = { type: 'invalid-type', name: 'test' };
      const result = FieldStructureSchema.safeParse(field);
      expect(result.success).toBe(false);
    });
  });

  describe('CollectionStructureSchema', () => {
    it('validates minimal collection', () => {
      const collection = {
        slug: 'posts',
        fields: [{ type: 'text', name: 'title' }],
      };

      const result = CollectionStructureSchema.safeParse(collection);
      expect(result.success).toBe(true);
    });

    it('validates collection with admin config', () => {
      const collection = {
        slug: 'posts',
        labels: { singular: 'Post', plural: 'Posts' },
        admin: {
          useAsTitle: 'title',
          defaultColumns: ['title', 'createdAt'],
        },
        fields: [{ type: 'text', name: 'title' }],
      };

      const result = CollectionStructureSchema.safeParse(collection);
      expect(result.success).toBe(true);
    });

    it('rejects invalid slug format', () => {
      const collection = {
        slug: 'Invalid Slug',
        fields: [{ type: 'text' }],
      };

      const result = CollectionStructureSchema.safeParse(collection);
      expect(result.success).toBe(false);
    });
  });

  describe('GlobalStructureSchema', () => {
    it('validates minimal global', () => {
      const global = {
        slug: 'settings',
        fields: [{ type: 'text', name: 'siteName' }],
      };

      const result = GlobalStructureSchema.safeParse(global);
      expect(result.success).toBe(true);
    });
  });
});

describe('Mock Config Integration', () => {
  it('MockPostsCollection is valid', () => {
    const result = CollectionStructureSchema.safeParse(MockPostsCollection);
    expect(result.success).toBe(true);
  });

  it('MockUsersCollection is valid', () => {
    const result = CollectionStructureSchema.safeParse(MockUsersCollection);
    expect(result.success).toBe(true);
  });

  it('MockSettingsGlobal is valid', () => {
    const result = GlobalStructureSchema.safeParse(MockSettingsGlobal);
    expect(result.success).toBe(true);
  });

  it('mock access functions work correctly', () => {
    const req = createMockRequest();
    const adminReq = createAdminRequest();

    expect(mockAccessAllow({ req: req as RevealRequest })).toBe(true);
    expect(mockAccessAdmin({ req: req as RevealRequest })).toBe(false);
    expect(mockAccessAdmin({ req: adminReq as RevealRequest })).toBe(true);
  });
});

describe('Custom Field Type Extensibility', () => {
  beforeEach(() => {
    clearCustomFieldTypes();
  });

  afterEach(() => {
    clearCustomFieldTypes();
  });

  it('registers custom field type', () => {
    registerCustomFieldType('color-picker', {
      description: 'Color picker field',
      defaultValue: '#000000',
    });

    expect(isValidFieldType('color-picker')).toBe(true);
    expect(getValidFieldTypes()).toContain('color-picker');
  });

  it('validates built-in field types', () => {
    expect(isValidFieldType('text')).toBe(true);
    expect(isValidFieldType('number')).toBe(true);
    expect(isValidFieldType('relationship')).toBe(true);
    expect(isValidFieldType('nonexistent')).toBe(false);
  });

  it('unregisters custom field type', () => {
    registerCustomFieldType('temp-field', { description: 'Temporary' });
    expect(isValidFieldType('temp-field')).toBe(true);

    unregisterCustomFieldType('temp-field');
    expect(isValidFieldType('temp-field')).toBe(false);
  });
});

describe('Plugin Field Extensions', () => {
  beforeEach(() => {
    clearPluginExtensions();
  });

  afterEach(() => {
    clearPluginExtensions();
  });

  it('applies global fields to collection', () => {
    const globalFields: Field[] = [
      { type: 'text', name: 'metaTitle' },
      { type: 'textarea', name: 'metaDescription' },
    ];
    registerPluginExtension({
      pluginName: 'seo-plugin',
      globalFields,
    });

    const baseConfig = createMockCollectionConfig();
    const extendedConfig = applyPluginExtensions(baseConfig);

    expect(extendedConfig.fields.length).toBe(3); // 1 base + 2 global
  });

  it('applies collection-specific fields', () => {
    const collectionFields: Record<string, Field[]> = {
      'test-collection': [{ type: 'number', name: 'viewCount' }],
    };
    registerPluginExtension({
      pluginName: 'analytics-plugin',
      collectionFields,
    });

    const baseConfig = createMockCollectionConfig();
    const extendedConfig = applyPluginExtensions(baseConfig);

    expect(extendedConfig.fields.length).toBe(2);
  });
});

describe('RevealUI Compatibility', () => {
  describe('Slug Validation', () => {
    it('validates correct slugs', () => {
      expect(isValidSlug('posts')).toBe(true);
      expect(isValidSlug('my-posts')).toBe(true);
      expect(isValidSlug('posts-2024')).toBe(true);
      expect(isValidSlug('a')).toBe(true);
    });

    it('rejects invalid slugs', () => {
      expect(isValidSlug('Posts')).toBe(false); // Uppercase
      expect(isValidSlug('my_posts')).toBe(false); // Underscore
      expect(isValidSlug('123posts')).toBe(false); // Starts with number
      expect(isValidSlug('-posts')).toBe(false); // Starts with hyphen
      expect(isValidSlug('')).toBe(false); // Empty
    });

    it('converts strings to valid slugs', () => {
      expect(toSlug('My Posts')).toBe('my-posts');
      expect(toSlug('Hello World!')).toBe('hello-world');
      expect(toSlug('123 Numbers')).toBe('x-123-numbers');
      expect(toSlug('already-valid')).toBe('already-valid');
    });

    it('assertValidSlug throws for invalid', () => {
      expect(() => assertValidSlug('posts', 'test')).not.toThrow();
      expect(() => assertValidSlug('Invalid', 'test')).toThrow();
    });
  });
});

describe('Type Safety (Compile-Time)', () => {
  /**
   * These tests verify that TypeScript correctly infers types.
   * If they compile, the type system is working.
   */

  it('CollectionConfig accepts generic document type', () => {
    interface Article {
      title: string;
      body: string;
    }

    const config = createMockCollectionConfig<Article>({
      slug: 'articles',
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'body', type: 'richText' },
      ],
    });

    // TypeScript should know this is CollectionConfig<Article>
    expect(config.slug).toBe('articles');
  });

  it('hook types work with generics', () => {
    interface Product {
      name: string;
      price: number;
    }

    // This would fail at compile time if types don't match
    const afterChange = ({ doc }: { doc: Product }) => {
      // TypeScript knows doc has name and price
      console.log(doc.name, doc.price);
      return doc;
    };

    expect(typeof afterChange).toBe('function');
  });

  it('access functions receive correct args', () => {
    const access = ({ req }: { req: { user?: { roles?: string[] } } }) => {
      return req?.user?.roles?.includes('admin') ?? false;
    };

    const result = access({ req: { user: { roles: ['admin'] } } });
    expect(result).toBe(true);
  });
});
