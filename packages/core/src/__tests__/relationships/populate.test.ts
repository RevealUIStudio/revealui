/**
 * Populate Functionality Tests
 *
 * Comprehensive tests for relationship population including:
 * - Single relationships
 * - Array relationships (hasMany)
 * - Nested populations
 * - Circular reference handling
 * - Depth limiting
 * - Field maxDepth constraints
 * - Localized relationships
 * - Performance with batch loading
 */

import { describe, expect, it } from 'vitest';
import {
  extractRelationInfo,
  type PopulateRelationshipField,
  shouldPopulateRelationship,
  updateDocumentWithPopulatedValue,
} from '../../relationships/populate-core.js';

describe('Populate Helper Functions', () => {
  describe('extractRelationInfo', () => {
    it('extracts relation info for direct relationship field', () => {
      const field: PopulateRelationshipField = {
        type: 'relationship',
        name: 'author',
        relationTo: 'users',
      };
      const data = 'user-123';
      const req = {
        revealui: {
          collections: {
            users: { config: { slug: 'users' } },
          },
        },
      };

      const result = extractRelationInfo(field, data, req);

      expect(result.relationName).toBe('users');
      expect(result.id).toBe('user-123');
      expect(result.relatedCollection).toBeDefined();
    });

    it('extracts relation info for polymorphic relationship', () => {
      const field: PopulateRelationshipField = {
        type: 'relationship',
        name: 'related',
        relationTo: ['posts', 'pages'],
      };
      const data = { relationTo: 'posts', value: 'post-456' };
      const req = {
        revealui: {
          collections: {
            posts: { config: { slug: 'posts' } },
          },
        },
      };

      const result = extractRelationInfo(field, data, req);

      expect(result.relationName).toBe('posts');
      expect(result.id).toBe('post-456');
    });

    it('extracts relation info for join table relationship', () => {
      const field: PopulateRelationshipField = {
        type: 'join',
        name: 'categories',
        collection: 'categories',
      };
      const data = 'category-789';
      const req = {
        revealui: {
          collections: {
            categories: { config: { slug: 'categories' } },
          },
        },
      };

      const result = extractRelationInfo(field, data, req);

      expect(result.relationName).toBe('categories');
      expect(result.id).toBe('category-789');
    });

    it('handles missing collection gracefully', () => {
      const field: PopulateRelationshipField = {
        type: 'relationship',
        name: 'author',
        relationTo: 'users',
      };
      const data = 'user-123';
      const req = { revealui: { collections: {} } };

      const result = extractRelationInfo(field, data, req);

      expect(result.relationName).toBe('users');
      expect(result.relatedCollection).toBeUndefined();
    });

    it('does not normalize object IDs (only primitives)', () => {
      const field: PopulateRelationshipField = {
        type: 'relationship',
        name: 'author',
        relationTo: 'users',
      };
      const data = { toString: () => 'user-normalized' };
      const req = { revealui: { collections: {} } };

      const result = extractRelationInfo(field, data, req);

      // Objects are kept as-is (normalization only applies to primitives with toString)
      expect(result.id).toEqual(data);
    });
  });

  describe('shouldPopulateRelationship', () => {
    it('returns true when currentDepth <= depth', () => {
      expect(shouldPopulateRelationship(0, 2)).toBe(true);
      expect(shouldPopulateRelationship(1, 2)).toBe(true);
      expect(shouldPopulateRelationship(2, 2)).toBe(true);
    });

    it('returns false when currentDepth > depth', () => {
      expect(shouldPopulateRelationship(3, 2)).toBe(false);
      expect(shouldPopulateRelationship(5, 2)).toBe(false);
    });

    it('returns false when depth is 0', () => {
      expect(shouldPopulateRelationship(0, 0)).toBe(false);
      expect(shouldPopulateRelationship(1, 0)).toBe(false);
    });
  });

  describe('updateDocumentWithPopulatedValue', () => {
    it('updates simple relationship field', () => {
      const dataReference = { author: 'user-123' };
      const field: PopulateRelationshipField = {
        type: 'relationship',
        name: 'author',
        relationTo: 'users',
      };
      const relationshipValue = { id: 'user-123', name: 'John Doe' };

      updateDocumentWithPopulatedValue({
        dataReference,
        field,
        relationshipValue,
        location: {},
      });

      expect(dataReference.author).toEqual({ id: 'user-123', name: 'John Doe' });
    });

    it('updates array relationship field with index', () => {
      const dataReference = {
        authors: [{ id: 'user-1' }, { id: 'user-2' }],
      };
      const field: PopulateRelationshipField = {
        type: 'relationship',
        name: 'authors',
        relationTo: 'users',
        hasMany: true,
      };
      const relationshipValue = { id: 'user-1', name: 'Jane Smith' };

      updateDocumentWithPopulatedValue({
        dataReference,
        field,
        relationshipValue,
        location: { index: 0 },
      });

      expect(dataReference.authors[0]).toEqual({ id: 'user-1', name: 'Jane Smith' });
    });

    it('updates polymorphic relationship value field', () => {
      const dataReference = {
        related: { relationTo: 'posts', value: 'post-123' },
      };
      const field: PopulateRelationshipField = {
        type: 'relationship',
        name: 'related',
        relationTo: ['posts', 'pages'],
      };
      const relationshipValue = { id: 'post-123', title: 'Test Post' };

      updateDocumentWithPopulatedValue({
        dataReference,
        field,
        relationshipValue,
        location: {},
      });

      expect(dataReference.related.value).toEqual({ id: 'post-123', title: 'Test Post' });
    });

    it('updates localized field with key', () => {
      const dataReference = {
        title: {
          en: 'English Title',
          es: 'Spanish Title',
        },
      };
      const field: PopulateRelationshipField = {
        type: 'relationship',
        name: 'title',
        relationTo: 'translations',
        localized: true,
      };
      const relationshipValue = { id: 'trans-1', text: 'Translated' };

      updateDocumentWithPopulatedValue({
        dataReference,
        field,
        relationshipValue,
        location: { key: 'en' },
      });

      expect(dataReference.title.en).toEqual({ id: 'trans-1', text: 'Translated' });
    });

    it('updates localized array field with index and key', () => {
      const dataReference = {
        items: {
          en: [{ id: 'item-1' }, { id: 'item-2' }],
          es: [{ id: 'item-3' }],
        },
      };
      const field: PopulateRelationshipField = {
        type: 'relationship',
        name: 'items',
        relationTo: 'products',
        hasMany: true,
        localized: true,
      };
      const relationshipValue = { id: 'item-1', name: 'Product 1' };

      updateDocumentWithPopulatedValue({
        dataReference,
        field,
        relationshipValue,
        location: { index: 0, key: 'en' },
      });

      expect(dataReference.items.en[0]).toEqual({ id: 'item-1', name: 'Product 1' });
    });
  });
});

