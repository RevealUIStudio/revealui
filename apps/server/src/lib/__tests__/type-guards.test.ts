import { describe, expect, it } from 'vitest';
import { asNonEmptyTuple, getStripeField } from '../type-guards.js';

// ---------------------------------------------------------------------------
// Tests  -  asNonEmptyTuple
// ---------------------------------------------------------------------------
describe('asNonEmptyTuple', () => {
  it('returns a tuple from a single-element array', () => {
    const result = asNonEmptyTuple(['active']);
    expect(result).toEqual(['active']);
  });

  it('returns a tuple from a multi-element array', () => {
    const values = ['draft', 'published', 'archived'] as const;
    const result = asNonEmptyTuple(values);
    expect(result).toEqual(['draft', 'published', 'archived']);
  });

  it('preserves element order', () => {
    const values = ['z', 'a', 'm'] as const;
    const result = asNonEmptyTuple(values);
    expect(result[0]).toBe('z');
    expect(result[1]).toBe('a');
    expect(result[2]).toBe('m');
  });

  it('throws on empty array', () => {
    expect(() => asNonEmptyTuple([])).toThrow('Expected a non-empty array for z.enum()');
  });

  it('works with readonly const arrays', () => {
    const statuses = ['open', 'closed', 'pending'] as const;
    const result = asNonEmptyTuple(statuses);
    // The result should be usable as [string, ...string[]]
    expect(result.length).toBe(3);
    expect(result[0]).toBe('open');
  });

  it('works with a two-element array', () => {
    const result = asNonEmptyTuple(['yes', 'no']);
    expect(result).toEqual(['yes', 'no']);
    expect(result.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Tests  -  getStripeField
// ---------------------------------------------------------------------------
describe('getStripeField', () => {
  describe('with valid inputs', () => {
    it('returns the field value when it exists', () => {
      const obj = { id: 'cus_123', email: 'user@example.com' };
      expect(getStripeField<string>(obj, 'email')).toBe('user@example.com');
    });

    it('returns numeric field values', () => {
      const obj = { amount: 2500, currency: 'usd' };
      expect(getStripeField<number>(obj, 'amount')).toBe(2500);
    });

    it('returns boolean field values', () => {
      const obj = { active: true, livemode: false };
      expect(getStripeField<boolean>(obj, 'active')).toBe(true);
      expect(getStripeField<boolean>(obj, 'livemode')).toBe(false);
    });

    it('returns null field values (field exists but is null)', () => {
      const obj = { description: null, id: 'sub_123' };
      expect(getStripeField<string | null>(obj, 'description')).toBeNull();
    });

    it('returns undefined field values (field exists but is undefined)', () => {
      const obj = { metadata: undefined, id: 'inv_123' };
      expect(getStripeField<undefined>(obj, 'metadata')).toBeUndefined();
    });

    it('returns nested object field values', () => {
      const obj = { metadata: { key: 'value' }, id: 'pm_123' };
      const result = getStripeField<{ key: string }>(obj, 'metadata');
      expect(result).toEqual({ key: 'value' });
    });

    it('returns array field values', () => {
      const obj = { items: [1, 2, 3], id: 'il_123' };
      expect(getStripeField<number[]>(obj, 'items')).toEqual([1, 2, 3]);
    });

    it('returns zero without treating it as falsy', () => {
      const obj = { count: 0 };
      expect(getStripeField<number>(obj, 'count')).toBe(0);
    });

    it('returns empty string without treating it as falsy', () => {
      const obj = { name: '' };
      expect(getStripeField<string>(obj, 'name')).toBe('');
    });
  });

  describe('with invalid inputs', () => {
    it('returns undefined when field does not exist', () => {
      const obj = { id: 'cus_123' };
      expect(getStripeField<string>(obj, 'nonexistent')).toBeUndefined();
    });

    it('returns undefined for null input', () => {
      // null is technically not a valid object, but the guard handles it
      expect(getStripeField<string>(null as unknown as object, 'field')).toBeUndefined();
    });

    it('returns undefined for undefined input', () => {
      expect(getStripeField<string>(undefined as unknown as object, 'field')).toBeUndefined();
    });

    it('returns undefined for primitive number input', () => {
      expect(getStripeField<string>(42 as unknown as object, 'field')).toBeUndefined();
    });

    it('returns undefined for primitive string input', () => {
      // Strings are objects but 'field' won't be in them
      expect(getStripeField<string>('hello' as unknown as object, 'field')).toBeUndefined();
    });

    it('returns undefined for primitive boolean input', () => {
      expect(getStripeField<string>(true as unknown as object, 'field')).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('handles empty objects', () => {
      expect(getStripeField<string>({}, 'anything')).toBeUndefined();
    });

    it('handles arrays as input (arrays are objects)', () => {
      const arr = ['a', 'b', 'c'];
      // Arrays have numeric indices and 'length'
      expect(getStripeField<number>(arr, 'length')).toBe(3);
      expect(getStripeField<string>(arr, '0')).toBe('a');
    });

    it('handles objects with symbol keys gracefully', () => {
      const sym = Symbol('test');
      const obj = { [sym]: 'value', name: 'hello' };
      // getStripeField uses string keys  -  symbol key is not accessible
      expect(getStripeField<string>(obj, 'name')).toBe('hello');
    });

    it('handles deeply nested objects', () => {
      const obj = { level1: { level2: { level3: 'deep' } } };
      const result = getStripeField<{ level2: { level3: string } }>(obj, 'level1');
      expect(result).toEqual({ level2: { level3: 'deep' } });
    });

    it('handles field name that is empty string', () => {
      const obj = { '': 'empty-key-value' };
      expect(getStripeField<string>(obj, '')).toBe('empty-key-value');
    });

    it('does not traverse prototype chain unsafely', () => {
      const obj = Object.create(null);
      obj.id = 'safe';
      expect(getStripeField<string>(obj, 'id')).toBe('safe');
      // toString does not exist on null-prototype objects
      expect(getStripeField<string>(obj, 'toString')).toBeUndefined();
    });

    it('handles objects with inherited properties via in operator', () => {
      const parent = { inherited: 'from-parent' };
      const child = Object.create(parent);
      child.own = 'on-child';
      // 'in' operator checks the prototype chain
      expect(getStripeField<string>(child, 'inherited')).toBe('from-parent');
      expect(getStripeField<string>(child, 'own')).toBe('on-child');
    });
  });
});
