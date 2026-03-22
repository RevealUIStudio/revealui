import { describe, expect, it } from 'vitest';
import { dateToString, nullableDateToString } from '../serialize.js';

describe('dateToString', () => {
  it('converts a Date to an ISO 8601 string', () => {
    const d = new Date('2025-06-15T12:00:00.000Z');
    expect(dateToString(d)).toBe('2025-06-15T12:00:00.000Z');
  });

  it('passes through a string unchanged', () => {
    expect(dateToString('2025-06-15T12:00:00.000Z')).toBe('2025-06-15T12:00:00.000Z');
  });

  it('passes through any arbitrary string (no parsing)', () => {
    expect(dateToString('not-a-date')).toBe('not-a-date');
  });
});

describe('nullableDateToString', () => {
  it('returns null for null input', () => {
    expect(nullableDateToString(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(nullableDateToString(undefined)).toBeNull();
  });

  it('converts a Date to an ISO 8601 string', () => {
    const d = new Date('2025-01-01T00:00:00.000Z');
    expect(nullableDateToString(d)).toBe('2025-01-01T00:00:00.000Z');
  });

  it('passes through a string unchanged', () => {
    expect(nullableDateToString('2025-01-01T00:00:00.000Z')).toBe('2025-01-01T00:00:00.000Z');
  });

  it('passes through an empty string', () => {
    expect(nullableDateToString('')).toBe('');
  });
});
