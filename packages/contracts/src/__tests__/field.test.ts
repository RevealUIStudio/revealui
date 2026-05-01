/**
 * Field Contract Tests
 *
 * Tests the FieldContract for validation and type safety
 */

import { describe, expect, it } from 'vitest';
import { isFieldConfig, parseField, validateField } from '../admin/field.js';

describe('Field Contract', () => {
  describe('Validation', () => {
    it('validates valid field configs', () => {
      const validField = {
        name: 'title',
        type: 'text',
      };

      const result = validateField(validField);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('title');
        expect(result.data.type).toBe('text');
      }
    });

    it('rejects invalid field configs', () => {
      const invalid = {
        // Missing required 'type' field
        name: 'title',
      };

      const result = validateField(invalid);
      expect(result.success).toBe(false);
    });

    it('validates different field types', () => {
      const textField = { name: 'title', type: 'text' };
      const numberField = { name: 'age', type: 'number' };
      const emailField = { name: 'email', type: 'email' };

      expect(validateField(textField).success).toBe(true);
      expect(validateField(numberField).success).toBe(true);
      expect(validateField(emailField).success).toBe(true);
    });
  });

  describe('Type Guards', () => {
    it('correctly identifies field configs', () => {
      const validField = { name: 'title', type: 'text' };
      expect(isFieldConfig(validField)).toBe(true);
      expect(isFieldConfig({})).toBe(false);
      expect(isFieldConfig(null)).toBe(false);
    });

    it('narrows types correctly', () => {
      const unknownData: unknown = { name: 'title', type: 'text' };

      if (isFieldConfig(unknownData)) {
        // TypeScript should narrow to FieldContractType
        expect(unknownData.name).toBe('title');
        expect(unknownData.type).toBe('text');
      }
    });
  });

  describe('Parse', () => {
    it('parses valid fields', () => {
      const field = parseField({ name: 'title', type: 'text' });
      expect(field.name).toBe('title');
      expect(field.type).toBe('text');
    });

    it('throws on invalid fields', () => {
      const invalid = { name: 'title' }; // Missing required 'type' field

      expect(() => parseField(invalid)).toThrow();
    });
  });
});
