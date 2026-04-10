/**
 * Type Inference Tests
 *
 * These tests verify that TypeScript can properly infer properties
 * from RevealCollectionConfig and RevealUIField without type assertions.
 *
 * @module @revealui/core/types/__tests__/type-inference
 */

import type { Field } from '@revealui/contracts/admin';
import { describe, expect, it } from 'vitest';
import type { RevealCollectionConfig, RevealUIField } from '../index.js';

describe('Type Inference', () => {
  describe('RevealCollectionConfig', () => {
    it('should have slug property without type assertion', () => {
      const collection: RevealCollectionConfig = {
        slug: 'posts',
        fields: [],
      };
      // TypeScript should infer slug without assertion
      const slug: string = collection.slug;
      expect(slug).toBe('posts');
    });

    it('should have fields property without type assertion', () => {
      const collection: RevealCollectionConfig = {
        slug: 'posts',
        fields: [],
      };
      // TypeScript should infer fields without assertion
      const fields: Field[] = collection.fields;
      expect(fields).toEqual([]);
    });

    it('should allow accessing slug and fields together', () => {
      const collection: RevealCollectionConfig = {
        slug: 'posts',
        fields: [{ type: 'text', name: 'title' }],
      };
      // Both properties should be accessible
      expect(collection.slug).toBe('posts');
      expect(collection.fields).toHaveLength(1);
      expect(collection.fields[0]?.name).toBe('title');
    });

    it('should support hooks property from RevealCollectionConfig', () => {
      const collection: RevealCollectionConfig = {
        slug: 'posts',
        fields: [],
        hooks: {
          afterChange: [
            async ({ doc }) => {
              return doc;
            },
          ],
        },
      };
      expect(collection.hooks?.afterChange).toBeDefined();
      expect(collection.hooks?.afterChange).toHaveLength(1);
    });
  });

  describe('RevealUIField', () => {
    it('should have name property without type assertion', () => {
      const field: RevealUIField = {
        type: 'text',
        name: 'title',
      };
      // TypeScript should infer name without assertion
      const name: string | undefined = field.name;
      expect(name).toBe('title');
    });

    it('should have label property without type assertion', () => {
      const field: RevealUIField = {
        type: 'text',
        label: 'Title',
      };
      // TypeScript should infer label without assertion
      const label: string | false | unknown = field.label;
      expect(label).toBe('Title');
    });

    it('should have type property without type assertion', () => {
      const field: RevealUIField = {
        type: 'text',
      };
      // TypeScript should infer type without assertion
      const type: string = field.type;
      expect(type).toBe('text');
    });

    it('should have required property without type assertion', () => {
      const field: RevealUIField = {
        type: 'text',
        required: true,
      };
      // TypeScript should infer required without assertion
      const required: boolean | undefined = field.required;
      expect(required).toBe(true);
    });

    it('should support revealUI property from RevealUIField', () => {
      const field: RevealUIField = {
        type: 'text',
        name: 'title',
        revealUI: {
          searchable: true,
          auditLog: true,
        },
      };
      expect(field.revealUI?.searchable).toBe(true);
      expect(field.revealUI?.auditLog).toBe(true);
    });

    it('should allow accessing all properties together', () => {
      const field: RevealUIField = {
        type: 'text',
        name: 'title',
        label: 'Title',
        required: true,
        revealUI: {
          searchable: true,
        },
      };
      // All properties should be accessible
      expect(field.type).toBe('text');
      expect(field.name).toBe('title');
      expect(field.label).toBe('Title');
      expect(field.required).toBe(true);
      expect(field.revealUI?.searchable).toBe(true);
    });
  });

  describe('Integration', () => {
    it('should work with collection.fields containing RevealUIField', () => {
      const collection: RevealCollectionConfig = {
        slug: 'posts',
        fields: [
          {
            type: 'text',
            name: 'title',
            label: 'Title',
            required: true,
            revealUI: {
              searchable: true,
            },
          },
        ],
      };
      // Should be able to access field properties
      const firstField = collection.fields[0];
      if (firstField) {
        expect(firstField.name).toBe('title');
        expect(firstField.type).toBe('text');
        expect(firstField.label).toBe('Title');
        expect(firstField.required).toBe(true);
        // revealUI should be accessible if it's a RevealUIField
        if ('revealUI' in firstField) {
          expect(firstField.revealUI?.searchable).toBe(true);
        }
      }
    });
  });
});
