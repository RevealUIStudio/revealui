/**
 * Comprehensive tests for relationships/analyzer.ts
 *
 * Covers getRelationshipFields (edge cases) and validateRelationshipMetadata.
 */

import { describe, expect, it } from 'vitest';
import type { RelationshipMetadata } from '../../types/query.js';
import { getRelationshipFields, validateRelationshipMetadata } from '../analyzer.js';

// ---------------------------------------------------------------------------
// getRelationshipFields  -  edge cases not covered by existing tests
// ---------------------------------------------------------------------------

describe('getRelationshipFields', () => {
  it('should return empty array for config with no relationship fields', () => {
    const config = {
      slug: 'settings',
      fields: [
        { name: 'siteName', type: 'text' as const },
        { name: 'logo', type: 'text' as const },
      ],
    };

    const result = getRelationshipFields(config);
    expect(result).toEqual([]);
  });

  it('should return empty array for config with no fields', () => {
    const config = { slug: 'empty', fields: [] };

    const result = getRelationshipFields(config);
    expect(result).toEqual([]);
  });

  it('should use collectionSlug override when provided', () => {
    const config = {
      slug: 'originalSlug',
      fields: [{ name: 'author', type: 'relationship' as const, relationTo: 'users' }],
    };

    const result = getRelationshipFields(config, 'customSlug');

    expect(result).toHaveLength(1);
    expect(result[0]?.tableName).toBe('custom-slug');
  });

  it('should convert camelCase slugs to snake-case table names', () => {
    const config = {
      slug: 'blogPosts',
      fields: [{ name: 'author', type: 'relationship' as const, relationTo: 'users' }],
    };

    const result = getRelationshipFields(config);
    expect(result[0]?.tableName).toBe('blog-posts');
  });

  it('should handle upload fields as direct FK relationships', () => {
    const config = {
      slug: 'pages',
      fields: [{ name: 'heroImage', type: 'upload' as const, relationTo: 'media' }],
    };

    const result = getRelationshipFields(config);

    expect(result).toHaveLength(1);
    expect(result[0]?.storageType).toBe('direct_fk');
    expect(result[0]?.relationTo).toBe('media');
    expect(result[0]?.fkColumnName).toBe('heroImage_id');
  });

  it('should detect relationships inside blocks', () => {
    const config = {
      slug: 'pages',
      fields: [
        {
          name: 'content',
          type: 'blocks' as const,
          blocks: [
            {
              slug: 'cta',
              fields: [{ name: 'link', type: 'relationship' as const, relationTo: 'pages' }],
            },
          ],
        },
      ],
    };

    const result = getRelationshipFields(config);

    expect(result).toHaveLength(1);
    expect(result[0]?.path).toBe('content.cta.link');
    expect(result[0]?.storageType).toBe('direct_fk');
  });

  it('should handle blocks without slug, defaulting to "block"', () => {
    const config = {
      slug: 'pages',
      fields: [
        {
          name: 'layout',
          type: 'blocks' as const,
          blocks: [
            {
              fields: [{ name: 'ref', type: 'relationship' as const, relationTo: 'media' }],
            },
          ],
        },
      ],
    };

    const result = getRelationshipFields(config);

    expect(result).toHaveLength(1);
    expect(result[0]?.path).toBe('layout.block.ref');
  });

  it('should handle deeply nested fields (group > array > relationship)', () => {
    const config = {
      slug: 'products',
      fields: [
        {
          name: 'details',
          type: 'group' as const,
          fields: [
            {
              name: 'images',
              type: 'array' as const,
              fields: [{ name: 'file', type: 'upload' as const, relationTo: 'media' }],
            },
          ],
        },
      ],
    };

    const result = getRelationshipFields(config);

    expect(result).toHaveLength(1);
    expect(result[0]?.path).toBe('details.images.file');
  });

  it('should propagate localized flag from parent to nested fields', () => {
    const config = {
      slug: 'posts',
      fields: [
        {
          name: 'localizedGroup',
          type: 'group' as const,
          localized: true,
          fields: [{ name: 'author', type: 'relationship' as const, relationTo: 'users' }],
        },
      ],
    };

    const result = getRelationshipFields(config);

    expect(result).toHaveLength(1);
    expect(result[0]?.localized).toBe(true);
  });

  it('should mark localized field correctly', () => {
    const config = {
      slug: 'posts',
      fields: [
        {
          name: 'localAuthor',
          type: 'relationship' as const,
          relationTo: 'users',
          localized: true,
        },
      ],
    };

    const result = getRelationshipFields(config);

    expect(result).toHaveLength(1);
    expect(result[0]?.localized).toBe(true);
  });

  it('should skip non-relationship field types entirely', () => {
    const config = {
      slug: 'posts',
      fields: [
        { name: 'title', type: 'text' as const },
        { name: 'body', type: 'richText' as const },
        { name: 'count', type: 'number' as const },
        { name: 'isPublished', type: 'checkbox' as const },
        { name: 'tags', type: 'select' as const, options: ['a', 'b'] },
      ],
    };

    const result = getRelationshipFields(config);
    expect(result).toEqual([]);
  });

  it('should correctly identify polymorphic relationships with array relationTo', () => {
    const config = {
      slug: 'links',
      fields: [
        {
          name: 'target',
          type: 'relationship' as const,
          relationTo: ['posts', 'pages', 'products'],
        },
      ],
    };

    const result = getRelationshipFields(config);

    expect(result).toHaveLength(1);
    expect(result[0]?.storageType).toBe('polymorphic');
    expect(result[0]?.tableName).toBe('links_rels');
    expect(result[0]?.fkColumnName).toBeUndefined();
  });

  it('should assign junction_table storage for hasMany with single relationTo', () => {
    const config = {
      slug: 'posts',
      fields: [
        {
          name: 'tags',
          type: 'relationship' as const,
          relationTo: 'tags',
          hasMany: true,
        },
      ],
    };

    const result = getRelationshipFields(config);

    expect(result).toHaveLength(1);
    expect(result[0]?.storageType).toBe('junction_table');
    expect(result[0]?.tableName).toBe('posts_rels');
    expect(result[0]?.fkColumnName).toBeUndefined();
  });

  it('should default hasMany to false when not specified', () => {
    const config = {
      slug: 'posts',
      fields: [{ name: 'author', type: 'relationship' as const, relationTo: 'users' }],
    };

    const result = getRelationshipFields(config);

    expect(result[0]?.hasMany).toBe(false);
  });

  it('should set default maxDepth and depth to 1', () => {
    const config = {
      slug: 'posts',
      fields: [{ name: 'author', type: 'relationship' as const, relationTo: 'users' }],
    };

    const result = getRelationshipFields(config);

    expect(result[0]?.maxDepth).toBe(1);
    expect(result[0]?.depth).toBe(1);
  });

  it('should handle fields without a name gracefully', () => {
    const config = {
      slug: 'posts',
      fields: [
        { type: 'ui' as const },
        { name: 'author', type: 'relationship' as const, relationTo: 'users' },
      ],
    };

    const result = getRelationshipFields(config);

    // Should still find the author relationship
    expect(result).toHaveLength(1);
    expect(result[0]?.fieldName).toBe('author');
  });

  it('should handle multiple blocks with relationships', () => {
    const config = {
      slug: 'pages',
      fields: [
        {
          name: 'layout',
          type: 'blocks' as const,
          blocks: [
            {
              slug: 'hero',
              fields: [{ name: 'image', type: 'upload' as const, relationTo: 'media' }],
            },
            {
              slug: 'gallery',
              fields: [
                {
                  name: 'photos',
                  type: 'relationship' as const,
                  relationTo: 'media',
                  hasMany: true,
                },
              ],
            },
          ],
        },
      ],
    };

    const result = getRelationshipFields(config);

    expect(result).toHaveLength(2);
    expect(result[0]?.path).toBe('layout.hero.image');
    expect(result[1]?.path).toBe('layout.gallery.photos');
  });
});

