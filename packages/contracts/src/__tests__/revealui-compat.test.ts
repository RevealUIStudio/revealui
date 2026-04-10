/**
 * RevealUI admin Type Compatibility Tests
 *
 * These tests verify that RevealUI types are compatible with standard admin patterns.
 * They use compile-time type assertions that will fail if types become incompatible.
 *
 * NOTE: These tests verify RevealUI's type system compatibility.
 */

import type {
  AccessFunction,
  CollectionAfterChangeHook,
  CollectionConfig,
  Field,
  GlobalConfig,
  RevealRequest,
} from '@revealui/contracts/admin';
import { describe, expect, it } from 'vitest';

// Type-level compatibility assertions
// These won't run at runtime, but will cause TypeScript errors if types are incompatible

describe('Type Compatibility Assertions', () => {
  describe('CollectionConfig', () => {
    it('accepts minimal collection', () => {
      const config: CollectionConfig = {
        slug: 'posts',
        fields: [{ type: 'text', name: 'title' }],
      };
      expect(config.slug).toBe('posts');
    });

    it('accepts collection with all common options', () => {
      const config: CollectionConfig = {
        slug: 'posts',
        labels: {
          singular: 'Post',
          plural: 'Posts',
        },
        admin: {
          useAsTitle: 'title',
          defaultColumns: ['title', 'createdAt'],
        },
        timestamps: true,
        fields: [
          { type: 'text', name: 'title', required: true },
          { type: 'richText', name: 'content' },
        ],
        access: {
          read: () => true,
          create: ({ req }) => Boolean(req?.user),
        },
        hooks: {
          afterChange: [({ doc }) => doc],
        },
      };
      expect(config.slug).toBe('posts');
    });

    it('accepts collection with auth', () => {
      const config: CollectionConfig = {
        slug: 'users',
        auth: true,
        fields: [{ type: 'text', name: 'name' }],
      };
      expect(config.auth).toBe(true);
    });

    it('accepts collection with upload', () => {
      const config: CollectionConfig = {
        slug: 'media',
        upload: {
          staticDir: 'media',
          mimeTypes: ['image/*'],
        },
        fields: [],
      };
      expect(config.upload).toBeDefined();
    });
  });

  describe('GlobalConfig', () => {
    it('accepts minimal global', () => {
      const config: GlobalConfig = {
        slug: 'settings',
        fields: [{ type: 'text', name: 'siteName' }],
      };
      expect(config.slug).toBe('settings');
    });

    it('accepts global with access', () => {
      const config: GlobalConfig = {
        slug: 'settings',
        fields: [{ type: 'text', name: 'siteName' }],
        access: {
          read: () => true,
          update: ({ req }) => Boolean(req?.user),
        },
      };
      expect(config.access).toBeDefined();
    });
  });

  describe('Field', () => {
    it('accepts text field', () => {
      const field: Field = {
        type: 'text',
        name: 'title',
        required: true,
        minLength: 1,
        maxLength: 200,
      };
      expect(field.type).toBe('text');
    });

    it('accepts relationship field', () => {
      const field: Field = {
        type: 'relationship',
        name: 'author',
        relationTo: 'users',
        hasMany: false,
      };
      expect(field.type).toBe('relationship');
    });

    it('accepts array field with nested fields', () => {
      const field: Field = {
        type: 'array',
        name: 'items',
        fields: [
          { type: 'text', name: 'label' },
          { type: 'number', name: 'value' },
        ],
      };
      expect(field.type).toBe('array');
    });

    it('accepts blocks field', () => {
      const field: Field = {
        type: 'blocks',
        name: 'layout',
        blocks: [
          {
            slug: 'hero',
            fields: [{ type: 'text', name: 'heading' }],
          },
        ],
      };
      expect(field.type).toBe('blocks');
    });

    it('accepts field with admin config', () => {
      const field: Field = {
        type: 'text',
        name: 'title',
        admin: {
          position: 'sidebar',
          description: 'Enter title',
          readOnly: false,
          hidden: false,
        },
      };
      expect(field.admin).toBeDefined();
    });
  });

  describe('AccessFunction', () => {
    it('accepts simple access function', () => {
      const emptyReq: RevealRequest = {};
      const access: AccessFunction = () => true;
      expect(access({ req: emptyReq })).toBe(true);
    });

    it('accepts access function with req parameter', () => {
      const userReq: RevealRequest = { user: { id: '1' } };
      const access: AccessFunction = ({ req }) => {
        return Boolean(req?.user);
      };
      expect(access({ req: userReq })).toBe(true);
    });

    it('accepts async access function', async () => {
      const userReq: RevealRequest = { user: { id: '1' } };
      const access: AccessFunction = async ({ req }) => {
        return Boolean(req?.user);
      };
      const result = await access({ req: userReq });
      expect(result).toBe(true);
    });

    it('accepts access function returning where clause', () => {
      const userReq: RevealRequest = { user: { id: '1' } };
      const access: AccessFunction = ({ req }) => {
        if (!req?.user) return false;
        return {
          author: { equals: req.user.id },
        };
      };
      const result = access({ req: userReq });
      expect(result).toEqual({ author: { equals: '1' } });
    });
  });

  describe('CollectionAfterChangeHook', () => {
    it('accepts typed hook', () => {
      interface Post {
        id: string;
        title: string;
      }

      const hook: CollectionAfterChangeHook<Post> = ({ doc, operation }) => {
        console.log(`${operation}: ${doc.title}`);
        return doc;
      };

      const emptyReq: RevealRequest = {};
      const result = hook({
        doc: { id: '1', title: 'Test' },
        operation: 'create',
        req: emptyReq,
        previousDoc: { id: '1', title: 'Test' },
        context: {},
      });
      expect(result).toEqual({ id: '1', title: 'Test' });
    });

    it('accepts async hook', async () => {
      const hook: CollectionAfterChangeHook = async ({ doc }) => {
        await Promise.resolve();
        return doc;
      };

      const emptyReq: RevealRequest = {};
      const result = await hook({
        doc: { id: '1' },
        operation: 'update',
        req: emptyReq,
        previousDoc: { id: '1' },
        context: {},
      });
      expect(result).toEqual({ id: '1' });
    });
  });
});

