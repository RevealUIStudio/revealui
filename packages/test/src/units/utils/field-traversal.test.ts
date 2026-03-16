/**
 * Unit tests for field traversal utilities
 *
 * Tests actual utility from packages/core/src/fieldTraversal.ts
 */

import { describe, expect, it } from 'vitest';
import { traverseFieldsCore } from '../../../../../packages/core/src/fieldTraversal.js';
import type { Field } from '../../../../../packages/core/src/types/index.js';

describe('Field Traversal Utilities', () => {
  describe('traverseFieldsCore', () => {
    it('should traverse simple fields', async () => {
      const fields: Field[] = [
        {
          name: 'title',
          type: 'text',
        },
        {
          name: 'content',
          type: 'textarea',
        },
      ];

      const result = await traverseFieldsCore(
        {
          fields,
          data: {},
        },
        'afterRead',
      );

      expect(result.traversed).toBe(2);
      expect(result.found).toHaveLength(2);
      expect(result.errors).toBeUndefined();
    });

    it('should handle empty fields array', async () => {
      const result = await traverseFieldsCore(
        {
          fields: [],
          data: {},
        },
        'afterRead',
      );

      expect(result.traversed).toBe(0);
      expect(result.found).toHaveLength(0);
      expect(result.errors).toBeUndefined();
    });

    it('should validate fields array input', async () => {
      const result = await traverseFieldsCore(
        {
          fields: null as unknown as Field[],
          data: {},
        },
        'afterRead',
      );

      expect(result.traversed).toBe(0);
      expect(result.found).toHaveLength(0);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0].field).toBe('root');
      expect(result.errors?.[0].message).toContain('Fields must be an array');
    });

    it('should filter fields with callback', async () => {
      const fields: Field[] = [
        {
          name: 'title',
          type: 'text',
        },
        {
          name: 'content',
          type: 'textarea',
        },
        {
          name: 'hidden',
          type: 'text',
        },
      ];

      const result = await traverseFieldsCore(
        {
          fields,
          data: {},
          callback: (field) => {
            return field.name !== 'hidden';
          },
        },
        'afterRead',
      );

      expect(result.traversed).toBe(2);
      expect(result.found).toHaveLength(2);
      expect(result.found.map((f) => f.name)).not.toContain('hidden');
    });

    it('should use path when provided', async () => {
      const fields: Field[] = [
        {
          name: 'title',
          type: 'text',
        },
      ];

      const result = await traverseFieldsCore(
        {
          fields,
          data: {},
          path: 'post',
        },
        'afterRead',
      );

      expect(result.traversed).toBe(1);
      expect(result.found).toHaveLength(1);
    });

    it('should traverse array fields recursively', async () => {
      const fields: Field[] = [
        {
          name: 'items',
          type: 'array',
          fields: [
            {
              name: 'name',
              type: 'text',
            },
            {
              name: 'value',
              type: 'number',
            },
          ],
        },
      ];

      const result = await traverseFieldsCore(
        {
          fields,
          data: {},
        },
        'afterRead',
      );

      expect(result.traversed).toBe(1);
      expect(result.found).toHaveLength(1);
      expect(result.errors).toBeUndefined();
    });

    it('should traverse group fields recursively', async () => {
      const fields: Field[] = [
        {
          name: 'author',
          type: 'group',
          fields: [
            {
              name: 'name',
              type: 'text',
            },
            {
              name: 'email',
              type: 'email',
            },
          ],
        },
      ];

      const result = await traverseFieldsCore(
        {
          fields,
          data: {},
        },
        'afterRead',
      );

      expect(result.traversed).toBe(1);
      expect(result.found).toHaveLength(1);
      expect(result.errors).toBeUndefined();
    });

    it('should handle fields without type (error)', async () => {
      const fields: Field[] = [
        {
          name: 'invalid',
          // Missing type
        } as Field,
      ];

      const result = await traverseFieldsCore(
        {
          fields,
          data: {},
        },
        'afterRead',
      );

      // Should have error for field missing type
      expect(result.errors).toBeDefined();
    });

    it('should preserve data in result', async () => {
      const fields: Field[] = [
        {
          name: 'title',
          type: 'text',
        },
      ];

      const data = {
        title: 'Test Title',
        other: 'data',
      };

      const result = await traverseFieldsCore(
        {
          fields,
          data,
        },
        'afterRead',
      );

      expect(result.data).toEqual(data);
    });

    it('should handle different traversal modes', async () => {
      const fields: Field[] = [
        {
          name: 'title',
          type: 'text',
        },
      ];

      const modes = ['afterChange', 'afterRead', 'beforeChange', 'beforeValidate'] as const;

      for (const mode of modes) {
        const result = await traverseFieldsCore(
          {
            fields,
            data: {},
          },
          mode,
        );

        expect(result.traversed).toBe(1);
        expect(result.found).toHaveLength(1);
      }
    });

    it('should handle fields without names', async () => {
      const fields: Field[] = [
        {
          type: 'text',
        },
      ];

      const result = await traverseFieldsCore(
        {
          fields,
          data: {},
        },
        'afterRead',
      );

      expect(result.traversed).toBe(1);
      expect(result.found).toHaveLength(1);
    });

    it('should process fields in parallel', async () => {
      const fields: Field[] = Array.from({ length: 10 }, (_, i) => ({
        name: `field${i}`,
        type: 'text',
      }));

      const start = Date.now();
      const result = await traverseFieldsCore(
        {
          fields,
          data: {},
        },
        'afterRead',
      );
      const duration = Date.now() - start;

      expect(result.traversed).toBe(10);
      expect(result.found).toHaveLength(10);
      // Should complete relatively quickly due to parallel processing
      expect(duration).toBeLessThan(1000);
    });

    it('should handle errors gracefully with Promise.allSettled', async () => {
      const fields: Field[] = [
        {
          name: 'valid',
          type: 'text',
        },
        {
          name: 'invalid',
          // Missing type will cause error
        } as Field,
        {
          name: 'alsoValid',
          type: 'textarea',
        },
      ];

      const result = await traverseFieldsCore(
        {
          fields,
          data: {},
        },
        'afterRead',
      );

      // Should still process valid fields
      expect(result.errors).toBeDefined();
      expect(result.found.length).toBeGreaterThan(0);
    });

    it('should handle blocks fields', async () => {
      const fields: Field[] = [
        {
          name: 'content',
          type: 'blocks',
          blocks: [
            {
              slug: 'paragraph',
              fields: [
                {
                  name: 'text',
                  type: 'text',
                },
              ],
            },
          ],
        },
      ];

      const result = await traverseFieldsCore(
        {
          fields,
          data: {},
        },
        'afterRead',
      );

      expect(result.traversed).toBe(1);
      expect(result.errors).toBeUndefined();
    });

    it('should handle tabs fields', async () => {
      const fields: Field[] = [
        {
          name: 'settings',
          type: 'tabs',
          tabs: [
            {
              label: 'General',
              name: 'general',
              fields: [
                {
                  name: 'title',
                  type: 'text',
                },
              ],
            },
          ],
        },
      ];

      const result = await traverseFieldsCore(
        {
          fields,
          data: {},
        },
        'afterRead',
      );

      expect(result.traversed).toBe(1);
      expect(result.errors).toBeUndefined();
    });
  });
});
