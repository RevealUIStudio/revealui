import { describe, expect, it } from 'vitest';
import { getSelectMode } from '../getSelectMode.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('getSelectMode', () => {
  it('returns include when all values are true', () => {
    expect(getSelectMode({ title: true, status: true })).toBe('include');
  });

  it('returns exclude when any value is false', () => {
    expect(getSelectMode({ title: true, password: false })).toBe('exclude');
  });

  it('returns include for empty object', () => {
    expect(getSelectMode({})).toBe('include');
  });

  it('returns exclude for nested exclude', () => {
    expect(getSelectMode({ user: { password: false } })).toBe('exclude');
  });

  it('returns include for nested include', () => {
    expect(getSelectMode({ user: { name: true } })).toBe('include');
  });

  it('ignores array values', () => {
    expect(getSelectMode({ tags: [1, 2, 3] as never })).toBe('include');
  });

  it('returns exclude for deeply nested false', () => {
    expect(getSelectMode({ a: { b: { c: false } } })).toBe('exclude');
  });
});