describe('Real-world Config Patterns', () => {
  it('creates a blog posts collection', () => {
    interface Post {
      id: string;
      title: string;
      slug: string;
      content: unknown;
      author: string;
      publishedAt?: Date;
      status: 'draft' | 'published';
    }

    const Posts: CollectionConfig<Post> = {
      slug: 'posts',
      labels: {
        singular: 'Post',
        plural: 'Posts',
      },
      admin: {
        useAsTitle: 'title',
        defaultColumns: ['title', 'author', 'status', 'publishedAt'],
        group: 'Content',
      },
      versions: {
        drafts: {
          autosave: {
            interval: 3000,
          },
        },
      },
      fields: [
        { name: 'title', type: 'text', required: true },
        {
          name: 'slug',
          type: 'text',
          required: true,
          unique: true,
          admin: {
            position: 'sidebar',
          },
        },
        { name: 'content', type: 'richText' },
        {
          name: 'author',
          type: 'relationship',
          relationTo: 'users',
          required: true,
        },
        {
          name: 'publishedAt',
          type: 'date',
          admin: {
            position: 'sidebar',
          },
        },
        {
          name: 'status',
          type: 'select',
          options: [
            { label: 'Draft', value: 'draft' },
            { label: 'Published', value: 'published' },
          ],
          defaultValue: 'draft',
          admin: {
            position: 'sidebar',
          },
        },
      ],
      access: {
        read: () => true,
        create: ({ req }) => Boolean(req?.user),
        update: ({ req }) => Boolean(req?.user),
        delete: ({ req }) => Boolean(req?.user),
      },
      hooks: {
        beforeChange: [
          ({ data, operation }) => {
            if (operation === 'create' && !data.slug) {
              // Auto-generate slug from title
              data.slug = data.title?.toLowerCase().replace(/\s+/g, '-');
            }
            return data;
          },
        ],
        afterChange: [
          ({ doc, operation }) => {
            console.log(`Post ${operation}:`, doc.title);
            return doc;
          },
        ],
      },
    };

    expect(Posts.slug).toBe('posts');
    expect(Posts.fields.length).toBeGreaterThan(0);
  });

  it('creates a users collection with auth', () => {
    const Users: CollectionConfig = {
      slug: 'users',
      auth: {
        tokenExpiration: 7200,
        verify: false,
        maxLoginAttempts: 5,
        lockTime: 600000,
        useAPIKey: true,
      },
      admin: {
        useAsTitle: 'email',
        group: 'Admin',
      },
      fields: [
        { name: 'name', type: 'text' },
        {
          name: 'roles',
          type: 'select',
          hasMany: true,
          options: [
            { label: 'Admin', value: 'admin' },
            { label: 'User', value: 'user' },
          ],
          defaultValue: ['user'],
        },
      ],
      access: {
        read: () => true,
        create: ({ req }) => req?.user?.roles?.includes('admin') ?? false,
        update: ({ req, id }) => {
          if (req?.user?.roles?.includes('admin')) return true;
          return req?.user?.id === id;
        },
        delete: ({ req }) => req?.user?.roles?.includes('admin') ?? false,
      },
    };

    expect(Users.slug).toBe('users');
    expect(Users.auth).toBeDefined();
  });

  it('creates a media collection with upload', () => {
    const Media: CollectionConfig = {
      slug: 'media',
      upload: {
        staticDir: 'media',
        mimeTypes: ['image/*', 'application/pdf'],
        imageSizes: [
          {
            name: 'thumbnail',
            width: 150,
            height: 150,
            position: 'centre',
          },
          {
            name: 'card',
            width: 400,
            height: 300,
            fit: 'cover',
          },
        ],
      },
      admin: {
        group: 'Media',
      },
      fields: [
        { name: 'alt', type: 'text', required: true },
        { name: 'caption', type: 'textarea' },
      ],
      access: {
        read: () => true,
        create: ({ req }) => Boolean(req?.user),
      },
    };

    expect(Media.slug).toBe('media');
    expect(Media.upload).toBeDefined();
  });

  it('creates a settings global', () => {
    const Settings: GlobalConfig = {
      slug: 'settings',
      label: 'Site Settings',
      admin: {
        group: 'Admin',
      },
      fields: [
        {
          type: 'group',
          name: 'general',
          fields: [
            { name: 'siteName', type: 'text', required: true },
            { name: 'siteDescription', type: 'textarea' },
          ],
        },
        {
          type: 'group',
          name: 'social',
          fields: [
            { name: 'twitter', type: 'text' },
            { name: 'facebook', type: 'text' },
            { name: 'instagram', type: 'text' },
          ],
        },
      ],
      access: {
        read: () => true,
        update: ({ req }) => req?.user?.roles?.includes('admin') ?? false,
      },
    };

    expect(Settings.slug).toBe('settings');
  });
});
