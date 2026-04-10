/**
 * Problem Case Type Inference Tests
 *
 * These tests verify that the actual problematic scenarios mentioned in the
 * original plan work correctly - specifically cases where type assertions
 * were previously needed but should no longer be required.
 *
 * This tests the REAL problem cases, not just happy paths.
 *
 * @module @revealui/core/types/__tests__/type-inference-problem-cases
 */

import type { Field } from '@revealui/contracts/admin';
import { expectTypeOf } from 'expect-type';
import type { RevealCollectionConfig, RevealUIField } from '../index.js';

describe('Problem Case Type Inference', () => {
  describe('Collection Config Property Access', () => {
    it('should access slug without assertion (the original problem)', () => {
      // This was the original problem - accessing collection.slug required
      // (collection as CollectionConfig).slug
      const collection: RevealCollectionConfig = {
        slug: 'posts',
        fields: [],
      };

      // Should work without assertion - this was failing before
      const slug: string = collection.slug;
      expectTypeOf(slug).toEqualTypeOf<string>();
      expect(slug).toBe('posts');
    });

    it('should access fields without assertion (the original problem)', () => {
      // This was the original problem - accessing collection.fields required
      // (collection as CollectionConfig).fields
      const collection: RevealCollectionConfig = {
        slug: 'posts',
        fields: [{ type: 'text', name: 'title' }],
      };

      // Should work without assertion - this was failing before
      const fields: Field[] = collection.fields;
      expectTypeOf(fields).toEqualTypeOf<Field[]>();
      expect(fields).toHaveLength(1);
    });

    it('should access slug and fields in same function without assertions', () => {
      // Real-world scenario: accessing multiple properties
      function processCollection(collection: RevealCollectionConfig) {
        // Before: Required (collection as CollectionConfig).slug
        const slug: string = collection.slug;

        // Before: Required (collection as CollectionConfig).fields
        const fields: Field[] = collection.fields;

        return { slug, fieldCount: fields.length };
      }

      const collection: RevealCollectionConfig = {
        slug: 'posts',
        fields: [{ type: 'text', name: 'title' }],
      };

      const result = processCollection(collection);
      expect(result.slug).toBe('posts');
      expect(result.fieldCount).toBe(1);

      // Compile-time verification
      expectTypeOf(result.slug).toEqualTypeOf<string>();
      expectTypeOf(result.fieldCount).toEqualTypeOf<number>();
    });
  });

  describe('Field Property Access', () => {
    it('should access field.name without assertion (the original problem)', () => {
      // This was the original problem - accessing field.name required
      // (field as RevealUIField & { name: string }).name
      const field: RevealUIField = {
        type: 'text',
        name: 'title',
      };

      // Should work without assertion - this was failing before
      const name: string | undefined = field.name;
      expectTypeOf(name).toEqualTypeOf<string | undefined>();
      expect(name).toBe('title');
    });

    it('should access field.type without assertion', () => {
      const field: RevealUIField = {
        type: 'text',
      };

      // Should work without assertion
      const type: string = field.type;
      expectTypeOf(type).toEqualTypeOf<string>();
      expect(type).toBe('text');
    });

    it('should access field.label without assertion', () => {
      const field: RevealUIField = {
        type: 'text',
        label: 'Title',
      };

      // Should work without assertion
      const label: string | false | unknown = field.label;
      expectTypeOf(label).toMatchTypeOf<string | false | unknown>();
      expect(label).toBe('Title');
    });

    it('should access field.required without assertion', () => {
      const field: RevealUIField = {
        type: 'text',
        required: true,
      };

      // Should work without assertion
      const required: boolean | undefined = field.required;
      expectTypeOf(required).toEqualTypeOf<boolean | undefined>();
      expect(required).toBe(true);
    });

    it('should iterate over collection.fields and access field properties', () => {
      // Real-world scenario: iterating and accessing properties
      const collection: RevealCollectionConfig = {
        slug: 'posts',
        fields: [
          { type: 'text', name: 'title', required: true },
          { type: 'text', name: 'slug', label: 'URL Slug' },
        ],
      };

      // Before: Required fieldWithProps = field as RevealUIField & { name: string }
      const fieldNames: string[] = [];
      for (const field of collection.fields) {
        if (field.name) {
          // Should work without assertion
          fieldNames.push(field.name);

          // Should also access other properties without assertion
          const isRequired: boolean | undefined = field.required;
          const fieldType: string = field.type;
          expectTypeOf(isRequired).toEqualTypeOf<boolean | undefined>();
          expectTypeOf(fieldType).toEqualTypeOf<string>();
        }
      }

      expect(fieldNames).toEqual(['title', 'slug']);
    });
  });

  describe('Config Field Access Patterns', () => {
    it('should filter fields without assertions', () => {
      const collection: RevealCollectionConfig = {
        slug: 'posts',
        fields: [
          { type: 'text', name: 'title', required: true },
          { type: 'text', name: 'content' },
          { type: 'row' }, // Layout field without name
        ],
      };

      // Real-world scenario: filtering fields by properties
      // Before: Required type assertions in filter callback
      const namedFields = collection.fields.filter((field) => {
        // Should access field.name without assertion
        return field.name !== undefined;
      });

      expectTypeOf(namedFields).toEqualTypeOf<Field[]>();
      expect(namedFields).toHaveLength(2);
      expect(namedFields[0]?.name).toBe('title');
    });

    it('should map over fields and access properties', () => {
      const collection: RevealCollectionConfig = {
        slug: 'posts',
        fields: [
          { type: 'text', name: 'title', label: 'Title' },
          { type: 'text', name: 'content', label: 'Content' },
        ],
      };

      // Real-world scenario: mapping fields to extract information
      // Before: Required type assertions in map callback
      const fieldInfo = collection.fields.map((field) => {
        // Should access properties without assertion
        return {
          name: field.name,
          type: field.type,
          label: field.label,
          required: field.required,
        };
      });

      expectTypeOf(fieldInfo).toEqualTypeOf<
        Array<{
          name: string | undefined;
          type: string;
          label: string | false | unknown;
          required: boolean | undefined;
        }>
      >();
      expect(fieldInfo).toHaveLength(2);
    });

    it('should access field properties in conditional logic', () => {
      const collection: RevealCollectionConfig = {
        slug: 'posts',
        fields: [
          { type: 'text', name: 'email', required: true },
          { type: 'checkbox', name: 'newsletter' },
        ],
      };

      // Real-world scenario: conditional logic based on field properties
      function getRequiredFieldNames(config: RevealCollectionConfig): string[] {
        const required: string[] = [];
        for (const field of config.fields) {
          // Should access field.required and field.name without assertions
          if (field.required && field.name) {
            required.push(field.name);
          }
        }
        return required;
      }

      const required = getRequiredFieldNames(collection);
      expect(required).toEqual(['email']);
      expectTypeOf(required).toEqualTypeOf<string[]>();
    });
  });

  describe('Integration with Operations', () => {
    it('should work with create operation field validation pattern', () => {
      // This tests the actual pattern from create.ts that was mentioned
      // as having type errors
      const config: RevealCollectionConfig = {
        slug: 'users',
        fields: [
          { type: 'email', name: 'email', required: true },
          { type: 'text', name: 'name', required: true },
        ],
      };

      // Simulate the create operation validation logic
      const data: Record<string, unknown> = {
        email: 'test@example.com',
        name: 'Test User',
      };

      // This pattern from create.ts should work without assertions
      for (const field of config.fields) {
        // Should access field.name without assertion
        if (!field.name) {
          continue;
        }

        // Should access field.required without assertion
        if (field.required && !(field.name in data)) {
          throw new Error(`Field '${field.name}' is required`);
        }

        // Should access field.type without assertion
        const isEmailField = field.type === 'email' || field.name.toLowerCase() === 'email';
        expectTypeOf(isEmailField).toEqualTypeOf<boolean>();
      }

      // Validation passed for all required fields
      expect(Object.keys(data)).toEqual(expect.arrayContaining(['email', 'name']));
    });

    it('should work with field conversion utilities', () => {
      // Test that fields can be converted without requiring assertions
      const config: RevealCollectionConfig = {
        slug: 'posts',
        fields: [
          { type: 'text', name: 'title', required: true },
          {
            type: 'array',
            name: 'tags',
            fields: [{ type: 'text', name: 'tag' }],
          },
        ],
      };

      // Access fields without assertions
      const textFields = config.fields.filter((field) => {
        // Should access field.type without assertion
        return field.type === 'text';
      });

      const arrayFields = config.fields.filter((field) => {
        // Should access field.type without assertion
        return field.type === 'array';
      });

      expectTypeOf(textFields).toEqualTypeOf<Field[]>();
      expectTypeOf(arrayFields).toEqualTypeOf<Field[]>();
      expect(textFields.length).toBeGreaterThan(0);
      expect(arrayFields.length).toBeGreaterThan(0);
    });
  });

  describe('Hook Context Patterns', () => {
    it('should access config.slug in hook context without assertion', () => {
      // Test the pattern from hooks.ts
      const config: RevealCollectionConfig = {
        slug: 'posts',
        fields: [],
        hooks: {
          afterChange: [
            async ({ doc, collection }) => {
              // collection comes from config.slug - should be string
              expectTypeOf(collection).toMatchTypeOf<string | undefined>();
              return doc;
            },
          ],
        },
      };

      // Should access config.slug without assertion when creating context
      const context = {
        collection: config.slug, // Should work without (config as CollectionConfig).slug
      };

      expectTypeOf(context.collection).toEqualTypeOf<string>();
      expect(context.collection).toBe('posts');
    });
  });

  describe('Type Narrowing in Conditionals', () => {
    it('should narrow field types in switch statements', () => {
      const fields: RevealUIField[] = [
        { type: 'text', name: 'title' },
        { type: 'array', name: 'tags', fields: [] },
        { type: 'checkbox', name: 'published' },
      ];

      const processed: string[] = [];
      for (const field of fields) {
        // Should access field.type and field.name without assertion
        switch (field.type) {
          case 'text':
            if (field.name) {
              // TypeScript should narrow field here - accessing name should work
              processed.push(`text: ${field.name}`);
            }
            break;
          case 'array':
            if (field.name) {
              // TypeScript should narrow field here
              processed.push(`array: ${field.name}`);
            }
            break;
          case 'checkbox':
            if (field.name) {
              // TypeScript should narrow field here
              processed.push(`checkbox: ${field.name}`);
            }
            break;
        }
      }

      expect(processed.length).toBe(3);
      expectTypeOf(processed).toEqualTypeOf<string[]>();
    });
  });
});
