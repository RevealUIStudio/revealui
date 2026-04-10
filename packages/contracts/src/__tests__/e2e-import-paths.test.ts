/**
 * End-to-End Import Path Verification Tests
 *
 * These tests verify that:
 * 1. All expected types are exported from @revealui/contracts/admin
 * 2. Types match expected shapes
 * 3. No type shadowing or conflicts exist
 */

import { describe, expect, it } from 'vitest';
import * as Schemaadmin from '../admin/index.js';

describe('E2E Import Path Verification', () => {
  describe('Schema Package Exports', () => {
    it('exports core field types', () => {
      // Type exports (these will be undefined at runtime but TypeScript validates them)
      expect(Schemaadmin.FieldSchema).toBeDefined();
      expect(Schemaadmin.TextFieldSchema).toBeDefined();
      expect(Schemaadmin.NumberFieldSchema).toBeDefined();
      expect(Schemaadmin.RelationshipFieldSchema).toBeDefined();
      expect(Schemaadmin.ArrayFieldSchema).toBeDefined();
      expect(Schemaadmin.GroupFieldSchema).toBeDefined();
      expect(Schemaadmin.SelectFieldSchema).toBeDefined();
      expect(Schemaadmin.TabsFieldSchema).toBeDefined();
    });

    it('exports collection configuration', () => {
      expect(Schemaadmin.CollectionConfigSchema).toBeDefined();
      expect(Schemaadmin.CollectionLabelsSchema).toBeDefined();
      expect(Schemaadmin.CollectionAccessSchema).toBeDefined();
      expect(Schemaadmin.CollectionHooksSchema).toBeDefined();
      expect(Schemaadmin.CollectionAdminConfigSchema).toBeDefined();
    });

    it('exports global configuration', () => {
      expect(Schemaadmin.GlobalConfigSchema).toBeDefined();
      expect(Schemaadmin.GlobalLabelsSchema).toBeDefined();
      expect(Schemaadmin.GlobalAccessSchema).toBeDefined();
      expect(Schemaadmin.GlobalHooksSchema).toBeDefined();
      expect(Schemaadmin.GlobalAdminConfigSchema).toBeDefined();
    });

    it('exports factory functions', () => {
      expect(typeof Schemaadmin.createCollectionConfig).toBe('function');
      expect(typeof Schemaadmin.createAuthCollectionConfig).toBe('function');
      expect(typeof Schemaadmin.createUploadCollectionConfig).toBe('function');
      expect(typeof Schemaadmin.createGlobalConfig).toBe('function');
    });

    it('exports validation utilities', () => {
      expect(Schemaadmin.ConfigValidationError).toBeDefined();
      expect(typeof Schemaadmin.validateWithErrors).toBe('function');
      expect(typeof Schemaadmin.safeValidate).toBe('function');
    });

    it('exports config helpers', () => {
      expect(typeof Schemaadmin.defineCollection).toBe('function');
      expect(typeof Schemaadmin.defineGlobal).toBe('function');
      expect(typeof Schemaadmin.defineField).toBe('function');
    });

    it('exports extensibility utilities', () => {
      expect(typeof Schemaadmin.registerCustomFieldType).toBe('function');
      expect(typeof Schemaadmin.getCustomFieldType).toBe('function');
      expect(typeof Schemaadmin.isValidFieldType).toBe('function');
      expect(typeof Schemaadmin.registerPluginExtension).toBe('function');
      expect(typeof Schemaadmin.applyPluginExtensions).toBe('function');
      expect(typeof Schemaadmin.mergeFields).toBe('function');
      expect(typeof Schemaadmin.mergeCollectionConfigs).toBe('function');
    });

    it('exports admin compatibility utilities', () => {
      expect(typeof Schemaadmin.toAdminCollectionConfig).toBe('function');
      expect(typeof Schemaadmin.toAdminGlobalConfig).toBe('function');
      expect(typeof Schemaadmin.fromAdminCollectionConfig).toBe('function');
      expect(typeof Schemaadmin.fromAdminGlobalConfig).toBe('function');
      expect(typeof Schemaadmin.isValidSlug).toBe('function');
      expect(typeof Schemaadmin.toSlug).toBe('function');
      expect(typeof Schemaadmin.assertValidSlug).toBe('function');
    });

    it('exports type guards', () => {
      expect(typeof Schemaadmin.isTextField).toBe('function');
      expect(typeof Schemaadmin.isNumberField).toBe('function');
      expect(typeof Schemaadmin.isRelationshipField).toBe('function');
      expect(typeof Schemaadmin.isArrayField).toBe('function');
      expect(typeof Schemaadmin.isGroupField).toBe('function');
      expect(typeof Schemaadmin.isLayoutField).toBe('function');
      expect(typeof Schemaadmin.hasNestedFields).toBe('function');
    });

    it('exports schema versions', () => {
      expect(typeof Schemaadmin.FIELD_SCHEMA_VERSION).toBe('number');
      expect(typeof Schemaadmin.COLLECTION_SCHEMA_VERSION).toBe('number');
      expect(typeof Schemaadmin.GLOBAL_SCHEMA_VERSION).toBe('number');
    });
  });

  describe('Type Inference Verification', () => {
    it('Field type inference works', () => {
      const field: Schemaadmin.Field = {
        type: 'text',
        name: 'title',
        required: true,
      };
      expect(field.type).toBe('text');
    });

    it('CollectionConfig type inference works', () => {
      const config: Schemaadmin.CollectionConfig = {
        slug: 'posts',
        fields: [{ type: 'text', name: 'title' }],
      };
      expect(config.slug).toBe('posts');
    });

    it('GlobalConfig type inference works', () => {
      const config: Schemaadmin.GlobalConfig = {
        slug: 'settings',
        fields: [{ type: 'text', name: 'siteName' }],
      };
      expect(config.slug).toBe('settings');
    });

    it('Config helper returns correct type', () => {
      interface Post {
        id: string;
        title: string;
      }

      const Posts = Schemaadmin.defineCollection<Post>({
        slug: 'posts',
        fields: [{ type: 'text', name: 'title' }],
      });

      expect(Posts.slug).toBe('posts');
    });
  });

  describe('Runtime Validation Integration', () => {
    it('validates correct config successfully', () => {
      const config = {
        slug: 'test-collection',
        fields: [{ type: 'text', name: 'title' }],
      };

      const result = Schemaadmin.safeValidate(
        Schemaadmin.CollectionStructureSchema,
        config,
        'collection',
        'test-collection',
      );

      expect(result.success).toBe(true);
    });

    it('returns error for invalid slug', () => {
      const config = {
        slug: 'Invalid Slug',
        fields: [],
      };

      const result = Schemaadmin.safeValidate(
        Schemaadmin.CollectionStructureSchema,
        config,
        'collection',
        'Invalid Slug',
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.configType).toBe('collection');
      }
    });

    it('throws ConfigValidationError with validateWithErrors', () => {
      const config = {
        slug: 'Invalid Slug',
        fields: [],
      };

      expect(() => {
        Schemaadmin.validateWithErrors(
          Schemaadmin.CollectionStructureSchema,
          config,
          'collection',
          'Invalid Slug',
        );
      }).toThrow(Schemaadmin.ConfigValidationError);
    });
  });

  describe('Factory Function Integration', () => {
    it('createCollectionConfig produces valid config', () => {
      const config = Schemaadmin.createCollectionConfig(
        'products',
        [
          { type: 'text', name: 'name' },
          { type: 'number', name: 'price' },
        ],
        {
          admin: {
            useAsTitle: 'name',
          },
        },
      );

      expect(config.slug).toBe('products');
      expect(config.fields).toHaveLength(2);
    });

    it('createAuthCollectionConfig adds auth defaults', () => {
      const config = Schemaadmin.createAuthCollectionConfig('users', [
        { type: 'text', name: 'name' },
      ]);

      expect(config.slug).toBe('users');
      // Auth config defaults to empty object (which enables auth)
      expect(config.auth).toBeDefined();
      // Should add email field automatically
      expect(config.fields.some((f) => f.name === 'email')).toBe(true);
    });

    it('createUploadCollectionConfig adds upload defaults', () => {
      const config = Schemaadmin.createUploadCollectionConfig('media', [
        { type: 'text', name: 'alt' },
      ]);

      expect(config.slug).toBe('media');
      // Upload config is added
      expect(config.upload).toBeDefined();
    });

    it('createGlobalConfig produces valid global', () => {
      const config = Schemaadmin.createGlobalConfig('settings', [
        { type: 'text', name: 'siteName' },
      ]);

      expect(config.slug).toBe('settings');
    });
  });

  describe('Slug Utilities', () => {
    it('isValidSlug validates correctly', () => {
      expect(Schemaadmin.isValidSlug('posts')).toBe(true);
      expect(Schemaadmin.isValidSlug('my-posts')).toBe(true);
      expect(Schemaadmin.isValidSlug('posts-123')).toBe(true);

      expect(Schemaadmin.isValidSlug('Posts')).toBe(false);
      expect(Schemaadmin.isValidSlug('my_posts')).toBe(false);
      expect(Schemaadmin.isValidSlug('123posts')).toBe(false);
      expect(Schemaadmin.isValidSlug('')).toBe(false);
    });

    it('toSlug converts strings', () => {
      expect(Schemaadmin.toSlug('My Posts')).toBe('my-posts');
      expect(Schemaadmin.toSlug('Hello World!')).toBe('hello-world');
      expect(Schemaadmin.toSlug('already-valid')).toBe('already-valid');
    });

    it('assertValidSlug throws on invalid', () => {
      expect(() => Schemaadmin.assertValidSlug('valid-slug')).not.toThrow();
      expect(() => Schemaadmin.assertValidSlug('Invalid Slug')).toThrow();
    });
  });
});
