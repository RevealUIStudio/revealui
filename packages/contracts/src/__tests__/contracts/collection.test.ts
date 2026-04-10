/**
 * Collection Contract Tests
 *
 * Tests the CollectionContract for validation and type safety
 */

import { describe, expect, it } from 'vitest';
import {
  type CollectionContractType,
  isCollectionConfig,
  parseCollection,
  validateCollection,
} from '../../admin/collection.js';
import { MockPostsCollection } from '../mocks/revealui.js';

describe('Collection Contract', () => {
  describe('Validation', () => {
    it('validates valid collection configs', () => {
      const result = validateCollection(MockPostsCollection);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.slug).toBe('posts');
      }
    });

    it('rejects invalid collection configs', () => {
      const invalid = {
        // Missing required fields
        fields: [],
      };

      const result = validateCollection(invalid);
      expect(result.success).toBe(false);
    });

    it('validates collection structure correctly', () => {
      const validCollection = {
        slug: 'test-collection',
        fields: [
          {
            name: 'title',
            type: 'text',
          },
        ],
      };

      const result = validateCollection(validCollection);
      expect(result.success).toBe(true);
    });
  });

  describe('Type Guards', () => {
    it('correctly identifies collection configs', () => {
      expect(isCollectionConfig(MockPostsCollection)).toBe(true);
      expect(isCollectionConfig({})).toBe(false);
      expect(isCollectionConfig(null)).toBe(false);
    });

    it('narrows types correctly', () => {
      const unknownData: unknown = MockPostsCollection;

      if (isCollectionConfig(unknownData)) {
        // TypeScript should narrow to CollectionContractType
        expect(unknownData.slug).toBe('posts');
      }
    });
  });

  describe('Parse', () => {
    it('parses valid collections', () => {
      const collection = parseCollection(MockPostsCollection);
      expect(collection.slug).toBe('posts');
    });

    it('throws on invalid collections', () => {
      const invalid = {};

      expect(() => parseCollection(invalid)).toThrow();
    });
  });

  describe('Type Safety', () => {
    it('provides correct types', () => {
      const result = validateCollection(MockPostsCollection);

      if (result.success) {
        const collection: CollectionContractType = result.data;
        expect(collection.slug).toBeDefined();
        expect(typeof collection.slug).toBe('string');
      }
    });
  });
});
