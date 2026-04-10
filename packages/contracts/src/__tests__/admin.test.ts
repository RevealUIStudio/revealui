import { describe, expect, it } from 'vitest';
import {
  AuthConfigSchema,
  // Collection contracts
  COLLECTION_SCHEMA_VERSION,
  CollectionAccessSchema,
  CollectionAdminConfigSchema,
  type CollectionConfig,
  CollectionConfigSchema,
  CollectionHooksSchema,
  CollectionLabelsSchema,
  createAuthCollectionConfig,
  // Collection factories
  createCollectionConfig,
  // Global factories
  createGlobalConfig,
  createUploadCollectionConfig,
  // Field contracts
  FIELD_SCHEMA_VERSION,
  type Field,
  FieldAccessConfigSchema,
  FieldAdminConfigSchema,
  FieldHooksConfigSchema,
  FieldOptionSchema,
  FieldSchema,
  type FieldType,
  FieldTypeSchema,
  // Global contracts
  GLOBAL_SCHEMA_VERSION,
  GlobalAccessSchema,
  GlobalAdminConfigSchema,
  type GlobalConfig,
  GlobalConfigSchema,
  GlobalHooksSchema,
  GlobalLabelsSchema,
  GlobalVersionsConfigSchema,
  hasNestedFields,
  isArrayField,
  isGroupField,
  isLayoutField,
  isNumberField,
  isRelationshipField,
  // Type guards
  isTextField,
  NumberFieldSchema,
  RelationshipFieldSchema,
  SanitizedCollectionConfigSchema,
  SanitizedGlobalConfigSchema,
  SelectFieldSchema,
  TextFieldSchema,
  UploadConfigSchema,
  VersionsConfigSchema,
} from '../admin/index.js';

