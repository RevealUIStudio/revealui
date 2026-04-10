/**
 * Compile-Time Type Inference Tests
 *
 * These tests verify that TypeScript can properly infer properties
 * from RevealCollectionConfig and RevealUIField at compile-time.
 *
 * Uses expect-type for compile-time type assertions that will fail
 * the build if type inference is incorrect.
 *
 * @module @revealui/core/types/__tests__/type-inference-compile
 */

import type { Field } from '@revealui/contracts/admin';
import { expectTypeOf } from 'expect-type';
import type { RevealCollectionConfig, RevealUIField } from '../index.js';

describe('Compile-Time Type Inference', () => {
  describe('RevealCollectionConfig', () => {
    it('should infer slug property as string', () => {
      const collection: RevealCollectionConfig = {
        slug: 'posts',
        fields: [],
      };
      // Compile-time check: slug should be inferred as string
      expectTypeOf(collection.slug).toEqualTypeOf<string>();
    });

    it('should infer fields property as Field[]', () => {
      const collection: RevealCollectionConfig = {
        slug: 'posts',
        fields: [],
      };
      // Compile-time check: fields should be inferred as Field[]
      expectTypeOf(collection.fields).toEqualTypeOf<Field[]>();
    });

    it('should allow accessing slug and fields without type assertions', () => {
      const collection: RevealCollectionConfig = {
        slug: 'posts',
        fields: [{ type: 'text', name: 'title' }],
      };
      // Compile-time checks: both properties should be accessible
      expectTypeOf(collection.slug).toEqualTypeOf<string>();
      expectTypeOf(collection.fields).toEqualTypeOf<Field[]>();
      // Verify fields array elements are Field
      expectTypeOf(collection.fields[0]).toEqualTypeOf<Field | undefined>();
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
      // Compile-time check: hooks should be optional and have afterChange
      expectTypeOf(collection.hooks).toEqualTypeOf<
        | {
            afterChange?:
              | Array<
                  | ((args: {
                      doc: unknown;
                      context?: {
                        revealui?: unknown;
                        collection?: string;
                        operation: string;
                        previousDoc?: unknown;
                        req?: unknown;
                      };
                      req: unknown;
                      operation: string;
                      previousDoc?: unknown;
                      collection?: string;
                    }) => Promise<unknown> | unknown)
                  | undefined
                >
              | undefined;
            beforeChange?: unknown;
            beforeRead?: unknown;
            afterRead?: unknown;
            beforeDelete?: unknown;
            afterDelete?: unknown;
            afterLogin?: unknown;
          }
        | undefined
      >();
    });
  });

  describe('RevealUIField', () => {
    it('should infer name property as string | undefined', () => {
      const field: RevealUIField = {
        type: 'text',
        name: 'title',
      };
      // Compile-time check: name should be inferred as string | undefined
      expectTypeOf(field.name).toEqualTypeOf<string | undefined>();
    });

    it('should infer label property correctly', () => {
      const field: RevealUIField = {
        type: 'text',
        label: 'Title',
      };
      // Compile-time check: label should be inferred as string | false | unknown
      expectTypeOf(field.label).toMatchTypeOf<string | false | unknown>();
    });

    it('should infer type property as FieldType', () => {
      const field: RevealUIField = {
        type: 'text',
      };
      // Compile-time check: type should be inferred as FieldType (string)
      expectTypeOf(field.type).toEqualTypeOf<string>();
    });

    it('should infer required property as boolean | undefined', () => {
      const field: RevealUIField = {
        type: 'text',
        required: true,
      };
      // Compile-time check: required should be inferred as boolean | undefined
      expectTypeOf(field.required).toEqualTypeOf<boolean | undefined>();
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
      // Compile-time check: revealUI should be optional and have expected properties
      expectTypeOf(field.revealUI).toEqualTypeOf<
        | {
            searchable?: boolean;
            auditLog?: boolean;
            tenantScoped?: boolean;
            permissions?: string[];
            validation?: unknown[];
          }
        | undefined
      >();
    });

    it('should allow accessing all properties together without assertions', () => {
      const field: RevealUIField = {
        type: 'text',
        name: 'title',
        label: 'Title',
        required: true,
        revealUI: {
          searchable: true,
        },
      };
      // Compile-time checks: all properties should be accessible
      expectTypeOf(field.type).toEqualTypeOf<string>();
      expectTypeOf(field.name).toEqualTypeOf<string | undefined>();
      expectTypeOf(field.label).toMatchTypeOf<string | false | unknown>();
      expectTypeOf(field.required).toEqualTypeOf<boolean | undefined>();
      expectTypeOf(field.revealUI).toMatchTypeOf<
        | {
            searchable?: boolean;
            auditLog?: boolean;
            tenantScoped?: boolean;
            permissions?: string[];
            validation?: unknown[];
          }
        | undefined
      >();
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
      // Compile-time check: fields should be Field[] and elements should have Field properties
      expectTypeOf(collection.fields).toEqualTypeOf<Field[]>();
      if (collection.fields[0]) {
        const firstField = collection.fields[0];
        // These properties should be accessible without type assertions
        expectTypeOf(firstField.name).toMatchTypeOf<string | undefined>();
        expectTypeOf(firstField.type).toEqualTypeOf<string>();
        // revealUI should be accessible if it's a RevealUIField
        if ('revealUI' in firstField) {
          expectTypeOf(firstField.revealUI).toMatchTypeOf<
            | {
                searchable?: boolean;
                auditLog?: boolean;
                tenantScoped?: boolean;
                permissions?: string[];
                validation?: unknown[];
              }
            | undefined
          >();
        }
      }
    });

    it('should verify no type assertions needed for basic property access', () => {
      // This test verifies that we can access properties without type assertions
      const collection: RevealCollectionConfig = {
        slug: 'posts',
        fields: [{ type: 'text', name: 'title' }],
      };

      const field: RevealUIField = {
        type: 'text',
        name: 'title',
      };

      // All these should compile without errors - no type assertions needed
      const slug: string = collection.slug;
      const fields: Field[] = collection.fields;
      const fieldName: string | undefined = field.name;
      const fieldType: string = field.type;

      // Runtime assertions to satisfy the test framework
      expect(slug).toBe('posts');
      expect(fields).toHaveLength(1);
      expect(fieldName).toBe('title');
      expect(fieldType).toBe('text');

      // Compile-time type checks
      expectTypeOf(slug).toEqualTypeOf<string>();
      expectTypeOf(fields).toEqualTypeOf<Field[]>();
      expectTypeOf(fieldName).toEqualTypeOf<string | undefined>();
      expectTypeOf(fieldType).toEqualTypeOf<string>();
    });
  });
});