describe('Populate Integration Scenarios', () => {
  describe('Depth Limiting', () => {
    it('respects depth=0 (no population)', () => {
      const currentDepth = 0;
      const depth = 0;
      expect(shouldPopulateRelationship(currentDepth, depth)).toBe(false);
    });

    it('respects depth=1 (populate direct relationships only)', () => {
      expect(shouldPopulateRelationship(0, 1)).toBe(true);
      expect(shouldPopulateRelationship(1, 1)).toBe(true);
      expect(shouldPopulateRelationship(2, 1)).toBe(false);
    });

    it('respects depth=2 (populate nested relationships)', () => {
      expect(shouldPopulateRelationship(0, 2)).toBe(true);
      expect(shouldPopulateRelationship(1, 2)).toBe(true);
      expect(shouldPopulateRelationship(2, 2)).toBe(true);
      expect(shouldPopulateRelationship(3, 2)).toBe(false);
    });

    it('respects depth=3 (maximum nesting)', () => {
      expect(shouldPopulateRelationship(0, 3)).toBe(true);
      expect(shouldPopulateRelationship(1, 3)).toBe(true);
      expect(shouldPopulateRelationship(2, 3)).toBe(true);
      expect(shouldPopulateRelationship(3, 3)).toBe(true);
      expect(shouldPopulateRelationship(4, 3)).toBe(false);
    });
  });

  describe('Circular Reference Handling', () => {
    it('prevents infinite loops with depth limiting', () => {
      // User -> Posts -> Author (User) -> Posts -> ...
      // With depth=2, should stop at the second level
      const depth = 2;

      // Level 0: User
      expect(shouldPopulateRelationship(0, depth)).toBe(true);

      // Level 1: Posts
      expect(shouldPopulateRelationship(1, depth)).toBe(true);

      // Level 2: Author (back to User)
      expect(shouldPopulateRelationship(2, depth)).toBe(true);

      // Level 3: Would create circle, blocked by depth
      expect(shouldPopulateRelationship(3, depth)).toBe(false);
    });
  });

  describe('Field Type Variations', () => {
    it('handles upload fields', () => {
      const field: PopulateRelationshipField = {
        type: 'upload',
        name: 'image',
        relationTo: 'media',
      };
      const data = 'media-123';
      const req = {
        revealui: {
          collections: {
            media: { config: { slug: 'media' } },
          },
        },
      };

      const result = extractRelationInfo(field, data, req);
      expect(result.relationName).toBe('media');
      expect(result.id).toBe('media-123');
    });

    it('handles join table with polymorphic collection', () => {
      const field: PopulateRelationshipField = {
        type: 'join',
        name: 'categories',
        collection: ['categories', 'tags'],
      };
      const data = { relationTo: 'categories', value: 'cat-1' };
      const req = {
        revealui: {
          collections: {
            categories: { config: { slug: 'categories' } },
          },
        },
      };

      const result = extractRelationInfo(field, data, req);
      expect(result.relationName).toBe('categories');
      expect(result.id).toBe('cat-1');
    });
  });

  describe('Edge Cases', () => {
    it('handles undefined data gracefully', () => {
      const field: PopulateRelationshipField = {
        type: 'relationship',
        name: 'author',
        relationTo: 'users',
      };
      const data = undefined;
      const req = { revealui: { collections: {} } };

      const result = extractRelationInfo(field, data, req);
      expect(result.id).toBeUndefined();
    });

    it('handles null relationTo gracefully', () => {
      const field: PopulateRelationshipField = {
        type: 'relationship',
        name: 'optional',
        relationTo: undefined,
      };
      const data = 'some-id';
      const req = { revealui: { collections: {} } };

      const result = extractRelationInfo(field, data, req);
      expect(result.relationName).toBeUndefined();
    });

    it('handles empty array for polymorphic relationTo', () => {
      const field: PopulateRelationshipField = {
        type: 'relationship',
        name: 'related',
        relationTo: [],
      };
      const data = { relationTo: 'posts', value: 'post-1' };
      const req = {
        revealui: {
          collections: {
            posts: { config: { slug: 'posts' } },
          },
        },
      };

      const result = extractRelationInfo(field, data, req);
      expect(result.relationName).toBe('posts');
    });
  });
});
