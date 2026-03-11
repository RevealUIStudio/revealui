import { describe, expect, it, vi } from 'vitest';
import { getDefaultValue } from '../getDefaultValue.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('getDefaultValue', () => {
  it('returns static default value', () => {
    const result = getDefaultValue({
      field: { name: 'status', type: 'select', defaultValue: 'draft' } as never,
    });
    expect(result).toBe('draft');
  });

  it('returns numeric default value', () => {
    const result = getDefaultValue({
      field: { name: 'order', type: 'number', defaultValue: 0 } as never,
    });
    expect(result).toBe(0);
  });

  it('returns boolean default value', () => {
    const result = getDefaultValue({
      field: { name: 'published', type: 'checkbox', defaultValue: false } as never,
    });
    expect(result).toBe(false);
  });

  it('calls function default value with locale and user', () => {
    const defaultFn = vi.fn().mockReturnValue('generated');
    const result = getDefaultValue({
      field: { name: 'slug', type: 'text', defaultValue: defaultFn } as never,
      locale: 'en',
      user: { id: 'user-1' },
    });

    expect(result).toBe('generated');
    expect(defaultFn).toHaveBeenCalledWith({ locale: 'en', user: { id: 'user-1' } });
  });

  it('passes null locale to function', () => {
    const defaultFn = vi.fn().mockReturnValue('value');
    getDefaultValue({
      field: { name: 'field', type: 'text', defaultValue: defaultFn } as never,
      locale: null,
    });

    expect(defaultFn).toHaveBeenCalledWith({ locale: null, user: undefined });
  });

  it('returns undefined for fields without defaultValue', () => {
    const result = getDefaultValue({
      field: { name: 'title', type: 'text' } as never,
    });
    expect(result).toBeUndefined();
  });

  it('returns array default value', () => {
    const result = getDefaultValue({
      field: { name: 'tags', type: 'array', defaultValue: [] } as never,
    });
    expect(result).toEqual([]);
  });

  it('returns object default value', () => {
    const defaultObj = { key: 'value' };
    const result = getDefaultValue({
      field: { name: 'meta', type: 'json', defaultValue: defaultObj } as never,
    });
    expect(result).toBe(defaultObj);
  });
});
