/**
 * Unit tests for password validation utilities
 *
 * Tests REAL password validation from apps/cms/src/lib/validation/schemas.ts
 */

import { passwordSchema } from '@revealui/lib/validation/schemas'
import { describe, expect, it } from 'vitest'

describe('Password Validation (Real Framework Code)', () => {
  describe('passwordSchema', () => {
    it('should accept valid passwords', () => {
      const validPasswords = ['TestPassword123!', 'MySecure123', 'ComplexPass1', 'Valid123Password']

      validPasswords.forEach((password) => {
        const result = passwordSchema.safeParse(password)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data).toBe(password)
        }
      })
    })

    it('should reject passwords that are too short', () => {
      const shortPasswords = ['Short1', 'Abc12', 'Pass1']

      shortPasswords.forEach((password) => {
        const result = passwordSchema.safeParse(password)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('at least 8 characters')
        }
      })
    })

    it('should reject passwords that are too long', () => {
      const longPassword = `${'A'.repeat(130)}1`
      const result = passwordSchema.safeParse(longPassword)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('too long')
      }
    })

    it('should reject passwords without uppercase letters', () => {
      const result = passwordSchema.safeParse('lowercase123')
      expect(result.success).toBe(false)
      if (!result.success) {
        const messages = result.error.issues.map((issue) => issue.message)
        expect(messages.some((msg) => msg.includes('uppercase'))).toBe(true)
      }
    })

    it('should reject passwords without lowercase letters', () => {
      const result = passwordSchema.safeParse('UPPERCASE123')
      expect(result.success).toBe(false)
      if (!result.success) {
        const messages = result.error.issues.map((issue) => issue.message)
        expect(messages.some((msg) => msg.includes('lowercase'))).toBe(true)
      }
    })

    it('should reject passwords without numbers', () => {
      const result = passwordSchema.safeParse('NoNumbers')
      expect(result.success).toBe(false)
      if (!result.success) {
        const messages = result.error.issues.map((issue) => issue.message)
        expect(messages.some((msg) => msg.includes('number'))).toBe(true)
      }
    })

    it('should reject empty passwords', () => {
      const result = passwordSchema.safeParse('')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('at least 8 characters')
      }
    })

    it('should provide clear error messages for multiple violations', () => {
      const result = passwordSchema.safeParse('short')
      expect(result.success).toBe(false)
      if (!result.success) {
        const messages = result.error.issues.map((issue) => issue.message)
        expect(messages.length).toBeGreaterThan(1)
      }
    })
  })
})
