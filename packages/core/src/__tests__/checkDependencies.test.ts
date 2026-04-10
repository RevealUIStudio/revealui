/**
 * checkDependencies Tests
 *
 * Tests for the checkDependencies utility function that validates field dependencies
 */

import type { Field } from '@revealui/contracts/admin';
import { describe, expect, it } from 'vitest';
import { checkDependencies } from '../revealui.js';

describe('checkDependencies', () => {
  describe('Conditional Fields (admin.condition)', () => {
    it('should return true for fields with function conditions', () => {
      const field: Field = {
        name: 'conditionalField',
        type: 'text',
        admin: {
          condition: () => true, // Function condition
        },
      };

      const result = checkDependencies({
        field,
        fields: [],
        path: '',
      });

      expect(result).toBe(true);
    });

    it('should return true for fields with boolean true conditions', () => {
      const field: Field = {
        name: 'conditionalField',
        type: 'text',
        admin: {
          condition: true,
        },
      };

      const result = checkDependencies({
        field,
        fields: [],
        path: '',
      });

      expect(result).toBe(true);
    });

    it('should return false for fields with boolean false conditions', () => {
      const field: Field = {
        name: 'conditionalField',
        type: 'text',
        admin: {
          condition: false,
        },
      };

      const result = checkDependencies({
        field,
        fields: [],
        path: '',
      });

      expect(result).toBe(false);
    });

    it('should handle fields without admin.condition', () => {
      const field: Field = {
        name: 'regularField',
        type: 'text',
      };

      const result = checkDependencies({
        field,
        fields: [],
        path: '',
      });

      expect(result).toBe(true);
    });

    it('should handle fields with admin but no condition', () => {
      const field: Field = {
        name: 'fieldWithAdmin',
        type: 'text',
        admin: {
          description: 'Some description',
        },
      };

      const result = checkDependencies({
        field,
        fields: [],
        path: '',
      });

      expect(result).toBe(true);
    });
  });

  describe('Relationship Fields', () => {
    it('should return true for relationship field with valid relationTo (string)', () => {
      const field: Field = {
        name: 'author',
        type: 'relationship',
        relationTo: 'users',
      };

      const result = checkDependencies({
        field,
        fields: [],
        path: '',
      });

      expect(result).toBe(true);
    });

    it('should return true for relationship field with valid relationTo (array)', () => {
      const field: Field = {
        name: 'content',
        type: 'relationship',
        relationTo: ['posts', 'pages'],
      };

      const result = checkDependencies({
        field,
        fields: [],
        path: '',
      });

      expect(result).toBe(true);
    });

    it('should return false for relationship field without relationTo', () => {
      const field: Field = {
        name: 'invalidRelationship',
        type: 'relationship',
        // Missing relationTo
      };

      const result = checkDependencies({
        field,
        fields: [],
        path: '',
      });

      expect(result).toBe(false);
    });

    it('should return false for relationship field with empty relationTo array', () => {
      const field: Field = {
        name: 'invalidRelationship',
        type: 'relationship',
        relationTo: [],
      };

      const result = checkDependencies({
        field,
        fields: [],
        path: '',
      });

      expect(result).toBe(false);
    });

    it('should return false for relationship field with empty string in relationTo array', () => {
      const field: Field = {
        name: 'invalidRelationship',
        type: 'relationship',
        relationTo: ['valid', ''],
      };

      const result = checkDependencies({
        field,
        fields: [],
        path: '',
      });

      expect(result).toBe(false);
    });

    it('should handle upload fields like relationship fields', () => {
      const field: Field = {
        name: 'image',
        type: 'upload',
        relationTo: 'media',
      };

      const result = checkDependencies({
        field,
        fields: [],
        path: '',
      });

      expect(result).toBe(true);
    });

    it('should return false for upload field without relationTo', () => {
      const field: Field = {
        name: 'invalidUpload',
        type: 'upload',
        // Missing relationTo
      };

      const result = checkDependencies({
        field,
        fields: [],
        path: '',
      });

      expect(result).toBe(false);
    });
  });

  describe('Simple Fields (no dependencies)', () => {
    it('should return true for text fields', () => {
      const field: Field = {
        name: 'title',
        type: 'text',
      };

      const result = checkDependencies({
        field,
        fields: [],
        path: '',
      });

      expect(result).toBe(true);
    });

    it('should return true for number fields', () => {
      const field: Field = {
        name: 'count',
        type: 'number',
      };

      const result = checkDependencies({
        field,
        fields: [],
        path: '',
      });

      expect(result).toBe(true);
    });

    it('should return true for textarea fields', () => {
      const field: Field = {
        name: 'description',
        type: 'textarea',
      };

      const result = checkDependencies({
        field,
        fields: [],
        path: '',
      });

      expect(result).toBe(true);
    });

    it('should handle path parameter (unused but provided)', () => {
      const field: Field = {
        name: 'title',
        type: 'text',
      };

      const result = checkDependencies({
        field,
        fields: [],
        path: 'nested.path',
      });

      expect(result).toBe(true);
    });

    it('should handle fields parameter (unused but provided)', () => {
      const field: Field = {
        name: 'title',
        type: 'text',
      };

      const otherFields: Field[] = [{ name: 'other', type: 'text' }];

      const result = checkDependencies({
        field,
        fields: otherFields,
        path: '',
      });

      expect(result).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should prioritize conditional logic over relationship logic', () => {
      const field: Field = {
        name: 'conditionalRelationship',
        type: 'relationship',
        relationTo: 'users',
        admin: {
          condition: false, // Should return false, ignoring valid relationTo
        },
      };

      const result = checkDependencies({
        field,
        fields: [],
        path: '',
      });

      expect(result).toBe(false);
    });

    it('should handle complex admin object with multiple properties', () => {
      const field: Field = {
        name: 'complexField',
        type: 'text',
        admin: {
          condition: true,
          description: 'Description',
          placeholder: 'Placeholder',
        },
      };

      const result = checkDependencies({
        field,
        fields: [],
        path: '',
      });

      expect(result).toBe(true);
    });
  });
});