describe('Admin Contracts', () => {
  describe('Field Schemas', () => {
    describe('FieldTypeSchema', () => {
      it('should accept all valid field types', () => {
        const types: FieldType[] = [
          'text',
          'textarea',
          'number',
          'email',
          'password',
          'code',
          'json',
          'date',
          'checkbox',
          'radio',
          'select',
          'point',
          'relationship',
          'upload',
          'array',
          'blocks',
          'group',
          'richText',
          'row',
          'tabs',
          'collapsible',
          'ui',
        ];

        for (const type of types) {
          expect(FieldTypeSchema.parse(type)).toBe(type);
        }
      });

      it('should reject invalid field types', () => {
        expect(() => FieldTypeSchema.parse('invalid')).toThrow();
        expect(() => FieldTypeSchema.parse('')).toThrow();
        expect(() => FieldTypeSchema.parse(123)).toThrow();
      });
    });

    describe('FieldAdminConfigSchema', () => {
      it('should validate empty config', () => {
        const result = FieldAdminConfigSchema.safeParse({});
        expect(result.success).toBe(true);
      });

      it('should validate position', () => {
        const config = { position: 'sidebar' };
        const result = FieldAdminConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });

      it('should validate boolean flags', () => {
        const config = {
          readOnly: true,
          hidden: false,
          disabled: true,
          hideGutter: false,
          isClearable: true,
          isSortable: true,
          initCollapsed: false,
        };
        const result = FieldAdminConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });

      it('should validate layout', () => {
        expect(FieldAdminConfigSchema.safeParse({ layout: 'horizontal' }).success).toBe(true);
        expect(FieldAdminConfigSchema.safeParse({ layout: 'vertical' }).success).toBe(true);
        expect(FieldAdminConfigSchema.safeParse({ layout: 'invalid' }).success).toBe(false);
      });

      it('should validate width as string or number', () => {
        expect(FieldAdminConfigSchema.safeParse({ width: 100 }).success).toBe(true);
        expect(FieldAdminConfigSchema.safeParse({ width: '50%' }).success).toBe(true);
      });

      it('should validate date configuration', () => {
        const config = {
          date: {
            displayFormat: 'YYYY-MM-DD',
            pickerAppearance: 'dayAndTime',
          },
        };
        const result = FieldAdminConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });

      it('should allow passthrough properties', () => {
        const config = { customProperty: 'value' };
        const result = FieldAdminConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.customProperty).toBe('value');
        }
      });
    });

    describe('FieldAccessConfigSchema', () => {
      it('should validate empty config', () => {
        const result = FieldAccessConfigSchema.safeParse({});
        expect(result.success).toBe(true);
      });

      it('should accept access functions as unknown', () => {
        const config = {
          create: () => true,
          read: () => false,
          update: async () => true,
        };
        const result = FieldAccessConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });
    });

    describe('FieldHooksConfigSchema', () => {
      it('should validate empty config', () => {
        const result = FieldHooksConfigSchema.safeParse({});
        expect(result.success).toBe(true);
      });

      it('should accept hook arrays', () => {
        const config = {
          beforeChange: [() => undefined, async () => undefined],
          afterChange: [() => undefined],
          beforeValidate: [],
          afterRead: [() => undefined],
        };
        const result = FieldHooksConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });
    });

    describe('FieldOptionSchema', () => {
      it('should accept string options', () => {
        expect(FieldOptionSchema.parse('option1')).toBe('option1');
      });

      it('should accept object options', () => {
        const option = { label: 'Option 1', value: 'option1' };
        const result = FieldOptionSchema.parse(option);
        expect(result).toEqual(option);
      });
    });

    describe('FieldSchema', () => {
      it('should validate minimal field', () => {
        const field = { type: 'text' };
        const result = FieldSchema.safeParse(field);
        expect(result.success).toBe(true);
      });

      it('should validate named field', () => {
        const field = { name: 'title', type: 'text' };
        const result = FieldSchema.safeParse(field);
        expect(result.success).toBe(true);
      });

      it('should validate field with label', () => {
        const stringLabel = { name: 'title', type: 'text', label: 'Title' };
        const falseLabel = { name: 'title', type: 'text', label: false };

        expect(FieldSchema.safeParse(stringLabel).success).toBe(true);
        expect(FieldSchema.safeParse(falseLabel).success).toBe(true);
      });

      it('should validate field with constraints', () => {
        const field = {
          name: 'count',
          type: 'number',
          min: 0,
          max: 100,
          required: true,
          unique: false,
        };
        const result = FieldSchema.safeParse(field);
        expect(result.success).toBe(true);
      });

      it('should validate field with text constraints', () => {
        const field = {
          name: 'description',
          type: 'textarea',
          minLength: 10,
          maxLength: 500,
        };
        const result = FieldSchema.safeParse(field);
        expect(result.success).toBe(true);
      });

      it('should validate relationship field', () => {
        const singleRelation = {
          name: 'author',
          type: 'relationship',
          relationTo: 'users',
        };
        const multiRelation = {
          name: 'tags',
          type: 'relationship',
          relationTo: ['tags', 'categories'],
          hasMany: true,
        };

        expect(FieldSchema.safeParse(singleRelation).success).toBe(true);
        expect(FieldSchema.safeParse(multiRelation).success).toBe(true);
      });

      it('should validate nested array field', () => {
        const field: Field = {
          name: 'items',
          type: 'array',
          fields: [
            { name: 'title', type: 'text' },
            { name: 'value', type: 'number' },
          ],
        };
        const result = FieldSchema.safeParse(field);
        expect(result.success).toBe(true);
      });

      it('should validate group field', () => {
        const field: Field = {
          name: 'address',
          type: 'group',
          fields: [
            { name: 'street', type: 'text' },
            { name: 'city', type: 'text' },
            { name: 'zip', type: 'text' },
          ],
        };
        const result = FieldSchema.safeParse(field);
        expect(result.success).toBe(true);
      });

      it('should validate select field with options', () => {
        const field = {
          name: 'status',
          type: 'select',
          options: [
            { label: 'Draft', value: 'draft' },
            { label: 'Published', value: 'published' },
          ],
        };
        const result = FieldSchema.safeParse(field);
        expect(result.success).toBe(true);
      });

      it('should validate row field (layout)', () => {
        const field: Field = {
          type: 'row',
          fields: [
            { name: 'firstName', type: 'text' },
            { name: 'lastName', type: 'text' },
          ],
        };
        const result = FieldSchema.safeParse(field);
        expect(result.success).toBe(true);
      });

      it('should validate tabs field', () => {
        const field: Field = {
          type: 'tabs',
          tabs: [
            {
              label: 'Content',
              fields: [{ name: 'title', type: 'text' }],
            },
            {
              label: 'Settings',
              fields: [{ name: 'enabled', type: 'checkbox' }],
            },
          ],
        };
        const result = FieldSchema.safeParse(field);
        expect(result.success).toBe(true);
      });

      it('should allow passthrough for custom properties', () => {
        const field = {
          name: 'custom',
          type: 'text',
          customProperty: 'value',
          anotherCustom: 123,
        };
        const result = FieldSchema.safeParse(field);
        expect(result.success).toBe(true);
      });
    });

    describe('Specific Field Type Schemas', () => {
      it('TextFieldSchema should require name', () => {
        const valid = { name: 'title', type: 'text' };
        const invalid = { type: 'text' };

        expect(TextFieldSchema.safeParse(valid).success).toBe(true);
        expect(TextFieldSchema.safeParse(invalid).success).toBe(false);
      });

      it('NumberFieldSchema should validate min/max', () => {
        const field = { name: 'count', type: 'number', min: 0, max: 100 };
        const result = NumberFieldSchema.safeParse(field);
        expect(result.success).toBe(true);
      });

      it('RelationshipFieldSchema should require relationTo', () => {
        const valid = {
          name: 'author',
          type: 'relationship',
          relationTo: 'users',
        };
        const invalid = { name: 'author', type: 'relationship' };

        expect(RelationshipFieldSchema.safeParse(valid).success).toBe(true);
        expect(RelationshipFieldSchema.safeParse(invalid).success).toBe(false);
      });

      it('SelectFieldSchema should require options', () => {
        const valid = {
          name: 'status',
          type: 'select',
          options: [{ label: 'A', value: 'a' }],
        };
        const invalid = { name: 'status', type: 'select' };

        expect(SelectFieldSchema.safeParse(valid).success).toBe(true);
        expect(SelectFieldSchema.safeParse(invalid).success).toBe(false);
      });
    });

    describe('Type Guards', () => {
      it('isTextField should identify text fields', () => {
        expect(isTextField({ name: 'x', type: 'text' })).toBe(true);
        expect(isTextField({ name: 'x', type: 'number' })).toBe(false);
      });

      it('isNumberField should identify number fields', () => {
        expect(isNumberField({ name: 'x', type: 'number' })).toBe(true);
        expect(isNumberField({ name: 'x', type: 'text' })).toBe(false);
      });

      it('isRelationshipField should identify relationship fields', () => {
        expect(isRelationshipField({ name: 'x', type: 'relationship' })).toBe(true);
        expect(isRelationshipField({ name: 'x', type: 'text' })).toBe(false);
      });

      it('isArrayField should identify array fields', () => {
        expect(isArrayField({ name: 'x', type: 'array', fields: [] })).toBe(true);
        expect(isArrayField({ name: 'x', type: 'text' })).toBe(false);
      });

      it('isGroupField should identify group fields', () => {
        expect(isGroupField({ name: 'x', type: 'group', fields: [] })).toBe(true);
        expect(isGroupField({ name: 'x', type: 'text' })).toBe(false);
      });

      it('isLayoutField should identify layout fields', () => {
        expect(isLayoutField({ type: 'row', fields: [] })).toBe(true);
        expect(isLayoutField({ type: 'tabs', tabs: [] })).toBe(true);
        expect(isLayoutField({ type: 'collapsible', fields: [] })).toBe(true);
        expect(isLayoutField({ name: 'x', type: 'text' })).toBe(false);
      });

      it('hasNestedFields should identify fields with nested fields', () => {
        expect(hasNestedFields({ name: 'x', type: 'array', fields: [] })).toBe(true);
        expect(hasNestedFields({ name: 'x', type: 'group', fields: [] })).toBe(true);
        expect(hasNestedFields({ type: 'row', fields: [] })).toBe(true);
        expect(hasNestedFields({ type: 'collapsible', fields: [] })).toBe(true);
        expect(hasNestedFields({ type: 'tabs', tabs: [{ label: 'Test', fields: [] }] })).toBe(true);
        expect(hasNestedFields({ name: 'x', type: 'text' })).toBe(false);
      });
    });
  });

  describe('Collection Schemas', () => {
    describe('CollectionLabelsSchema', () => {
      it('should validate undefined labels', () => {
        expect(CollectionLabelsSchema.safeParse(undefined).success).toBe(true);
      });

      it('should validate singular and plural', () => {
        const labels = { singular: 'Post', plural: 'Posts' };
        const result = CollectionLabelsSchema.safeParse(labels);
        expect(result.success).toBe(true);
      });

      it('should require singular when object provided', () => {
        const invalid = { plural: 'Posts' };
        expect(CollectionLabelsSchema.safeParse(invalid).success).toBe(false);
      });
    });

    describe('CollectionAccessSchema', () => {
      it('should validate empty access', () => {
        expect(CollectionAccessSchema.safeParse({}).success).toBe(true);
      });

      it('should accept access functions', () => {
        const access = {
          create: () => true,
          read: () => ({ status: { equals: 'published' } }),
          update: async () => true,
          delete: () => false,
        };
        const result = CollectionAccessSchema.safeParse(access);
        expect(result.success).toBe(true);
      });
    });

    describe('CollectionHooksSchema', () => {
      it('should validate empty hooks', () => {
        expect(CollectionHooksSchema.safeParse({}).success).toBe(true);
      });

      it('should accept hook arrays', () => {
        const hooks = {
          beforeChange: [() => undefined, () => undefined],
          afterChange: [() => undefined],
          beforeValidate: [],
          afterRead: [async () => undefined],
          beforeDelete: [() => undefined],
          afterDelete: [],
        };
        const result = CollectionHooksSchema.safeParse(hooks);
        expect(result.success).toBe(true);
      });
    });

    describe('CollectionAdminConfigSchema', () => {
      it('should validate empty config', () => {
        expect(CollectionAdminConfigSchema.safeParse({}).success).toBe(true);
      });

      it('should validate useAsTitle', () => {
        const config = { useAsTitle: 'name' };
        expect(CollectionAdminConfigSchema.safeParse(config).success).toBe(true);
      });

      it('should validate defaultColumns', () => {
        const config = { defaultColumns: ['name', 'status', 'createdAt'] };
        expect(CollectionAdminConfigSchema.safeParse(config).success).toBe(true);
      });

      it('should validate pagination', () => {
        const config = {
          pagination: {
            defaultLimit: 10,
            limits: [10, 25, 50, 100],
          },
        };
        expect(CollectionAdminConfigSchema.safeParse(config).success).toBe(true);
      });
    });

    describe('UploadConfigSchema', () => {
      it('should validate empty config', () => {
        expect(UploadConfigSchema.safeParse({}).success).toBe(true);
      });

      it('should validate full config', () => {
        const config = {
          staticDir: './uploads',
          staticURL: '/media',
          mimeTypes: ['image/*', 'application/pdf'],
          imageSizes: [
            { name: 'thumbnail', width: 100, height: 100 },
            { name: 'medium', width: 400 },
          ],
          crop: true,
          focalPoint: true,
          adminThumbnail: 'thumbnail',
        };
        expect(UploadConfigSchema.safeParse(config).success).toBe(true);
      });
    });

    describe('AuthConfigSchema', () => {
      it('should validate empty config', () => {
        expect(AuthConfigSchema.safeParse({}).success).toBe(true);
      });

      it('should validate full config', () => {
        const config = {
          tokenExpiration: 7200,
          useAPIKey: true,
          verify: true,
          maxLoginAttempts: 5,
          lockTime: 600000,
          cookies: {
            secure: true,
            sameSite: 'lax',
            domain: 'example.com',
          },
        };
        expect(AuthConfigSchema.safeParse(config).success).toBe(true);
      });

      it('should validate cookie sameSite values', () => {
        expect(AuthConfigSchema.safeParse({ cookies: { sameSite: 'strict' } }).success).toBe(true);
        expect(AuthConfigSchema.safeParse({ cookies: { sameSite: 'lax' } }).success).toBe(true);
        expect(AuthConfigSchema.safeParse({ cookies: { sameSite: 'none' } }).success).toBe(true);
        expect(AuthConfigSchema.safeParse({ cookies: { sameSite: 'invalid' } }).success).toBe(
          false,
        );
      });
    });

    describe('VersionsConfigSchema', () => {
      it('should validate empty config', () => {
        expect(VersionsConfigSchema.safeParse({}).success).toBe(true);
      });

      it('should validate maxPerDoc', () => {
        const config = { maxPerDoc: 10 };
        expect(VersionsConfigSchema.safeParse(config).success).toBe(true);
      });

      it('should validate drafts', () => {
        expect(VersionsConfigSchema.safeParse({ drafts: true }).success).toBe(true);
        expect(VersionsConfigSchema.safeParse({ drafts: false }).success).toBe(true);
        expect(
          VersionsConfigSchema.safeParse({
            drafts: { autosave: true },
          }).success,
        ).toBe(true);
        expect(
          VersionsConfigSchema.safeParse({
            drafts: { autosave: { interval: 5000 } },
          }).success,
        ).toBe(true);
      });
    });

    describe('CollectionConfigSchema', () => {
      it('should validate minimal config', () => {
        const config = {
          slug: 'posts',
          fields: [{ name: 'title', type: 'text' }],
        };
        const result = CollectionConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });

      it('should validate full config', () => {
        const config: CollectionConfig = {
          slug: 'posts',
          fields: [
            { name: 'title', type: 'text', required: true },
            { name: 'content', type: 'richText' },
            { name: 'author', type: 'relationship', relationTo: 'users' },
          ],
          labels: { singular: 'Post', plural: 'Posts' },
          admin: {
            useAsTitle: 'title',
            defaultColumns: ['title', 'author', 'createdAt'],
            group: 'Content',
          },
          access: {
            create: () => true,
            read: () => true,
          },
          hooks: {
            beforeChange: [() => undefined],
          },
          timestamps: true,
          versions: { drafts: true },
        };
        const result = CollectionConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });

      it('should validate auth collection', () => {
        const config = {
          slug: 'users',
          fields: [
            { name: 'name', type: 'text' },
            {
              name: 'roles',
              type: 'select',
              hasMany: true,
              options: ['admin', 'user'],
            },
          ],
          auth: {
            tokenExpiration: 3600,
            verify: true,
          },
        };
        const result = CollectionConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });

      it('should validate upload collection', () => {
        const config = {
          slug: 'media',
          fields: [{ name: 'alt', type: 'text' }],
          upload: {
            staticDir: './media',
            mimeTypes: ['image/*'],
            imageSizes: [{ name: 'thumbnail', width: 200, height: 200 }],
          },
        };
        const result = CollectionConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });

      it('should reject config without slug', () => {
        const config = { fields: [{ name: 'title', type: 'text' }] };
        const result = CollectionConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
      });

      it('should reject config without fields', () => {
        const config = { slug: 'posts' };
        const result = CollectionConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
      });
    });

    describe('SanitizedCollectionConfigSchema', () => {
      it('should validate with flattened fields', () => {
        const config = {
          slug: 'posts',
          fields: [{ name: 'title', type: 'text' }],
          flattenedFields: [{ name: 'title', type: 'text', path: 'title' }],
        };
        const result = SanitizedCollectionConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });
    });

    describe('Collection Factory Functions', () => {
      it('createCollectionConfig should create valid config', () => {
        const config = createCollectionConfig('posts', [
          { name: 'title', type: 'text', required: true },
          { name: 'content', type: 'richText' },
        ]);

        expect(config.slug).toBe('posts');
        expect(config.fields).toHaveLength(2);
        expect(config.schemaVersion).toBe(COLLECTION_SCHEMA_VERSION);
        expect(config.timestamps).toBe(true);

        // Validate created config
        const result = CollectionConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });

      it('createCollectionConfig should accept options', () => {
        const config = createCollectionConfig('articles', [{ name: 'title', type: 'text' }], {
          labels: { singular: 'Article', plural: 'Articles' },
          admin: { useAsTitle: 'title' },
          timestamps: false,
        });

        expect(config.labels?.singular).toBe('Article');
        expect(config.admin?.useAsTitle).toBe('title');
        expect(config.timestamps).toBe(false);
      });

      it('createAuthCollectionConfig should create auth config', () => {
        const config = createAuthCollectionConfig('users', [{ name: 'name', type: 'text' }]);

        expect(config.slug).toBe('users');
        expect(config.auth).toBeDefined();
        expect(typeof config.auth).toBe('object');

        const result = CollectionConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });

      it('createAuthCollectionConfig should accept auth options', () => {
        const config = createAuthCollectionConfig('admins', [{ name: 'name', type: 'text' }], {
          tokenExpiration: 7200,
          useAPIKey: true,
        });

        expect(config.auth).toBeDefined();
        expect(typeof config.auth).toBe('object');
        if (typeof config.auth === 'object' && config.auth !== null) {
          expect((config.auth as Record<string, unknown>).tokenExpiration).toBe(7200);
          expect((config.auth as Record<string, unknown>).useAPIKey).toBe(true);
        }
      });

      it('createUploadCollectionConfig should create upload config', () => {
        const config = createUploadCollectionConfig('media', [{ name: 'alt', type: 'text' }]);

        expect(config.slug).toBe('media');
        expect(config.upload).toBeDefined();
        expect(typeof config.upload).toBe('object');

        const result = CollectionConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });

      it('createUploadCollectionConfig should accept upload options', () => {
        const config = createUploadCollectionConfig('images', [{ name: 'caption', type: 'text' }], {
          staticDir: './uploads/images',
          mimeTypes: ['image/jpeg', 'image/png'],
          imageSizes: [{ name: 'thumb', width: 100 }],
        });

        expect(config.upload).toBeDefined();
        expect(typeof config.upload).toBe('object');
        if (typeof config.upload === 'object' && config.upload !== null) {
          expect((config.upload as Record<string, unknown>).staticDir).toBe('./uploads/images');
          expect((config.upload as Record<string, unknown>).mimeTypes).toEqual([
            'image/jpeg',
            'image/png',
          ]);
        }
      });
    });
  });

  describe('Global Schemas', () => {
    describe('GlobalLabelsSchema', () => {
      it('should validate undefined labels', () => {
        expect(GlobalLabelsSchema.safeParse(undefined).success).toBe(true);
      });

      it('should validate singular label', () => {
        const labels = { singular: 'Site Settings' };
        expect(GlobalLabelsSchema.safeParse(labels).success).toBe(true);
      });

      it('should validate singular and plural labels', () => {
        const labels = { singular: 'Setting', plural: 'Settings' };
        expect(GlobalLabelsSchema.safeParse(labels).success).toBe(true);
      });

      it('should require singular when object provided', () => {
        const invalid = { plural: 'Settings' };
        expect(GlobalLabelsSchema.safeParse(invalid).success).toBe(false);
      });
    });

    describe('GlobalAccessSchema', () => {
      it('should validate empty access', () => {
        expect(GlobalAccessSchema.safeParse({}).success).toBe(true);
      });

      it('should accept read and update functions', () => {
        const access = {
          read: () => true,
          update: () => false,
        };
        expect(GlobalAccessSchema.safeParse(access).success).toBe(true);
      });
    });

    describe('GlobalHooksSchema', () => {
      it('should validate empty hooks', () => {
        expect(GlobalHooksSchema.safeParse({}).success).toBe(true);
      });

      it('should accept hook arrays', () => {
        const hooks = {
          beforeChange: [() => undefined],
          afterChange: [() => undefined],
          beforeRead: [() => undefined],
          afterRead: [() => undefined],
        };
        expect(GlobalHooksSchema.safeParse(hooks).success).toBe(true);
      });
    });

    describe('GlobalAdminConfigSchema', () => {
      it('should validate empty config', () => {
        expect(GlobalAdminConfigSchema.safeParse({}).success).toBe(true);
      });

      it('should validate group', () => {
        const config = { group: 'Settings' };
        expect(GlobalAdminConfigSchema.safeParse(config).success).toBe(true);
      });

      it('should validate hidden', () => {
        expect(GlobalAdminConfigSchema.safeParse({ hidden: true }).success).toBe(true);
        expect(GlobalAdminConfigSchema.safeParse({ hidden: false }).success).toBe(true);
      });
    });

    describe('GlobalVersionsConfigSchema', () => {
      it('should validate empty config', () => {
        expect(GlobalVersionsConfigSchema.safeParse({}).success).toBe(true);
      });

      it('should validate maxPerDoc', () => {
        expect(GlobalVersionsConfigSchema.safeParse({ max: 5 }).success).toBe(true);
      });

      it('should validate drafts', () => {
        expect(GlobalVersionsConfigSchema.safeParse({ drafts: true }).success).toBe(true);
      });
    });

    describe('GlobalConfigSchema', () => {
      it('should validate minimal config', () => {
        const config = {
          slug: 'settings',
          fields: [{ name: 'siteName', type: 'text' }],
        };
        const result = GlobalConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });

      it('should validate full config', () => {
        const config: GlobalConfig = {
          slug: 'settings',
          fields: [
            { name: 'siteName', type: 'text', required: true },
            { name: 'description', type: 'textarea' },
            {
              name: 'social',
              type: 'group',
              fields: [
                { name: 'twitter', type: 'text' },
                { name: 'facebook', type: 'text' },
              ],
            },
          ],
          label: 'Site Settings',
          admin: {
            group: 'Configuration',
          },
          access: {
            read: () => true,
            update: () => false,
          },
          hooks: {
            afterChange: [() => undefined],
          },
          versions: { drafts: true },
        };
        const result = GlobalConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });

      it('should reject config without slug', () => {
        const config = { fields: [{ name: 'title', type: 'text' }] };
        const result = GlobalConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
      });

      it('should reject config without fields', () => {
        const config = { slug: 'settings' };
        const result = GlobalConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
      });
    });

    describe('SanitizedGlobalConfigSchema', () => {
      it('should validate with flattened fields', () => {
        const config = {
          slug: 'settings',
          fields: [{ name: 'siteName', type: 'text' }],
          flattenedFields: [{ name: 'siteName', type: 'text', path: 'siteName' }],
        };
        const result = SanitizedGlobalConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });
    });

    describe('Global Factory Functions', () => {
      it('createGlobalConfig should create valid config', () => {
        const config = createGlobalConfig('settings', [
          { name: 'siteName', type: 'text', required: true },
          { name: 'tagline', type: 'text' },
        ]);

        expect(config.slug).toBe('settings');
        expect(config.fields).toHaveLength(2);
        expect(config.schemaVersion).toBe(GLOBAL_SCHEMA_VERSION);

        const result = GlobalConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });

      it('createGlobalConfig should accept options', () => {
        const config = createGlobalConfig('seo', [{ name: 'title', type: 'text' }], {
          label: 'SEO Settings',
          admin: { group: 'Marketing' },
        });

        expect(config.label).toBe('SEO Settings');
        expect(config.admin?.group).toBe('Marketing');
      });

      it('createGlobalConfig should handle nested fields', () => {
        const config = createGlobalConfig('navigation', [
          {
            name: 'links',
            type: 'array',
            fields: [
              { name: 'label', type: 'text' },
              { name: 'url', type: 'text' },
            ],
          },
        ]);

        expect(config.fields[0].type).toBe('array');
        expect((config.fields[0] as { fields: Field[] }).fields).toHaveLength(2);
      });
    });
  });

  describe('Schema Versions', () => {
    it('should have correct version constants', () => {
      expect(FIELD_SCHEMA_VERSION).toBe(1);
      expect(COLLECTION_SCHEMA_VERSION).toBe(1);
      expect(GLOBAL_SCHEMA_VERSION).toBe(1);
    });

    it('collection config should include version', () => {
      const config = createCollectionConfig('test', [{ name: 'x', type: 'text' }]);
      expect(config.schemaVersion).toBe(COLLECTION_SCHEMA_VERSION);
    });

    it('global config should include version', () => {
      const config = createGlobalConfig('test', [{ name: 'x', type: 'text' }]);
      expect(config.schemaVersion).toBe(GLOBAL_SCHEMA_VERSION);
    });
  });
});
