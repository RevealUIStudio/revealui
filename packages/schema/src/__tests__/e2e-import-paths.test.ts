/**
 * End-to-End Import Path Verification Tests
 * 
 * These tests verify that:
 * 1. All expected types are exported from @revealui/schema/cms
 * 2. Types match expected shapes
 * 3. No type shadowing or conflicts exist
 */

import { describe, it, expect } from 'vitest';
import * as SchemaCMS from '../cms';

describe('E2E Import Path Verification', () => {
  describe('Schema Package Exports', () => {
    it('exports core field types', () => {
      // Type exports (these will be undefined at runtime but TypeScript validates them)
      expect(SchemaCMS.FieldSchema).toBeDefined();
      expect(SchemaCMS.TextFieldSchema).toBeDefined();
      expect(SchemaCMS.NumberFieldSchema).toBeDefined();
      expect(SchemaCMS.RelationshipFieldSchema).toBeDefined();
      expect(SchemaCMS.ArrayFieldSchema).toBeDefined();
      expect(SchemaCMS.GroupFieldSchema).toBeDefined();
      expect(SchemaCMS.SelectFieldSchema).toBeDefined();
      expect(SchemaCMS.TabsFieldSchema).toBeDefined();
    });

    it('exports collection configuration', () => {
      expect(SchemaCMS.CollectionConfigSchema).toBeDefined();
      expect(SchemaCMS.CollectionLabelsSchema).toBeDefined();
      expect(SchemaCMS.CollectionAccessSchema).toBeDefined();
      expect(SchemaCMS.CollectionHooksSchema).toBeDefined();
      expect(SchemaCMS.CollectionAdminConfigSchema).toBeDefined();
    });

    it('exports global configuration', () => {
      expect(SchemaCMS.GlobalConfigSchema).toBeDefined();
      expect(SchemaCMS.GlobalLabelsSchema).toBeDefined();
      expect(SchemaCMS.GlobalAccessSchema).toBeDefined();
      expect(SchemaCMS.GlobalHooksSchema).toBeDefined();
      expect(SchemaCMS.GlobalAdminConfigSchema).toBeDefined();
    });

    it('exports factory functions', () => {
      expect(typeof SchemaCMS.createCollectionConfig).toBe('function');
      expect(typeof SchemaCMS.createAuthCollectionConfig).toBe('function');
      expect(typeof SchemaCMS.createUploadCollectionConfig).toBe('function');
      expect(typeof SchemaCMS.createGlobalConfig).toBe('function');
    });

    it('exports validation utilities', () => {
      expect(SchemaCMS.ConfigValidationError).toBeDefined();
      expect(typeof SchemaCMS.validateWithErrors).toBe('function');
      expect(typeof SchemaCMS.safeValidate).toBe('function');
    });

    it('exports config helpers', () => {
      expect(typeof SchemaCMS.defineCollection).toBe('function');
      expect(typeof SchemaCMS.defineGlobal).toBe('function');
      expect(typeof SchemaCMS.defineField).toBe('function');
    });

    it('exports extensibility utilities', () => {
      expect(typeof SchemaCMS.registerCustomFieldType).toBe('function');
      expect(typeof SchemaCMS.getCustomFieldType).toBe('function');
      expect(typeof SchemaCMS.isValidFieldType).toBe('function');
      expect(typeof SchemaCMS.registerPluginExtension).toBe('function');
      expect(typeof SchemaCMS.applyPluginExtensions).toBe('function');
      expect(typeof SchemaCMS.mergeFields).toBe('function');
      expect(typeof SchemaCMS.mergeCollectionConfigs).toBe('function');
    });

    it('exports CMS compatibility utilities', () => {
      expect(typeof SchemaCMS.toCMSCollectionConfig).toBe('function');
      expect(typeof SchemaCMS.toCMSGlobalConfig).toBe('function');
      expect(typeof SchemaCMS.fromCMSCollectionConfig).toBe('function');
      expect(typeof SchemaCMS.fromCMSGlobalConfig).toBe('function');
      expect(typeof SchemaCMS.isValidSlug).toBe('function');
      expect(typeof SchemaCMS.toSlug).toBe('function');
      expect(typeof SchemaCMS.assertValidSlug).toBe('function');
    });

    it('exports type guards', () => {
      expect(typeof SchemaCMS.isTextField).toBe('function');
      expect(typeof SchemaCMS.isNumberField).toBe('function');
      expect(typeof SchemaCMS.isRelationshipField).toBe('function');
      expect(typeof SchemaCMS.isArrayField).toBe('function');
      expect(typeof SchemaCMS.isGroupField).toBe('function');
      expect(typeof SchemaCMS.isLayoutField).toBe('function');
      expect(typeof SchemaCMS.hasNestedFields).toBe('function');
    });

    it('exports schema versions', () => {
      expect(typeof SchemaCMS.FIELD_SCHEMA_VERSION).toBe('number');
      expect(typeof SchemaCMS.COLLECTION_SCHEMA_VERSION).toBe('number');
      expect(typeof SchemaCMS.GLOBAL_SCHEMA_VERSION).toBe('number');
    });
  });

  describe('Type Inference Verification', () => {
    it('Field type inference works', () => {
      const field: SchemaCMS.Field = {
        type: 'text',
        name: 'title',
        required: true,
      };
      expect(field.type).toBe('text');
    });

    it('CollectionConfig type inference works', () => {
      const config: SchemaCMS.CollectionConfig = {
        slug: 'posts',
        fields: [
          { type: 'text', name: 'title' },
        ],
      };
      expect(config.slug).toBe('posts');
    });

    it('GlobalConfig type inference works', () => {
      const config: SchemaCMS.GlobalConfig = {
        slug: 'settings',
        fields: [
          { type: 'text', name: 'siteName' },
        ],
      };
      expect(config.slug).toBe('settings');
    });

    it('Config helper returns correct type', () => {
      interface Post {
        id: string;
        title: string;
      }
      
      const Posts = SchemaCMS.defineCollection<Post>({
        slug: 'posts',
        fields: [
          { type: 'text', name: 'title' },
        ],
      });
      
      expect(Posts.slug).toBe('posts');
    });
  });

  describe('Runtime Validation Integration', () => {
    it('validates correct config successfully', () => {
      const config = {
        slug: 'test-collection',
        fields: [
          { type: 'text', name: 'title' },
        ],
      };
      
      const result = SchemaCMS.safeValidate(
        SchemaCMS.CollectionStructureSchema,
        config,
        'collection',
        'test-collection'
      );
      
      expect(result.success).toBe(true);
    });

    it('returns error for invalid slug', () => {
      const config = {
        slug: 'Invalid Slug',
        fields: [],
      };
      
      const result = SchemaCMS.safeValidate(
        SchemaCMS.CollectionStructureSchema,
        config,
        'collection',
        'Invalid Slug'
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
        SchemaCMS.validateWithErrors(
          SchemaCMS.CollectionStructureSchema,
          config,
          'collection',
          'Invalid Slug'
        );
      }).toThrow(SchemaCMS.ConfigValidationError);
    });
  });

  describe('Factory Function Integration', () => {
    it('createCollectionConfig produces valid config', () => {
      const config = SchemaCMS.createCollectionConfig(
        'products',
        [
          { type: 'text', name: 'name' },
          { type: 'number', name: 'price' },
        ],
        {
          admin: {
            useAsTitle: 'name',
          },
        }
      );
      
      expect(config.slug).toBe('products');
      expect(config.fields).toHaveLength(2);
    });

    it('createAuthCollectionConfig adds auth defaults', () => {
      const config = SchemaCMS.createAuthCollectionConfig(
        'users',
        [
          { type: 'text', name: 'name' },
        ]
      );
      
      expect(config.slug).toBe('users');
      // Auth config defaults to empty object (which enables auth)
      expect(config.auth).toBeDefined();
      // Should add email field automatically
      expect(config.fields.some(f => f.name === 'email')).toBe(true);
    });

    it('createUploadCollectionConfig adds upload defaults', () => {
      const config = SchemaCMS.createUploadCollectionConfig(
        'media',
        [
          { type: 'text', name: 'alt' },
        ]
      );
      
      expect(config.slug).toBe('media');
      // Upload config is added
      expect(config.upload).toBeDefined();
    });

    it('createGlobalConfig produces valid global', () => {
      const config = SchemaCMS.createGlobalConfig(
        'settings',
        [
          { type: 'text', name: 'siteName' },
        ]
      );
      
      expect(config.slug).toBe('settings');
    });
  });

  describe('Slug Utilities', () => {
    it('isValidSlug validates correctly', () => {
      expect(SchemaCMS.isValidSlug('posts')).toBe(true);
      expect(SchemaCMS.isValidSlug('my-posts')).toBe(true);
      expect(SchemaCMS.isValidSlug('posts-123')).toBe(true);
      
      expect(SchemaCMS.isValidSlug('Posts')).toBe(false);
      expect(SchemaCMS.isValidSlug('my_posts')).toBe(false);
      expect(SchemaCMS.isValidSlug('123posts')).toBe(false);
      expect(SchemaCMS.isValidSlug('')).toBe(false);
    });

    it('toSlug converts strings', () => {
      expect(SchemaCMS.toSlug('My Posts')).toBe('my-posts');
      expect(SchemaCMS.toSlug('Hello World!')).toBe('hello-world');
      expect(SchemaCMS.toSlug('already-valid')).toBe('already-valid');
    });

    it('assertValidSlug throws on invalid', () => {
      expect(() => SchemaCMS.assertValidSlug('valid-slug')).not.toThrow();
      expect(() => SchemaCMS.assertValidSlug('Invalid Slug')).toThrow();
    });
  });
});
