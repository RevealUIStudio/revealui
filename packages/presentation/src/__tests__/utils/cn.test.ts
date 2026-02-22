/**
 * cn (className utility) Tests
 *
 * Tests the Tailwind CSS className merging utility function.
 */

import { describe, expect, it } from 'vitest'
import { cn } from '../../utils/cn'

describe('cn', () => {
  it('should join string classNames', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('should filter out falsy values', () => {
    expect(cn('foo', null, undefined, false, 'bar')).toBe('foo bar')
  })

  it('should handle empty arguments', () => {
    expect(cn()).toBe('')
  })

  it('should handle single string', () => {
    expect(cn('only-class')).toBe('only-class')
  })

  it('should convert numbers to strings', () => {
    expect(cn('text', 100)).toBe('text 100')
  })

  it('should handle object syntax with truthy values', () => {
    expect(cn({ active: true, disabled: false })).toBe('active')
  })

  it('should handle mixed string and object', () => {
    expect(cn('base', { active: true, hidden: false }, 'extra')).toBe('base active extra')
  })

  it('should handle all falsy object values', () => {
    expect(cn({ a: false, b: false })).toBe('')
  })

  it('should handle boolean false directly', () => {
    expect(cn(false)).toBe('')
  })

  it('should trim result', () => {
    const result = cn('foo', 'bar')
    expect(result).toBe(result.trim())
  })
})
