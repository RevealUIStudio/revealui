/**
 * Field Traversal Tests
 *
 * Tests for the modern field traversal implementation using Promise.allSettled()
 */

import type { Field } from '@revealui/contracts/admin';
import { describe, expect, it } from 'vitest';
import {
  afterChangeTraverseFields,
  afterReadTraverseFields,
  beforeChangeTraverseFields,
  beforeValidateTraverseFields,
} from '../revealui.js';

// Helper to create test fields
function createTextField(name: string): Field {
  return { name, type: 'text' };
}

function createArrayField(name: string, fields: Field[]): Field {
  return { name, type: 'array', fields };
}

function createGroupField(name: string, fields: Field[]): Field {
  return { name, type: 'group', fields };
}

describe('Field Traversal', () => {
  describe('afterChangeTraverseFields', () => {
    it('should traverse simple fields', async () => {
      const fields: Field[] = [createTextField('title'), createTextField('description')];

      const result = await afterChangeTraverseFields({
        fields,
        path: '',
      });

      expect(result.traversed).toBe(2);
      expect(result.found).toHaveLength(2);
      expect(result.errors).toBeUndefined();
    });

    it('should handle empty fields array', async () => {
      const result = await afterChangeTraverseFields({
        fields: [],
        path: '',
      });

      expect(result.traversed).toBe(0);
      expect(result.found).toHaveLength(0);
      expect(result.errors).toBeUndefined();
    });

    it('should filter fields with callback', async () => {
      const fields: Field[] = [
        createTextField('title'),
        createTextField('description'),
        createTextField('secret'),
      ];

      const result = await afterChangeTraverseFields({
        fields,
        path: '',
        callback: (field) => field.name !== 'secret',
      });

      expect(result.traversed).toBe(2);
      expect(result.found).toHaveLength(2);
      expect(result.found.every((f) => f.name !== 'secret')).toBe(true);
    });

    it('should handle nested array fields', async () => {
      const fields: Field[] = [
        createArrayField('items', [createTextField('name'), createTextField('value')]),
      ];

      const result = await afterChangeTraverseFields({
        fields,
        path: '',
      });

      expect(result.traversed).toBeGreaterThan(0);
      expect(result.found.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle nested group fields', async () => {
      const fields: Field[] = [
        createGroupField('metadata', [createTextField('author'), createTextField('date')]),
      ];

      const result = await afterChangeTraverseFields({
        fields,
        path: '',
      });

      expect(result.traversed).toBeGreaterThan(0);
      expect(result.found.length).toBeGreaterThanOrEqual(1);
    });

    it('should preserve data object', async () => {
      const testData = { custom: 'data' };
      const result = await afterChangeTraverseFields({
        fields: [createTextField('title')],
        data: testData,
      });

      expect(result.data).toEqual(testData);
    });

    it('should handle invalid fields array gracefully', async () => {
      const result = await afterChangeTraverseFields({
        fields: null as unknown as Field[],
        path: '',
      });

      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
      expect(result.traversed).toBe(0);
    });
  });

  describe('afterReadTraverseFields', () => {
    it('should traverse fields in afterRead mode', async () => {
      const fields: Field[] = [createTextField('title')];

      const result = await afterReadTraverseFields({
        fields,
        path: '',
      });

      expect(result.traversed).toBe(1);
      expect(result.found).toHaveLength(1);
    });
  });

  describe('beforeChangeTraverseFields', () => {
    it('should traverse fields in beforeChange mode', async () => {
      const fields: Field[] = [createTextField('title')];

      const result = await beforeChangeTraverseFields({
        fields,
        path: '',
      });

      expect(result.traversed).toBe(1);
      expect(result.found).toHaveLength(1);
    });
  });

  describe('beforeValidateTraverseFields', () => {
    it('should traverse fields in beforeValidate mode', async () => {
      const fields: Field[] = [createTextField('title')];

      const result = await beforeValidateTraverseFields({
        fields,
        path: '',
      });

      expect(result.traversed).toBe(1);
      expect(result.found).toHaveLength(1);
    });
  });

  describe('Parallel Processing', () => {
    it('should process fields in parallel (performance test)', async () => {
      // Create many fields to test parallel processing
      const fields: Field[] = Array.from({ length: 10 }, (_, i) => createTextField(`field${i}`));

      const startTime = Date.now();
      const result = await afterChangeTraverseFields({
        fields,
        path: '',
      });
      const endTime = Date.now();

      expect(result.traversed).toBe(10);
      expect(result.found).toHaveLength(10);
      // Parallel processing should be fast (all fields processed concurrently)
      expect(endTime - startTime).toBeLessThan(1000); // Should complete quickly
    });
  });
});
