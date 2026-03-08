import { describe, expect, it } from 'vitest'
import {
  meetsMinimumPasswordRequirements,
  validatePasswordStrength,
} from '../server/password-validation'

describe('validatePasswordStrength', () => {
  it('accepts a valid password', () => {
    const result = validatePasswordStrength('SecurePass1')
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects password shorter than 8 characters', () => {
    const result = validatePasswordStrength('Ab1cdef')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Password must be at least 8 characters long')
  })

  it('accepts password exactly 8 characters', () => {
    const result = validatePasswordStrength('Abcdefg1')
    expect(result.valid).toBe(true)
  })

  it('rejects password longer than 128 characters', () => {
    const long = `A${'a'.repeat(127)}1`
    const result = validatePasswordStrength(long)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Password must be less than 128 characters')
  })

  it('accepts password exactly 128 characters', () => {
    const exact = `A${'a'.repeat(126)}1`
    expect(exact.length).toBe(128)
    const result = validatePasswordStrength(exact)
    expect(result.valid).toBe(true)
  })

  it('rejects password without lowercase letter', () => {
    const result = validatePasswordStrength('UPPERCASE1')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Password must contain at least one lowercase letter')
  })

  it('rejects password without uppercase letter', () => {
    const result = validatePasswordStrength('lowercase1')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Password must contain at least one uppercase letter')
  })

  it('rejects password without number', () => {
    const result = validatePasswordStrength('NoNumbersHere')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Password must contain at least one number')
  })

  it('returns multiple errors for very weak password', () => {
    const result = validatePasswordStrength('abc')
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(3)
  })

  it('accepts password with special characters', () => {
    const result = validatePasswordStrength('P@ssw0rd!#$')
    expect(result.valid).toBe(true)
  })
})

describe('meetsMinimumPasswordRequirements', () => {
  it('accepts 8-character password', () => {
    expect(meetsMinimumPasswordRequirements('12345678')).toBe(true)
  })

  it('rejects 7-character password', () => {
    expect(meetsMinimumPasswordRequirements('1234567')).toBe(false)
  })

  it('accepts 128-character password', () => {
    expect(meetsMinimumPasswordRequirements('a'.repeat(128))).toBe(true)
  })

  it('rejects 129-character password', () => {
    expect(meetsMinimumPasswordRequirements('a'.repeat(129))).toBe(false)
  })

  it('does not require uppercase or numbers', () => {
    expect(meetsMinimumPasswordRequirements('alllowercase')).toBe(true)
  })
})
