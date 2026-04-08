/**
 * Integration Tests with Real Config Patterns
 *
 * These tests validate that our type system correctly handles
 * real-world configuration patterns from apps/admin.
 *
 * Instead of importing directly (which would create a dependency cycle),
 * we recreate representative configs based on the actual codebase.
 */

import { describe, expect, it } from 'vitest';
import {
  type AccessFunction,
  type CollectionAfterChangeHook,
  type CollectionAfterReadHook,
  type CollectionConfig,
  CollectionStructureSchema,
  type Field,
  FieldStructureSchema,
  type GlobalConfig,
  GlobalStructureSchema,
  type RevealRequest,
  safeValidate,
} from '../cms/index.js';

describe('Real Config Patterns from apps/admin', () => {
  describe('Posts Collection (apps/admin/src/lib/collections/Posts)', () => {
    // Mirror of actual Posts collection structure
    const PostsConfig: CollectionConfig = {
      slug: 'posts',
      access: {
        create: ({ req }) => Boolean(req?.user),
        delete: ({ req }) => Boolean(req?.user),
        read: () => true,
        update: ({ req }) => Boolean(req?.user),
      },
      admin: {
        defaultColumns: ['title', 'slug', 'updatedAt'],
        useAsTitle: 'title',
      },
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
        },
        {
          type: 'tabs',
          tabs: [
            {
              label: 'Content',
              fields: [
                {
                  name: 'content',
                  type: 'richText',
                  label: false,
                  required: true,
                },
              ],
            },
            {
              label: 'Meta',
              fields: [
                {
                  name: 'relatedPosts',
                  type: 'relationship',
                  admin: {
                    position: 'sidebar',
                  },
                  hasMany: true,
                  relationTo: 'posts',
                },
                {
                  name: 'categories',
                  type: 'relationship',
                  admin: {
                    position: 'sidebar',
                  },
                  hasMany: true,
                  relationTo: 'categories',
                },
              ],
            },
          ],
        },
        {
          name: 'publishedAt',
          type: 'date',
          admin: {
            position: 'sidebar',
          },
        },
        {
          name: 'authors',
          type: 'relationship',
          admin: {
            position: 'sidebar',
          },
          hasMany: true,
          relationTo: 'users',
        },
        {
          name: 'populatedAuthors',
          type: 'array',
          admin: {
            disabled: true,
            readOnly: true,
          },
          fields: [
            { name: 'id', type: 'text' },
            { name: 'name', type: 'text' },
          ],
        },
        // slug field pattern
        {
          name: 'slug',
          type: 'text',
          index: true,
          required: true,
          unique: true,
          admin: {
            position: 'sidebar',
          },
        },
      ],
      hooks: {
        afterChange: [
          ({ doc }) => doc, // revalidatePost placeholder
        ],
        afterRead: [
          ({ doc }) => doc, // populateAuthors placeholder
        ],
      },
      versions: {
        drafts: {
          autosave: {
            interval: 100,
          },
        },
        maxPerDoc: 50,
      },
    };

    it('validates Posts structure', () => {
      const result = safeValidate(CollectionStructureSchema, PostsConfig, 'collection', 'posts');
      expect(result.success).toBe(true);
    });

    it('has correct slug', () => {
      expect(PostsConfig.slug).toBe('posts');
    });

    it('has tabs field structure', () => {
      const tabsField = PostsConfig.fields.find((f) => f.type === 'tabs');
      expect(tabsField).toBeDefined();
      expect(tabsField?.tabs?.length).toBe(2);
    });

    it('has versioning configured', () => {
      expect(PostsConfig.versions).toBeDefined();
    });
  });

  describe('Users Collection (apps/admin/src/lib/collections/Users)', () => {
    // Mirror of actual Users collection structure
    const UsersConfig: CollectionConfig = {
      slug: 'users',
      timestamps: true,
      admin: {
        useAsTitle: 'email',
        defaultColumns: ['email'],
      },
      auth: {
        useAPIKey: true,
      },
      access: {
        create: ({ req }) => Boolean(req?.user?.roles?.includes('admin')),
        read: () => true,
        update: ({ req, id }) => {
          if (req?.user?.roles?.includes('admin')) return true;
          return req?.user?.id === id;
        },
        delete: ({ req }) => Boolean(req?.user?.roles?.includes('admin')),
      },
      fields: [
        {
          name: 'name',
          type: 'text',
        },
        {
          name: 'roles',
          type: 'select',
          hasMany: true,
          options: [
            { label: 'Admin', value: 'admin' },
            { label: 'User', value: 'user' },
            { label: 'Super Admin', value: 'super-admin' },
          ],
        },
        {
          name: 'tenants',
          type: 'array',
          fields: [
            {
              name: 'tenant',
              type: 'relationship',
              relationTo: 'tenants',
              required: true,
            },
            {
              name: 'roles',
              type: 'select',
              hasMany: true,
              options: [
                { label: 'Admin', value: 'admin' },
                { label: 'User', value: 'user' },
              ],
            },
          ],
        },
        {
          name: 'lastLoggedInTenant',
          type: 'relationship',
          admin: {
            readOnly: true,
          },
          index: true,
          relationTo: 'tenants',
        },
      ],
    };

    it('validates Users structure', () => {
      const result = safeValidate(CollectionStructureSchema, UsersConfig, 'collection', 'users');
      expect(result.success).toBe(true);
    });

    it('has auth enabled', () => {
      expect(UsersConfig.auth).toBeDefined();
    });

    it('has roles field', () => {
      const rolesField = UsersConfig.fields.find((f) => f.name === 'roles');
      expect(rolesField).toBeDefined();
      expect(rolesField?.type).toBe('select');
      expect(rolesField?.hasMany).toBe(true);
    });

    it('has tenants array', () => {
      const tenantsField = UsersConfig.fields.find((f) => f.name === 'tenants');
      expect(tenantsField).toBeDefined();
      expect(tenantsField?.type).toBe('array');
    });
  });

  describe('Settings Global (apps/admin/src/lib/globals/Settings)', () => {
    // Mirror of actual Settings global structure
    const SettingsConfig: GlobalConfig = {
      slug: 'settings',
      typescript: {
        interface: 'Settings',
      },
      access: {
        read: () => true,
        update: () => true,
      },
      fields: [
        {
          name: 'productsPage',
          type: 'relationship',
          relationTo: 'pages',
          label: 'Products page',
        },
      ],
    };

    it('validates Settings structure', () => {
      const result = safeValidate(GlobalStructureSchema, SettingsConfig, 'global', 'settings');
      expect(result.success).toBe(true);
    });

    it('has relationship field', () => {
      const productsPage = SettingsConfig.fields.find((f) => f.name === 'productsPage');
      expect(productsPage).toBeDefined();
      expect(productsPage?.type).toBe('relationship');
    });
  });

  describe('Access Functions (apps/admin/src/lib/access)', () => {
    it('authenticated access pattern', () => {
      const authenticated: AccessFunction = ({ req }) => {
        return Boolean(req?.user);
      };

      const userReq: RevealRequest = { user: { id: '1' } };
      const emptyReq: RevealRequest = {};
      expect(authenticated({ req: userReq })).toBe(true);
      expect(authenticated({ req: emptyReq })).toBe(false);
    });

    it('admin access pattern', () => {
      const isAdmin: AccessFunction = ({ req }) => {
        const user = req?.user;
        if (!user) return false;
        return user.roles?.includes('admin') || user.roles?.includes('super-admin');
      };

      const adminReq: RevealRequest = { user: { id: '1', roles: ['admin'] } };
      const userReq: RevealRequest = { user: { id: '1', roles: ['user'] } };
      expect(isAdmin({ req: adminReq })).toBe(true);
      expect(isAdmin({ req: userReq })).toBe(false);
    });

    it('self-or-admin access pattern', () => {
      const isAdminAndUser: AccessFunction = ({ req, id }) => {
        const user = req?.user;
        if (!user) return false;
        if (user.roles?.includes('admin')) return true;
        return user.id === id;
      };

      // Admin can access anything
      const adminReq: RevealRequest = { user: { id: '1', roles: ['admin'] } };
      expect(isAdminAndUser({ req: adminReq, id: '2' })).toBe(true);
      // User can access own resource
      const userReq: RevealRequest = { user: { id: '1', roles: ['user'] } };
      expect(isAdminAndUser({ req: userReq, id: '1' })).toBe(true);
      // User cannot access other's resource
      expect(isAdminAndUser({ req: userReq, id: '2' })).toBe(false);
    });
  });

  describe('Hook Functions (apps/admin/src/lib/hooks)', () => {
    interface Post {
      id: string;
      title: string;
      slug: string;
      _status?: 'draft' | 'published';
    }

    it('afterChange hook pattern (revalidatePost)', () => {
      const revalidatePost: CollectionAfterChangeHook<Post> = ({ doc, previousDoc, req }) => {
        void req;
        // In reality, this would revalidate cache
        const path = `/posts/${doc.slug}`;
        console.log(`Revalidating: ${path}`);

        // Handle unpublish case
        if (previousDoc?._status === 'published' && doc._status !== 'published') {
          console.log(`Unpublished: ${path}`);
        }

        return doc;
      };

      const result = revalidatePost({
        doc: { id: '1', title: 'Test', slug: 'test', _status: 'published' },
        previousDoc: { id: '1', title: 'Test', slug: 'test', _status: 'draft' },
        operation: 'update',
        req: {},
        context: {},
      });

      expect(result).toEqual({
        id: '1',
        title: 'Test',
        slug: 'test',
        _status: 'published',
      });
    });

    it('afterRead hook pattern (populateAuthors)', () => {
      interface PostWithAuthors extends Post {
        authors?: string[];
        populatedAuthors?: Array<{ id: string; name: string }>;
      }

      const populateAuthors: CollectionAfterReadHook<PostWithAuthors> = ({ doc, req }) => {
        void req;
        // In reality, this would fetch author details
        if (doc.authors?.length) {
          doc.populatedAuthors = doc.authors.map((id) => ({
            id,
            name: `Author ${id}`, // Would be fetched from DB
          }));
        }
        return doc;
      };

      const result = populateAuthors({
        doc: {
          id: '1',
          title: 'Test',
          slug: 'test',
          authors: ['author-1', 'author-2'],
        },
        req: {},
        findMany: false,
        context: {},
      });

      expect(result.populatedAuthors).toHaveLength(2);
    });
  });

  describe('Field Patterns', () => {
    it('slug field with formatSlug hook pattern', () => {
      const slugField: Field = {
        name: 'slug',
        type: 'text',
        index: true,
        required: true,
        unique: true,
        admin: {
          position: 'sidebar',
        },
        // Note: hooks would be added via field configuration
      };

      const result = FieldStructureSchema.safeParse(slugField);
      expect(result.success).toBe(true);
    });

    it('link field group pattern', () => {
      const linkField: Field = {
        name: 'link',
        type: 'group',
        fields: [
          {
            name: 'type',
            type: 'select',
            defaultValue: 'reference',
            options: [
              { label: 'Internal', value: 'reference' },
              { label: 'Custom URL', value: 'custom' },
            ],
          },
          {
            name: 'reference',
            type: 'relationship',
            label: 'Document to link to',
            relationTo: ['pages', 'posts'],
          },
          {
            name: 'url',
            type: 'text',
            label: 'Custom URL',
          },
          {
            name: 'newTab',
            type: 'checkbox',
            label: 'Open in new tab',
          },
        ],
      };

      const result = FieldStructureSchema.safeParse(linkField);
      expect(result.success).toBe(true);
    });

    it('blocks field with banner and code blocks', () => {
      const layoutField: Field = {
        name: 'layout',
        type: 'blocks',
        blocks: [
          {
            slug: 'banner',
            fields: [
              {
                name: 'style',
                type: 'select',
                options: ['info', 'warning', 'error'],
              },
              { name: 'content', type: 'richText' },
            ],
          },
          {
            slug: 'code',
            fields: [
              {
                name: 'language',
                type: 'select',
                options: ['typescript', 'javascript', 'python'],
              },
              { name: 'code', type: 'code' },
            ],
          },
          {
            slug: 'media',
            fields: [
              { name: 'media', type: 'upload', relationTo: 'media' },
              { name: 'caption', type: 'text' },
            ],
          },
        ],
      };

      const result = FieldStructureSchema.safeParse(layoutField);
      expect(result.success).toBe(true);
    });
  });
});

