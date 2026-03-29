/**
 * cn (className utility) Tests
 *
 * Tests the Tailwind CSS className merging utility function.
 */

import { describe, expect, it } from 'vitest';
import { cn, cva } from '../../utils/cn';

describe('cn', () => {
  it('should join string classNames', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should filter out falsy values', () => {
    expect(cn('foo', null, undefined, false, 'bar')).toBe('foo bar');
  });

  it('should handle empty arguments', () => {
    expect(cn()).toBe('');
  });

  it('should handle single string', () => {
    expect(cn('only-class')).toBe('only-class');
  });

  it('should convert numbers to strings', () => {
    expect(cn('text', 100)).toBe('text 100');
  });

  it('should handle object syntax with truthy values', () => {
    expect(cn({ active: true, disabled: false })).toBe('active');
  });

  it('should handle mixed string and object', () => {
    expect(cn('base', { active: true, hidden: false }, 'extra')).toBe('base active extra');
  });

  it('should handle all falsy object values', () => {
    expect(cn({ a: false, b: false })).toBe('');
  });

  it('should handle boolean false directly', () => {
    expect(cn(false)).toBe('');
  });

  it('should trim result', () => {
    const result = cn('foo', 'bar');
    expect(result).toBe(result.trim());
  });

  it('should handle array arguments', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });

  it('should handle nested arrays', () => {
    expect(cn(['foo', ['bar', 'baz']])).toBe('foo bar baz');
  });

  it('should handle arrays with falsy values', () => {
    expect(cn(['base', false, 'extra'])).toBe('base extra');
  });

  it('should handle mixed arrays and strings', () => {
    expect(cn('prefix', ['a', 'b'], 'suffix')).toBe('prefix a b suffix');
  });
});

describe('cva', () => {
  const button = cva('btn-base', {
    variants: {
      size: { sm: 'btn-sm', md: 'btn-md', lg: 'btn-lg' },
      color: { red: 'btn-red', blue: 'btn-blue' },
    },
    defaultVariants: { size: 'md', color: 'blue' },
  });

  it('should return base with defaults when called with no args', () => {
    expect(button()).toBe('btn-base btn-md btn-blue');
  });

  it('should override defaults with provided variants', () => {
    expect(button({ size: 'lg' })).toBe('btn-base btn-lg btn-blue');
  });

  it('should apply all provided variants', () => {
    expect(button({ size: 'sm', color: 'red' })).toBe('btn-base btn-sm btn-red');
  });

  it('should append className', () => {
    expect(button({ className: 'extra' })).toBe('btn-base btn-md btn-blue extra');
  });

  it('should skip null variant values and use default', () => {
    expect(button({ size: null })).toBe('btn-base btn-blue');
  });

  it('should handle empty variant string', () => {
    const withEmpty = cva('base', {
      variants: { mode: { normal: 'mode-normal', clear: '' } },
      defaultVariants: { mode: 'normal' },
    });
    expect(withEmpty({ mode: 'clear' })).toBe('base');
  });
});
