import { describe, expect, it } from 'vitest';
import { deepClone } from '../memory/utils/deep-clone.js';

describe('deepClone', () => {
  describe('primitives', () => {
    it('should clone primitives', () => {
      expect(deepClone(42)).toBe(42);
      expect(deepClone('hello')).toBe('hello');
      expect(deepClone(true)).toBe(true);
      expect(deepClone(null)).toBe(null);
      expect(deepClone(undefined)).toBe(undefined);
    });
  });

  describe('Date objects', () => {
    it('should clone Date objects', () => {
      const date = new Date('2024-01-01');
      const cloned = deepClone(date);

      expect(cloned).toBeInstanceOf(Date);
      expect(cloned.getTime()).toBe(date.getTime());
      expect(cloned).not.toBe(date);
    });
  });

  describe('RegExp objects', () => {
    it('should clone RegExp objects', () => {
      const regex = /test/gi;
      const cloned = deepClone(regex);

      expect(cloned).toBeInstanceOf(RegExp);
      expect(cloned.source).toBe(regex.source);
      expect(cloned.flags).toBe(regex.flags);
      expect(cloned).not.toBe(regex);
    });
  });

  describe('arrays', () => {
    it('should clone arrays', () => {
      const arr = [1, 2, { nested: 'value' }];
      const cloned = deepClone(arr);

      expect(cloned).toEqual(arr);
      expect(cloned).not.toBe(arr);
      expect(cloned[2]).not.toBe(arr[2]);
    });

    it('should handle nested arrays', () => {
      const arr = [
        [1, 2],
        [3, 4],
      ];
      const cloned = deepClone(arr);

      expect(cloned).toEqual(arr);
      expect(cloned[0]).not.toBe(arr[0]);
    });
  });

  describe('objects', () => {
    it('should clone plain objects', () => {
      const obj = { a: 1, b: { c: 2 } };
      const cloned = deepClone(obj);

      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
      expect(cloned.b).not.toBe(obj.b);
    });

    it('should handle undefined values', () => {
      const obj = { a: 1, b: undefined, c: 2 };
      const cloned = deepClone(obj);

      // undefined should be omitted (JSON.stringify behavior)
      expect(cloned).toEqual({ a: 1, c: 2 });
      expect('b' in cloned).toBe(false);
    });

    it('should handle null values', () => {
      const obj = { a: 1, b: null };
      const cloned = deepClone(obj);

      expect(cloned).toEqual(obj);
      expect(cloned.b).toBe(null);
    });
  });

  describe('Map and Set', () => {
    it('should clone Map objects', () => {
      const map = new Map([
        ['key1', 'value1'],
        ['key2', { nested: 'value' }],
      ]);
      const cloned = deepClone(map);

      expect(cloned).toBeInstanceOf(Map);
      expect(cloned.size).toBe(map.size);
      expect(cloned.get('key1')).toBe('value1');
      expect(cloned.get('key2')).toEqual({ nested: 'value' });
      expect(cloned.get('key2')).not.toBe(map.get('key2'));
      expect(cloned).not.toBe(map);
    });

    it('should clone Set objects', () => {
      const set = new Set([1, 2, { nested: 'value' }]);
      const cloned = deepClone(set);

      expect(cloned).toBeInstanceOf(Set);
      expect(cloned.size).toBe(set.size);
      expect(cloned.has(1)).toBe(true);
      expect(cloned.has(2)).toBe(true);
      expect(cloned).not.toBe(set);
    });
  });

  describe('TypedArrays', () => {
    it('should clone Uint8Array', () => {
      const arr = new Uint8Array([1, 2, 3, 4]);
      const cloned = deepClone(arr);

      expect(cloned).toBeInstanceOf(Uint8Array);
      expect(cloned).toEqual(arr);
      expect(cloned.buffer).not.toBe(arr.buffer);
    });

    it('should clone Int32Array', () => {
      const arr = new Int32Array([1, 2, 3]);
      const cloned = deepClone(arr);

      expect(cloned).toBeInstanceOf(Int32Array);
      expect(cloned).toEqual(arr);
    });
  });

  describe('circular references', () => {
    it('should throw on circular references', () => {
      const obj: Record<string, unknown> = { a: 1 };
      obj.b = obj; // Create circular reference

      expect(() => deepClone(obj)).toThrow('Circular reference');
    });

    it('should throw on nested circular references', () => {
      const obj: Record<string, unknown> = { a: { b: {} } };
      (obj.a as Record<string, unknown>).b = obj.a;

      expect(() => deepClone(obj)).toThrow('Circular reference');
    });
  });

  describe('functions and symbols', () => {
    it('should return functions as-is', () => {
      const fn = () => 'test';
      const cloned = deepClone(fn);

      expect(cloned).toBe(fn); // Functions are returned as-is
    });

    it('should return symbols as-is', () => {
      const sym = Symbol('test');
      const cloned = deepClone(sym);

      expect(cloned).toBe(sym); // Symbols are returned as-is
    });
  });

  describe('complex nested structures', () => {
    it('should clone complex nested structures', () => {
      const obj = {
        date: new Date('2024-01-01'),
        regex: /test/gi,
        map: new Map([['key', 'value']]),
        set: new Set([1, 2, 3]),
        array: [1, { nested: 'value' }],
        nested: {
          deep: {
            value: 'test',
          },
        },
      };

      const cloned = deepClone(obj);

      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
      expect(cloned.date).not.toBe(obj.date);
      expect(cloned.regex).not.toBe(obj.regex);
      expect(cloned.map).not.toBe(obj.map);
      expect(cloned.set).not.toBe(obj.set);
      expect(cloned.array).not.toBe(obj.array);
      expect(cloned.nested).not.toBe(obj.nested);
      expect(cloned.nested.deep).not.toBe(obj.nested.deep);
    });
  });
});