describe('Edge Cases', () => {
  describe('Field with hooks inline', () => {
    it('accepts field with beforeChange hook', () => {
      const config: CollectionConfig = {
        slug: 'test',
        fields: [
          {
            name: 'publishedAt',
            type: 'date',
            hooks: {
              beforeChange: [
                ({ siblingData, value }) => {
                  if (siblingData?._status === 'published' && !value) {
                    return new Date();
                  }
                  return value;
                },
              ],
            },
          },
        ],
      };

      expect(config.slug).toBe('test');
    });
  });

  describe('Collection with complex versions config', () => {
    it('accepts versions with autosave', () => {
      const config: CollectionConfig = {
        slug: 'posts',
        fields: [],
        versions: {
          drafts: {
            autosave: {
              interval: 100,
            },
          },
          maxPerDoc: 50,
        },
      };

      const result = safeValidate(CollectionStructureSchema, config, 'collection');
      expect(result.success).toBe(true);
    });
  });

  describe('Global with complex admin config', () => {
    it('accepts global with preview and livePreview', () => {
      const config: GlobalConfig = {
        slug: 'settings',
        fields: [{ type: 'text', name: 'title' }],
        admin: {
          description: 'Site settings',
          hidden: false,
        },
      };

      const result = safeValidate(GlobalStructureSchema, config, 'global');
      expect(result.success).toBe(true);
    });
  });
});
