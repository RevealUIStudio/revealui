import { describe, expect, it } from 'vitest';
import type { PopulateRelationshipField } from '../populate-core.js';
import {
  extractRelationInfo,
  shouldPopulateRelationship,
  updateDocumentWithPopulatedValue,
} from '../populate-core.js';

// ---------------------------------------------------------------------------
// Tests  -  extractRelationInfo
// ---------------------------------------------------------------------------
describe('extractRelationInfo', () => {
  const emptyReq = { revealui: { collections: {} } };

  describe('relationship fields', () => {
    it('extracts direct relationship info', () => {
      const field: PopulateRelationshipField = {
        type: 'relationship',
        name: 'author',
        relationTo: 'users',
      };
      const result = extractRelationInfo(field, 'user-1', emptyReq);

      expect(result.relationName).toBe('users');
      expect(result.id).toBe('user-1');
    });

    it('extracts polymorphic relationship info', () => {
      const field: PopulateRelationshipField = {
        type: 'relationship',
        name: 'ref',
        relationTo: ['pages', 'posts'],
      };
      const data = { relationTo: 'posts', value: 'post-1' };
      const result = extractRelationInfo(field, data, emptyReq);

      expect(result.relationName).toBe('posts');
      expect(result.id).toBe('post-1');
    });

    it('looks up related collection config', () => {
      const field: PopulateRelationshipField = {
        type: 'relationship',
        name: 'author',
        relationTo: 'users',
      };
      const req = {
        revealui: {
          collections: {
            users: { config: { slug: 'users', fields: [] } },
          },
        },
      };
      const result = extractRelationInfo(field, 'user-1', req);

      expect(result.relatedCollection).toEqual({ config: { slug: 'users', fields: [] } });
    });

    it('returns undefined collection when not found', () => {
      const field: PopulateRelationshipField = {
        type: 'relationship',
        name: 'author',
        relationTo: 'users',
      };
      const result = extractRelationInfo(field, 'user-1', emptyReq);

      expect(result.relatedCollection).toBeUndefined();
    });
  });

  describe('upload fields', () => {
    it('extracts upload field info', () => {
      const field: PopulateRelationshipField = {
        type: 'upload',
        name: 'image',
        relationTo: 'media',
      };
      const result = extractRelationInfo(field, 'media-1', emptyReq);

      expect(result.relationName).toBe('media');
      expect(result.id).toBe('media-1');
    });
  });

  describe('join fields', () => {
    it('extracts join field with single collection', () => {
      const field: PopulateRelationshipField = {
        type: 'join',
        name: 'tags',
        collection: 'tags',
      };
      const result = extractRelationInfo(field, 'tag-1', emptyReq);

      expect(result.relationName).toBe('tags');
      expect(result.id).toBe('tag-1');
    });

    it('extracts join field with polymorphic collection', () => {
      const field: PopulateRelationshipField = {
        type: 'join',
        name: 'ref',
        collection: ['pages', 'posts'],
      };
      const data = { relationTo: 'pages', value: 'page-1' };
      const result = extractRelationInfo(field, data, emptyReq);

      expect(result.relationName).toBe('pages');
      expect(result.id).toBe('page-1');
    });
  });

  describe('ID normalization', () => {
    it('passes string IDs through', () => {
      const field: PopulateRelationshipField = {
        type: 'relationship',
        name: 'author',
        relationTo: 'users',
      };
      const result = extractRelationInfo(field, 'string-id', emptyReq);

      expect(result.id).toBe('string-id');
    });

    it('passes number IDs through', () => {
      const field: PopulateRelationshipField = {
        type: 'relationship',
        name: 'author',
        relationTo: 'users',
      };
      const result = extractRelationInfo(field, 42, emptyReq);

      expect(result.id).toBe(42);
    });
  });
});

