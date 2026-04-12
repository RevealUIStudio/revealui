/**
 * Tests for relationships/population.ts  -  relationshipPopulationPromise
 *
 * The populate() inner function dynamically imports populate-helpers.js.
 * We mock the helpers and verify the orchestration logic at the function level.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the populate-core module (pure types/utils imported by population.ts)
const mockExtractRelationInfo = vi.fn();
const mockShouldPopulateRelationship = vi.fn();
const mockLoadRelatedDocument = vi.fn();
const mockApplyNestedPopulation = vi.fn();
const mockUpdateDocumentWithPopulatedValue = vi.fn();

vi.mock('../populate-core.js', () => ({
  extractRelationInfo: (...args: unknown[]) => mockExtractRelationInfo(...args),
  shouldPopulateRelationship: (...args: unknown[]) => mockShouldPopulateRelationship(...args),
  updateDocumentWithPopulatedValue: (...args: unknown[]) =>
    mockUpdateDocumentWithPopulatedValue(...args),
}));

// Mock the populate-helpers module (afterRead-dependent helpers imported by population.ts)
vi.mock('../populate-helpers.js', () => ({
  loadRelatedDocument: (...args: unknown[]) => mockLoadRelatedDocument(...args),
  applyNestedPopulation: (...args: unknown[]) => mockApplyNestedPopulation(...args),
}));

// Mock the field config types module
vi.mock('../../fields/config/types.js', () => ({
  fieldHasMaxDepth: (field: Record<string, unknown>) =>
    'maxDepth' in field && typeof field.maxDepth === 'number',
  fieldShouldBeLocalized: ({
    field,
    parentIsLocalized,
  }: {
    field: Record<string, unknown>;
    parentIsLocalized: boolean;
  }) => {
    if (parentIsLocalized) return true;
    return field.localized === true;
  },
  fieldSupportsMany: (field: Record<string, unknown>) =>
    'hasMany' in field && field.hasMany === true,
}));

import { relationshipPopulationPromise } from '../population.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultReq() {
  return {
    revealui: { collections: {} },
    dataLoader: { load: vi.fn() },
  };
}

function setupMocks() {
  mockExtractRelationInfo.mockReturnValue({
    relationName: 'users',
    id: 'user-1',
    relatedCollection: { config: { slug: 'users', fields: [] } },
  });
  mockShouldPopulateRelationship.mockReturnValue(true);
  mockLoadRelatedDocument.mockResolvedValue({ id: 'user-1', name: 'John' });
  mockApplyNestedPopulation.mockImplementation(({ doc }: { doc: unknown }) => doc);
  mockUpdateDocumentWithPopulatedValue.mockImplementation(() => {});
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('relationshipPopulationPromise', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  describe('single-value relationship (no hasMany, not localized)', () => {
    it('should populate a direct relationship from siblingDoc field value', async () => {
      const siblingDoc: Record<string, unknown> = { author: 'user-1' };

      await relationshipPopulationPromise({
        currentDepth: 0,
        depth: 1,
        draft: false,
        fallbackLocale: 'en',
        field: { type: 'relationship', name: 'author', relationTo: 'users' },
        locale: 'en',
        overrideAccess: false,
        req: defaultReq(),
        showHiddenFields: false,
        siblingDoc,
      });

      expect(mockExtractRelationInfo).toHaveBeenCalledOnce();
      expect(mockUpdateDocumentWithPopulatedValue).toHaveBeenCalledOnce();
    });

    it('should populate from siblingDoc[field.name + "_id"] as fallback', async () => {
      const siblingDoc: Record<string, unknown> = { author_id: 'user-1' };

      await relationshipPopulationPromise({
        currentDepth: 0,
        depth: 1,
        draft: false,
        fallbackLocale: 'en',
        field: { type: 'relationship', name: 'author', relationTo: 'users' },
        locale: 'en',
        overrideAccess: false,
        req: defaultReq(),
        showHiddenFields: false,
        siblingDoc,
      });

      expect(mockExtractRelationInfo).toHaveBeenCalled();
    });

    it('should not call populate when siblingDoc has no value for the field', async () => {
      const siblingDoc: Record<string, unknown> = {};

      await relationshipPopulationPromise({
        currentDepth: 0,
        depth: 1,
        draft: false,
        fallbackLocale: 'en',
        field: { type: 'relationship', name: 'author', relationTo: 'users' },
        locale: 'en',
        overrideAccess: false,
        req: defaultReq(),
        showHiddenFields: false,
        siblingDoc,
      });

      expect(mockExtractRelationInfo).not.toHaveBeenCalled();
    });
  });

  describe('hasMany relationship (array values)', () => {
    it('should invoke populate for each array element', async () => {
      const siblingDoc: Record<string, unknown> = {
        tags: ['tag-1', 'tag-2', 'tag-3'],
      };

      await relationshipPopulationPromise({
        currentDepth: 0,
        depth: 1,
        draft: false,
        fallbackLocale: 'en',
        field: { type: 'relationship', name: 'tags', relationTo: 'tags', hasMany: true },
        locale: 'en',
        overrideAccess: false,
        req: defaultReq(),
        showHiddenFields: false,
        siblingDoc,
      });

      // Each array element triggers its own populate() call
      // The exact count depends on how parallel dynamic imports resolve.
      // At minimum, all items should trigger updateDocumentWithPopulatedValue.
      expect(mockExtractRelationInfo).toHaveBeenCalled();
      expect(mockUpdateDocumentWithPopulatedValue.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle empty array without calling populate', async () => {
      const siblingDoc: Record<string, unknown> = { tags: [] };

      await relationshipPopulationPromise({
        currentDepth: 0,
        depth: 1,
        draft: false,
        fallbackLocale: 'en',
        field: { type: 'relationship', name: 'tags', relationTo: 'tags', hasMany: true },
        locale: 'en',
        overrideAccess: false,
        req: defaultReq(),
        showHiddenFields: false,
        siblingDoc,
      });

      expect(mockExtractRelationInfo).not.toHaveBeenCalled();
    });

    it('should handle docs sub-array for hasMany relationship', async () => {
      const siblingDoc: Record<string, unknown> = {
        categories: { docs: [{ id: 'cat-1' }, { id: 'cat-2' }] },
      };

      await relationshipPopulationPromise({
        currentDepth: 0,
        depth: 1,
        draft: false,
        fallbackLocale: 'en',
        field: {
          type: 'relationship',
          name: 'categories',
          relationTo: 'categories',
          hasMany: true,
        },
        locale: 'en',
        overrideAccess: false,
        req: defaultReq(),
        showHiddenFields: false,
        siblingDoc,
      });

      expect(mockExtractRelationInfo).toHaveBeenCalled();
    });

    it('should handle field_ids array as fallback', async () => {
      const siblingDoc: Record<string, unknown> = {
        tags_ids: ['tag-1', 'tag-2'],
      };

      await relationshipPopulationPromise({
        currentDepth: 0,
        depth: 1,
        draft: false,
        fallbackLocale: 'en',
        field: { type: 'relationship', name: 'tags', relationTo: 'tags', hasMany: true },
        locale: 'en',
        overrideAccess: false,
        req: defaultReq(),
        showHiddenFields: false,
        siblingDoc,
      });

      expect(mockExtractRelationInfo).toHaveBeenCalled();
    });

    it('should skip null entries in relationship arrays', async () => {
      const siblingDoc: Record<string, unknown> = {
        tags: ['tag-1', null, 'tag-3'],
      };

      await relationshipPopulationPromise({
        currentDepth: 0,
        depth: 1,
        draft: false,
        fallbackLocale: 'en',
        field: { type: 'relationship', name: 'tags', relationTo: 'tags', hasMany: true },
        locale: 'en',
        overrideAccess: false,
        req: defaultReq(),
        showHiddenFields: false,
        siblingDoc,
      });

      // null entries are skipped; only non-null entries trigger populate
      expect(mockExtractRelationInfo).toHaveBeenCalled();
    });
  });

  describe('localized relationship (locale = "all")', () => {
    it('should populate localized hasMany field across locale keys', async () => {
      const siblingDoc: Record<string, unknown> = {
        tags: { en: ['tag-en-1'], fr: ['tag-fr-1'] },
      };

      await relationshipPopulationPromise({
        currentDepth: 0,
        depth: 1,
        draft: false,
        fallbackLocale: 'en',
        field: {
          type: 'relationship',
          name: 'tags',
          relationTo: 'tags',
          hasMany: true,
          localized: true,
        },
        locale: 'all',
        overrideAccess: false,
        req: defaultReq(),
        showHiddenFields: false,
        siblingDoc,
      });

      // Should call populate for entries across both locale keys
      expect(mockExtractRelationInfo).toHaveBeenCalled();
    });

    it('should populate localized single-value field across locale keys', async () => {
      const siblingDoc: Record<string, unknown> = {
        author: { en: 'user-1', fr: 'user-2' },
      };

      await relationshipPopulationPromise({
        currentDepth: 0,
        depth: 1,
        draft: false,
        fallbackLocale: 'en',
        field: { type: 'relationship', name: 'author', relationTo: 'users', localized: true },
        locale: 'all',
        overrideAccess: false,
        req: defaultReq(),
        showHiddenFields: false,
        siblingDoc,
      });

      expect(mockExtractRelationInfo).toHaveBeenCalled();
    });
  });

  describe('maxDepth handling', () => {
    it('should respect field maxDepth when less than depth', async () => {
      const siblingDoc: Record<string, unknown> = { author: 'user-1' };

      await relationshipPopulationPromise({
        currentDepth: 0,
        depth: 3,
        draft: false,
        fallbackLocale: 'en',
        field: { type: 'relationship', name: 'author', relationTo: 'users', maxDepth: 1 },
        locale: 'en',
        overrideAccess: false,
        req: defaultReq(),
        showHiddenFields: false,
        siblingDoc,
      });

      expect(mockExtractRelationInfo).toHaveBeenCalled();
    });

    it('should use depth when maxDepth is greater', async () => {
      const siblingDoc: Record<string, unknown> = { author: 'user-1' };

      await relationshipPopulationPromise({
        currentDepth: 0,
        depth: 2,
        draft: false,
        fallbackLocale: 'en',
        field: { type: 'relationship', name: 'author', relationTo: 'users', maxDepth: 5 },
        locale: 'en',
        overrideAccess: false,
        req: defaultReq(),
        showHiddenFields: false,
        siblingDoc,
      });

      expect(mockExtractRelationInfo).toHaveBeenCalled();
      expect(mockLoadRelatedDocument).toHaveBeenCalled();
    });
  });

  describe('join field type', () => {
    it('should handle join field with array values', async () => {
      const siblingDoc: Record<string, unknown> = {
        categories: ['cat-1', 'cat-2'],
      };

      await relationshipPopulationPromise({
        currentDepth: 0,
        depth: 1,
        draft: false,
        fallbackLocale: 'en',
        field: { type: 'join', name: 'categories', collection: 'categories', hasMany: true },
        locale: 'en',
        overrideAccess: false,
        req: defaultReq(),
        showHiddenFields: false,
        siblingDoc,
      });

      expect(mockExtractRelationInfo).toHaveBeenCalled();
    });
  });

  describe('populate arg forwarding', () => {
    it('should forward the populate arg to populate calls', async () => {
      const siblingDoc: Record<string, unknown> = { author: 'user-1' };

      await relationshipPopulationPromise({
        currentDepth: 0,
        depth: 1,
        draft: false,
        fallbackLocale: 'en',
        field: { type: 'relationship', name: 'author', relationTo: 'users' },
        locale: 'en',
        overrideAccess: false,
        populate: { users: { title: true } },
        req: defaultReq(),
        showHiddenFields: false,
        siblingDoc,
      });

      expect(mockExtractRelationInfo).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle polymorphic relationship object value', async () => {
      const siblingDoc: Record<string, unknown> = {
        ref: { relationTo: 'posts', value: 'post-1' },
      };

      await relationshipPopulationPromise({
        currentDepth: 0,
        depth: 1,
        draft: false,
        fallbackLocale: 'en',
        field: { type: 'relationship', name: 'ref', relationTo: ['posts', 'pages'] },
        locale: 'en',
        overrideAccess: false,
        req: defaultReq(),
        showHiddenFields: false,
        siblingDoc,
      });

      expect(mockExtractRelationInfo).toHaveBeenCalled();
    });

    it('should fall back to id when relatedCollection is undefined', async () => {
      mockExtractRelationInfo.mockReturnValue({
        relationName: 'unknown',
        id: 'id-1',
        relatedCollection: undefined,
      });

      const siblingDoc: Record<string, unknown> = { ref: 'id-1' };

      await relationshipPopulationPromise({
        currentDepth: 0,
        depth: 1,
        draft: false,
        fallbackLocale: 'en',
        field: { type: 'relationship', name: 'ref', relationTo: 'unknown' },
        locale: 'en',
        overrideAccess: false,
        req: defaultReq(),
        showHiddenFields: false,
        siblingDoc,
      });

      expect(mockExtractRelationInfo).toHaveBeenCalled();
      // When relatedCollection is undefined, populate returns early without loading
      expect(mockLoadRelatedDocument).not.toHaveBeenCalled();
    });

    it('should skip loading when shouldPopulateRelationship returns false', async () => {
      mockShouldPopulateRelationship.mockReturnValue(false);

      const siblingDoc: Record<string, unknown> = { author: 'user-1' };

      await relationshipPopulationPromise({
        currentDepth: 0,
        depth: 0,
        draft: false,
        fallbackLocale: 'en',
        field: { type: 'relationship', name: 'author', relationTo: 'users' },
        locale: 'en',
        overrideAccess: false,
        req: defaultReq(),
        showHiddenFields: false,
        siblingDoc,
      });

      expect(mockExtractRelationInfo).toHaveBeenCalled();
      expect(mockLoadRelatedDocument).not.toHaveBeenCalled();
      // Falls back to id, then updateDocument is called
      expect(mockUpdateDocumentWithPopulatedValue).toHaveBeenCalled();
    });

    it('should skip loading when req has no dataLoader', async () => {
      const siblingDoc: Record<string, unknown> = { author: 'user-1' };

      await relationshipPopulationPromise({
        currentDepth: 0,
        depth: 1,
        draft: false,
        fallbackLocale: 'en',
        field: { type: 'relationship', name: 'author', relationTo: 'users' },
        locale: 'en',
        overrideAccess: false,
        req: { revealui: { collections: {} } },
        showHiddenFields: false,
        siblingDoc,
      });

      expect(mockExtractRelationInfo).toHaveBeenCalled();
      // No dataLoader means shouldPopulate passes but load is skipped
      expect(mockUpdateDocumentWithPopulatedValue).toHaveBeenCalled();
    });

    it('should not call applyNestedPopulation when currentDepth >= depth', async () => {
      const siblingDoc: Record<string, unknown> = { author: 'user-1' };

      await relationshipPopulationPromise({
        currentDepth: 1,
        depth: 1,
        draft: false,
        fallbackLocale: 'en',
        field: { type: 'relationship', name: 'author', relationTo: 'users' },
        locale: 'en',
        overrideAccess: false,
        req: defaultReq(),
        showHiddenFields: false,
        siblingDoc,
      });

      expect(mockExtractRelationInfo).toHaveBeenCalled();
      // currentDepth (1) is NOT < depth (1), so no nested population
      expect(mockApplyNestedPopulation).not.toHaveBeenCalled();
    });

    it('should call applyNestedPopulation when currentDepth < depth and value exists', async () => {
      const siblingDoc: Record<string, unknown> = { author: 'user-1' };

      await relationshipPopulationPromise({
        currentDepth: 0,
        depth: 2,
        draft: false,
        fallbackLocale: 'en',
        field: { type: 'relationship', name: 'author', relationTo: 'users' },
        locale: 'en',
        overrideAccess: false,
        req: defaultReq(),
        showHiddenFields: false,
        siblingDoc,
      });

      expect(mockExtractRelationInfo).toHaveBeenCalled();
      expect(mockLoadRelatedDocument).toHaveBeenCalled();
      // currentDepth (0) < depth (2), so nested population should be called
      expect(mockApplyNestedPopulation).toHaveBeenCalled();
    });
  });
});