// ---------------------------------------------------------------------------
// validateRelationshipMetadata
// ---------------------------------------------------------------------------

describe('validateRelationshipMetadata', () => {
  it('should return valid for correct metadata', () => {
    const metadata: RelationshipMetadata[] = [
      {
        fieldName: 'author',
        path: 'author',
        storageType: 'direct_fk',
        relationTo: 'users',
        hasMany: false,
        localized: false,
        tableName: 'posts',
        fkColumnName: 'author_id',
        maxDepth: 1,
        depth: 1,
      },
    ];

    const result = validateRelationshipMetadata(metadata);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('should return valid for empty metadata array', () => {
    const result = validateRelationshipMetadata([]);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('should detect polymorphic relationship without array relationTo', () => {
    const metadata: RelationshipMetadata[] = [
      {
        fieldName: 'ref',
        path: 'ref',
        storageType: 'polymorphic',
        relationTo: 'posts', // Should be an array for polymorphic
        hasMany: false,
        localized: false,
        tableName: 'pages_rels',
        maxDepth: 1,
        depth: 1,
      },
    ];

    const result = validateRelationshipMetadata(metadata);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual('Polymorphic relationship ref must have array relationTo');
  });

  it('should detect direct_fk with hasMany=true', () => {
    const metadata: RelationshipMetadata[] = [
      {
        fieldName: 'tags',
        path: 'tags',
        storageType: 'direct_fk',
        relationTo: 'tags',
        hasMany: true, // Invalid for direct_fk
        localized: false,
        tableName: 'posts',
        fkColumnName: 'tags_id',
        maxDepth: 1,
        depth: 1,
      },
    ];

    const result = validateRelationshipMetadata(metadata);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual('Direct FK relationship tags cannot have hasMany=true');
  });

  it('should detect non-direct-FK with fkColumnName set', () => {
    const metadata: RelationshipMetadata[] = [
      {
        fieldName: 'categories',
        path: 'categories',
        storageType: 'junction_table',
        relationTo: 'categories',
        hasMany: true,
        localized: false,
        tableName: 'posts_rels',
        fkColumnName: 'categories_id', // Should not exist for junction table
        maxDepth: 1,
        depth: 1,
      },
    ];

    const result = validateRelationshipMetadata(metadata);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      'Non-direct-FK relationship categories should not have fkColumnName',
    );
  });

  it('should detect direct_fk with _rels table name', () => {
    const metadata: RelationshipMetadata[] = [
      {
        fieldName: 'author',
        path: 'author',
        storageType: 'direct_fk',
        relationTo: 'users',
        hasMany: false,
        localized: false,
        tableName: 'posts_rels', // Wrong table for direct_fk
        fkColumnName: 'author_id',
        maxDepth: 1,
        depth: 1,
      },
    ];

    const result = validateRelationshipMetadata(metadata);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      'Direct FK relationship author should not use _rels table',
    );
  });

  it('should detect junction_table without _rels table name', () => {
    const metadata: RelationshipMetadata[] = [
      {
        fieldName: 'tags',
        path: 'tags',
        storageType: 'junction_table',
        relationTo: 'tags',
        hasMany: true,
        localized: false,
        tableName: 'posts', // Should be posts_rels
        maxDepth: 1,
        depth: 1,
      },
    ];

    const result = validateRelationshipMetadata(metadata);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual('Junction table relationship tags should use _rels table');
  });

  it('should detect polymorphic without _rels table name', () => {
    const metadata: RelationshipMetadata[] = [
      {
        fieldName: 'refs',
        path: 'refs',
        storageType: 'polymorphic',
        relationTo: ['posts', 'pages'],
        hasMany: true,
        localized: false,
        tableName: 'links', // Should be links_rels
        maxDepth: 1,
        depth: 1,
      },
    ];

    const result = validateRelationshipMetadata(metadata);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual('Junction table relationship refs should use _rels table');
  });

  it('should collect multiple errors from a single metadata entry', () => {
    const metadata: RelationshipMetadata[] = [
      {
        fieldName: 'broken',
        path: 'broken',
        storageType: 'direct_fk',
        relationTo: 'things',
        hasMany: true, // Error 1
        localized: false,
        tableName: 'stuff_rels', // Error 2
        fkColumnName: 'broken_id',
        maxDepth: 1,
        depth: 1,
      },
    ];

    const result = validateRelationshipMetadata(metadata);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('should validate multiple metadata entries independently', () => {
    const metadata: RelationshipMetadata[] = [
      {
        fieldName: 'author',
        path: 'author',
        storageType: 'direct_fk',
        relationTo: 'users',
        hasMany: false,
        localized: false,
        tableName: 'posts',
        fkColumnName: 'author_id',
        maxDepth: 1,
        depth: 1,
      },
      {
        fieldName: 'badRef',
        path: 'badRef',
        storageType: 'polymorphic',
        relationTo: 'single', // Should be array
        hasMany: false,
        localized: false,
        tableName: 'posts_rels',
        maxDepth: 1,
        depth: 1,
      },
    ];

    const result = validateRelationshipMetadata(metadata);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('badRef');
  });

  it('should accept valid junction_table metadata', () => {
    const metadata: RelationshipMetadata[] = [
      {
        fieldName: 'tags',
        path: 'tags',
        storageType: 'junction_table',
        relationTo: 'tags',
        hasMany: true,
        localized: false,
        tableName: 'posts_rels',
        maxDepth: 1,
        depth: 1,
      },
    ];

    const result = validateRelationshipMetadata(metadata);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('should accept valid polymorphic metadata', () => {
    const metadata: RelationshipMetadata[] = [
      {
        fieldName: 'relatedContent',
        path: 'relatedContent',
        storageType: 'polymorphic',
        relationTo: ['posts', 'pages'],
        hasMany: true,
        localized: false,
        tableName: 'pages_rels',
        maxDepth: 1,
        depth: 1,
      },
    ];

    const result = validateRelationshipMetadata(metadata);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});
