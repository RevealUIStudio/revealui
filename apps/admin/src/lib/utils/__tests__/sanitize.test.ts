import { describe, expect, it } from 'vitest';
import { sanitizeEmail, sanitizeName, sanitizeString } from '../sanitize';

describe('sanitizeString', () => {
  it('trims whitespace', () => {
    expect(sanitizeString('  hello  ')).toBe('hello');
  });

  it('removes control characters', () => {
    expect(sanitizeString('he\x00llo\x01')).toBe('hello');
    expect(sanitizeString('test\x7f')).toBe('test');
  });

  it('preserves tabs, newlines, and carriage returns', () => {
    expect(sanitizeString('line1\nline2')).toBe('line1\nline2');
    expect(sanitizeString('col1\tcol2')).toBe('col1\tcol2');
    expect(sanitizeString('line1\r\nline2')).toBe('line1\r\nline2');
  });

  it('truncates to maxLength', () => {
    expect(sanitizeString('abcdefgh', 5)).toBe('abcde');
  });

  it('defaults maxLength to 255', () => {
    const long = 'a'.repeat(300);
    expect(sanitizeString(long)).toHaveLength(255);
  });

  it('returns empty string for non-string input', () => {
    expect(sanitizeString(123 as unknown as string)).toBe('');
    expect(sanitizeString(null as unknown as string)).toBe('');
  });

  it('handles empty string', () => {
    expect(sanitizeString('')).toBe('');
  });
});

describe('sanitizeName', () => {
  it('removes HTML tags', () => {
    expect(sanitizeName('hello <b>world</b>')).toBe('hello world');
  });

  it('removes script tags', () => {
    expect(sanitizeName('<script>alert("xss")</script>')).toBe('alert("xss")');
  });

  it('removes javascript: URIs', () => {
    expect(sanitizeName('javascript:alert(1)')).toBe('alert(1)');
    expect(sanitizeName('JAVASCRIPT:void(0)')).toBe('void(0)');
  });

  it('removes event handlers', () => {
    expect(sanitizeName('test onclick=alert(1)')).toBe('test alert(1)');
    expect(sanitizeName('test onerror=hack()')).toBe('test hack()');
    expect(sanitizeName('test ONLOAD=x()')).toBe('test x()');
  });

  it('handles nested tags', () => {
    expect(sanitizeName('<div><span>text</span></div>')).toBe('text');
  });

  it('respects custom maxLength', () => {
    expect(sanitizeName('abcdefghij', 5)).toBe('abcde');
  });
});

describe('sanitizeEmail', () => {
  it('returns sanitized valid email', () => {
    expect(sanitizeEmail('User@Example.COM')).toBe('user@example.com');
  });

  it('trims whitespace', () => {
    expect(sanitizeEmail('  user@test.com  ')).toBe('user@test.com');
  });

  it('returns null for invalid format', () => {
    expect(sanitizeEmail('notanemail')).toBeNull();
    expect(sanitizeEmail('missing@tld')).toBeNull();
    expect(sanitizeEmail('@no-local.com')).toBeNull();
  });

  it('returns null for emails exceeding 254 chars', () => {
    const longLocal = 'a'.repeat(250);
    expect(sanitizeEmail(`${longLocal}@test.com`)).toBeNull();
  });

  it('returns null for non-string input', () => {
    expect(sanitizeEmail(42 as unknown as string)).toBeNull();
  });

  it('accepts valid edge cases', () => {
    expect(sanitizeEmail('a@b.co')).toBe('a@b.co');
    expect(sanitizeEmail('user+tag@example.com')).toBe('user+tag@example.com');
  });
});
