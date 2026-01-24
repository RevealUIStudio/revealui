/**
 * Unit tests for field conversion utilities
 *
 * Tests actual utilities from packages/core/src/utils/field-conversion.ts
 */

import { describe, expect, it } from 'vitest'
import type { Field, RevealUIField } from '../../../../../packages/core/src/types/index.js'
// @ts-expect-error - Direct import for testing
import {
  convertFromRevealUIField,
  convertToRevealUIField,
  enhanceFieldWithRevealUI,
  validateRevealUIField,
} from '../../../../../packages/core/src/utils/field-conversion.js'

describe('Field Conversion Utilities', () => {
  describe('convertToRevealUIField', () => {
    it('should convert basic text field', () => {
      const field: Field = {
        name: 'title',
        type: 'text',
        label: 'Title',
        required: true,
      }

      const revealUIField = convertToRevealUIField(field)

      expect(revealUIField.name).toBe('title')
      expect(revealUIField.type).toBe('text')
      expect(revealUIField.label).toBe('Title')
      expect(revealUIField.required).toBe(true)
      expect(revealUIField.revealUI).toBeDefined()
    })

    it('should set default RevealUI properties', () => {
      const field: Field = {
        name: 'title',
        type: 'text',
      }

      const revealUIField = convertToRevealUIField(field)

      expect(revealUIField.revealUI.searchable).toBe(false)
      expect(revealUIField.revealUI.permissions).toEqual(['read', 'write'])
      expect(revealUIField.revealUI.tenantScoped).toBe(false)
      expect(revealUIField.revealUI.auditLog).toBe(false)
      expect(revealUIField.revealUI.validation).toEqual([])
    })

    it('should preserve text field properties', () => {
      const field: Field = {
        name: 'title',
        type: 'text',
        maxLength: 100,
        minLength: 5,
      }

      const revealUIField = convertToRevealUIField(field)

      expect(revealUIField.maxLength).toBe(100)
      expect(revealUIField.minLength).toBe(5)
    })

    it('should preserve checkbox field properties', () => {
      const field: Field = {
        name: 'published',
        type: 'checkbox',
        defaultValue: true,
      }

      const revealUIField = convertToRevealUIField(field)

      expect(revealUIField.defaultValue).toBe(true)
    })

    it('should preserve array field properties', () => {
      const field: Field = {
        name: 'items',
        type: 'array',
        fields: [
          {
            name: 'name',
            type: 'text',
          },
        ],
        minRows: 1,
        maxRows: 10,
      }

      const revealUIField = convertToRevealUIField(field)

      expect(revealUIField.fields).toBeDefined()
      expect(revealUIField.fields).toHaveLength(1)
      expect(revealUIField.minRows).toBe(1)
      expect(revealUIField.maxRows).toBe(10)
    })

    it('should preserve richText field properties', () => {
      const field: Field = {
        name: 'content',
        type: 'richText',
        editor: 'lexical',
      }

      const revealUIField = convertToRevealUIField(field)

      expect(revealUIField.editor).toBe('lexical')
    })

    it('should preserve validate function', () => {
      const validateFn = (value: unknown) => {
        if (typeof value === 'string' && value.length > 10) {
          return 'Value too long'
        }
        return true
      }

      const field: Field = {
        name: 'title',
        type: 'text',
        validate: validateFn,
      }

      const revealUIField = convertToRevealUIField(field)

      expect(revealUIField.validate).toBeDefined()
      expect(typeof revealUIField.validate).toBe('function')
    })
  })

  describe('convertFromRevealUIField', () => {
    it('should convert RevealUI field back to standard field', () => {
      const field: Field = {
        name: 'title',
        type: 'text',
        label: 'Title',
        required: true,
      }

      const revealUIField = convertToRevealUIField(field)
      const convertedBack = convertFromRevealUIField(revealUIField)

      expect(convertedBack.name).toBe('title')
      expect(convertedBack.type).toBe('text')
      expect(convertedBack.label).toBe('Title')
      expect(convertedBack.required).toBe(true)
    })

    it('should strip RevealUI-specific properties', () => {
      const field: Field = {
        name: 'title',
        type: 'text',
      }

      const revealUIField = convertToRevealUIField(field)
      const convertedBack = convertFromRevealUIField(revealUIField)

      expect((convertedBack as any).revealUI).toBeUndefined()
    })

    it('should preserve field type-specific properties', () => {
      const field: Field = {
        name: 'title',
        type: 'text',
        maxLength: 100,
        minLength: 5,
      }

      const revealUIField = convertToRevealUIField(field)
      const convertedBack = convertFromRevealUIField(revealUIField)

      expect(convertedBack.maxLength).toBe(100)
      expect(convertedBack.minLength).toBe(5)
    })

    it('should preserve validate function', () => {
      const validateFn = (value: unknown) => {
        if (typeof value === 'string' && value.length > 10) {
          return 'Value too long'
        }
        return true
      }

      const field: Field = {
        name: 'title',
        type: 'text',
        validate: validateFn,
      }

      const revealUIField = convertToRevealUIField(field)
      const convertedBack = convertFromRevealUIField(revealUIField)

      expect(convertedBack.validate).toBeDefined()
      expect(convertedBack.validate?.('too long string', {} as any)).toBe('Value too long')
    })
  })

  describe('enhanceFieldWithRevealUI', () => {
    it('should enhance field with RevealUI options', () => {
      const field: Field = {
        name: 'title',
        type: 'text',
      }

      const revealUIOptions: RevealUIField['revealUI'] = {
        searchable: true,
        tenantScoped: true,
        permissions: ['read'],
        auditLog: true,
        validation: [],
      }

      const enhanced = enhanceFieldWithRevealUI(field, revealUIOptions)

      expect(enhanced.revealUI.searchable).toBe(true)
      expect(enhanced.revealUI.tenantScoped).toBe(true)
      expect(enhanced.revealUI.permissions).toEqual(['read'])
      expect(enhanced.revealUI.auditLog).toBe(true)
    })

    it('should merge with default RevealUI properties', () => {
      const field: Field = {
        name: 'title',
        type: 'text',
      }

      const revealUIOptions: RevealUIField['revealUI'] = {
        searchable: true,
      }

      const enhanced = enhanceFieldWithRevealUI(field, revealUIOptions)

      expect(enhanced.revealUI.searchable).toBe(true)
      expect(enhanced.revealUI.permissions).toEqual(['read', 'write']) // Default preserved
      expect(enhanced.revealUI.tenantScoped).toBe(false) // Default preserved
    })

    it('should work without options (use defaults)', () => {
      const field: Field = {
        name: 'title',
        type: 'text',
      }

      const enhanced = enhanceFieldWithRevealUI(field)

      expect(enhanced.revealUI).toBeDefined()
      expect(enhanced.revealUI.searchable).toBe(false)
      expect(enhanced.revealUI.tenantScoped).toBe(false)
    })
  })

  describe('validateRevealUIField', () => {
    it('should return true for valid value', () => {
      const field: Field = {
        name: 'title',
        type: 'text',
        required: true,
      }

      const revealUIField = convertToRevealUIField(field)
      const context = {
        data: {},
        siblingData: {},
        operation: 'create' as const,
      }

      const result = validateRevealUIField(revealUIField, 'Test Title', context)
      expect(result).toBe(true)
    })

    it('should validate required field', () => {
      const field: Field = {
        name: 'title',
        type: 'text',
        required: true,
      }

      const revealUIField = convertToRevealUIField(field)
      const context = {
        data: {},
        siblingData: {},
        operation: 'create' as const,
      }

      const result = validateRevealUIField(revealUIField, '', context)
      expect(result).not.toBe(true)
      expect(typeof result).toBe('string')
    })

    it('should validate min length for string', () => {
      const field: Field = {
        name: 'title',
        type: 'text',
      }

      const revealUIField = convertToRevealUIField(field)
      revealUIField.revealUI.validation = [
        {
          type: 'min',
          value: 5,
          message: 'Title must be at least 5 characters',
        },
      ]

      const context = {
        data: {},
        siblingData: {},
        operation: 'create' as const,
      }

      const result1 = validateRevealUIField(revealUIField, 'Test', context)
      expect(result1).not.toBe(true)

      const result2 = validateRevealUIField(revealUIField, 'Test Title', context)
      expect(result2).toBe(true)
    })

    it('should validate max length for string', () => {
      const field: Field = {
        name: 'title',
        type: 'text',
      }

      const revealUIField = convertToRevealUIField(field)
      revealUIField.revealUI.validation = [
        {
          type: 'max',
          value: 10,
          message: 'Title must be no more than 10 characters',
        },
      ]

      const context = {
        data: {},
        siblingData: {},
        operation: 'create' as const,
      }

      const result1 = validateRevealUIField(revealUIField, 'This is too long', context)
      expect(result1).not.toBe(true)

      const result2 = validateRevealUIField(revealUIField, 'Short', context)
      expect(result2).toBe(true)
    })

    it('should validate pattern', () => {
      const field: Field = {
        name: 'email',
        type: 'email',
      }

      const revealUIField = convertToRevealUIField(field)
      revealUIField.revealUI.validation = [
        {
          type: 'pattern',
          value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
          message: 'Invalid email format',
        },
      ]

      const context = {
        data: {},
        siblingData: {},
        operation: 'create' as const,
      }

      const result1 = validateRevealUIField(revealUIField, 'invalid-email', context)
      expect(result1).not.toBe(true)

      const result2 = validateRevealUIField(revealUIField, 'test@example.com', context)
      expect(result2).toBe(true)
    })

    it('should validate custom validation function', () => {
      const field: Field = {
        name: 'title',
        type: 'text',
      }

      const revealUIField = convertToRevealUIField(field)
      revealUIField.revealUI.validation = [
        {
          type: 'custom',
          validate: (value: unknown) => {
            if (typeof value === 'string' && value.startsWith('Test')) {
              return true
            }
            return 'Value must start with "Test"'
          },
        },
      ]

      const context = {
        data: {},
        siblingData: {},
        operation: 'create' as const,
      }

      const result1 = validateRevealUIField(revealUIField, 'Test Title', context)
      expect(result1).toBe(true)

      const result2 = validateRevealUIField(revealUIField, 'Other Title', context)
      expect(result2).not.toBe(true)
    })

    it('should run original field validator if it exists', () => {
      const validateFn = (value: unknown) => {
        if (typeof value === 'string' && value.length > 10) {
          return 'Value too long'
        }
        return true
      }

      const field: Field = {
        name: 'title',
        type: 'text',
        validate: validateFn,
      }

      const revealUIField = convertToRevealUIField(field)
      const context = {
        data: {},
        siblingData: {},
        user: { id: '1', email: 'user@example.com' },
        operation: 'create' as const,
      }

      const result1 = validateRevealUIField(revealUIField, 'Short', context)
      expect(result1).toBe(true)

      const result2 = validateRevealUIField(revealUIField, 'This is too long', context)
      expect(result2).not.toBe(true)
    })
  })
})