// ---------------------------------------------------------------------------
// Tests  -  shouldPopulateRelationship
// ---------------------------------------------------------------------------
describe('shouldPopulateRelationship', () => {
  it('returns true when depth > 0 and currentDepth <= depth', () => {
    expect(shouldPopulateRelationship(1, 2)).toBe(true);
    expect(shouldPopulateRelationship(2, 2)).toBe(true);
  });

  it('returns false when depth is 0', () => {
    expect(shouldPopulateRelationship(0, 0)).toBe(false);
  });

  it('returns false when currentDepth exceeds depth', () => {
    expect(shouldPopulateRelationship(3, 2)).toBe(false);
  });

  it('returns true at boundary (currentDepth === depth)', () => {
    expect(shouldPopulateRelationship(3, 3)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests  -  updateDocumentWithPopulatedValue
// ---------------------------------------------------------------------------
describe('updateDocumentWithPopulatedValue', () => {
  describe('single value (no index/key)', () => {
    it('sets direct relationship value', () => {
      const field: PopulateRelationshipField = {
        type: 'relationship',
        name: 'author',
        relationTo: 'users',
      };
      const dataReference: Record<string, unknown> = { author: 'user-1' };

      updateDocumentWithPopulatedValue({
        dataReference,
        field,
        relationshipValue: { id: 'user-1', name: 'John' },
        location: {},
      });

      expect(dataReference.author).toEqual({ id: 'user-1', name: 'John' });
    });

    it('sets polymorphic relationship value on .value', () => {
      const field: PopulateRelationshipField = {
        type: 'relationship',
        name: 'ref',
        relationTo: ['pages', 'posts'],
      };
      const dataReference: Record<string, unknown> = {
        ref: { relationTo: 'posts', value: 'post-1' },
      };

      updateDocumentWithPopulatedValue({
        dataReference,
        field,
        relationshipValue: { id: 'post-1', title: 'Hello' },
        location: {},
      });

      expect((dataReference.ref as Record<string, unknown>).value).toEqual({
        id: 'post-1',
        title: 'Hello',
      });
    });
  });

  describe('indexed values (array field)', () => {
    it('updates polymorphic array entry', () => {
      const field: PopulateRelationshipField = {
        type: 'relationship',
        name: 'refs',
        relationTo: ['pages', 'posts'],
        hasMany: true,
      };
      const dataReference: Record<string, unknown> = {
        refs: [
          { relationTo: 'pages', value: 'page-1' },
          { relationTo: 'posts', value: 'post-1' },
        ],
      };

      updateDocumentWithPopulatedValue({
        dataReference,
        field,
        relationshipValue: { id: 'post-1', title: 'Post' },
        location: { index: 1 },
      });

      const refs = dataReference.refs as Array<Record<string, unknown>>;
      expect(refs[1]!.value).toEqual({ id: 'post-1', title: 'Post' });
    });
  });

  describe('keyed values (localized field)', () => {
    it('updates localized field value', () => {
      const field: PopulateRelationshipField = {
        type: 'relationship',
        name: 'author',
        relationTo: 'users',
      };
      const dataReference: Record<string, unknown> = {
        author: { en: 'user-1', fr: 'user-2' },
      };

      updateDocumentWithPopulatedValue({
        dataReference,
        field,
        relationshipValue: { id: 'user-1', name: 'John' },
        location: { key: 'en' },
      });

      expect((dataReference.author as Record<string, unknown>).en).toEqual({
        id: 'user-1',
        name: 'John',
      });
    });
  });

  describe('localized array values (index + key)', () => {
    it('updates localized polymorphic array entry', () => {
      const field: PopulateRelationshipField = {
        type: 'relationship',
        name: 'refs',
        relationTo: ['pages', 'posts'],
        hasMany: true,
        localized: true,
      };
      const dataReference: Record<string, unknown> = {
        refs: {
          en: [{ relationTo: 'pages', value: 'page-1' }],
        },
      };

      updateDocumentWithPopulatedValue({
        dataReference,
        field,
        relationshipValue: { id: 'page-1', title: 'Page' },
        location: { index: 0, key: 'en' },
      });

      const refs = dataReference.refs as Record<string, Array<Record<string, unknown>>>;
      expect(refs.en[0]!.value).toEqual({ id: 'page-1', title: 'Page' });
    });

    it('replaces localized array entry for direct relationship', () => {
      const field: PopulateRelationshipField = {
        type: 'relationship',
        name: 'authors',
        relationTo: 'users',
        hasMany: true,
        localized: true,
      };
      const dataReference: Record<string, unknown> = {
        authors: {
          en: [{ id: 'user-1' }],
        },
      };

      updateDocumentWithPopulatedValue({
        dataReference,
        field,
        relationshipValue: { id: 'user-1', name: 'John' },
        location: { index: 0, key: 'en' },
      });

      const authors = dataReference.authors as Record<string, Array<Record<string, unknown>>>;
      expect(authors.en[0]).toEqual({ id: 'user-1', name: 'John' });
    });
  });

  describe('join fields', () => {
    it('updates join field docs array', () => {
      const field: PopulateRelationshipField = {
        type: 'join',
        name: 'categories',
        collection: 'categories',
      };
      const dataReference: Record<string, unknown> = {
        categories: { docs: [{ id: 'cat-1' }] },
      };

      updateDocumentWithPopulatedValue({
        dataReference,
        field,
        relationshipValue: { id: 'cat-1', name: 'Tech' },
        location: { index: 0 },
      });

      const cats = dataReference.categories as Record<string, Array<Record<string, unknown>>>;
      expect(cats.docs[0]).toEqual({ id: 'cat-1', name: 'Tech' });
    });

    it('updates polymorphic join field .value', () => {
      const field: PopulateRelationshipField = {
        type: 'join',
        name: 'refs',
        collection: ['pages', 'posts'],
      };
      const dataReference: Record<string, unknown> = {
        refs: { value: 'page-1' },
      };

      updateDocumentWithPopulatedValue({
        dataReference,
        field,
        relationshipValue: { id: 'page-1', title: 'Page' },
        location: {},
      });

      const refs = dataReference.refs as Record<string, unknown>;
      expect(refs.value).toEqual({ id: 'page-1', title: 'Page' });
    });
  });
});
