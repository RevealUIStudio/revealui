import { describe, expect, it } from 'vitest';
import {
  hasCircularReference,
  validateContext,
  validateContextKey,
  validateContextSize,
  validateContextValue,
  validateObjectDepth,
} from '../memory/utils/validation.js';

type ContextKeyInput = Parameters<typeof validateContextKey>[0];

describe('Validation Utilities', () => {
  describe('validateContextKey', () => {
    it('should accept valid keys', () => {
      expect(() => validateContextKey('validKey')).not.toThrow();
      expect(() => validateContextKey('key_123')).not.toThrow();
      expect(() => validateContextKey('a'.repeat(256))).not.toThrow();
    });

    it('should reject dangerous keys', () => {
      expect(() => validateContextKey('__proto__')).toThrow('Dangerous context key');
      expect(() => validateContextKey('constructor')).toThrow('Dangerous context key');
      expect(() => validateContextKey('prototype')).toThrow('Dangerous context key');
    });

    it('should reject invalid key types', () => {
      expect(() => validateContextKey('')).toThrow('cannot be empty');
      expect(() => validateContextKey(null as unknown as ContextKeyInput)).toThrow(
        'must be a string',
      );
      expect(() => validateContextKey(123 as unknown as ContextKeyInput)).toThrow(
        'must be a string',
      );
    });

    it('should reject keys that are too long', () => {
      expect(() => validateContextKey('a'.repeat(257))).toThrow('too long');
    });
  });

  describe('validateContextValue', () => {
    it('should accept valid values', () => {
      expect(() => validateContextValue('string', 'key')).not.toThrow();
      expect(() => validateContextValue(123, 'key')).not.toThrow();
      expect(() => validateContextValue(true, 'key')).not.toThrow();
      expect(() => validateContextValue(null, 'key')).not.toThrow();
      expect(() => validateContextValue({}, 'key')).not.toThrow();
      expect(() => validateContextValue([], 'key')).not.toThrow();
    });

    it('should reject undefined values', () => {
      expect(() => validateContextValue(undefined, 'key')).toThrow('cannot be undefined');
    });

    it('should reject functions', () => {
      expect(() => validateContextValue(() => undefined, 'key')).toThrow('cannot be functions');
    });

    it('should reject symbols', () => {
      expect(() => validateContextValue(Symbol('test'), 'key')).toThrow('cannot be symbols');
    });
  });

  describe('validateObjectDepth', () => {
    it('should accept shallow objects', () => {
      expect(() => validateObjectDepth({ a: 1, b: 2 })).not.toThrow();
    });

    it('should accept moderately nested objects', () => {
      const nested = { a: { b: { c: { d: 1 } } } };
      expect(() => validateObjectDepth(nested)).not.toThrow();
    });

    it('should reject extremely deep objects', () => {
      const deep: Record<string, unknown> = {};
      let current = deep;
      for (let i = 0; i < 101; i++) {
        const next: Record<string, unknown> = {};
        current.nested = next;
        current = next;
      }
      expect(() => validateObjectDepth(deep)).toThrow('depth exceeds maximum');
    });

    it('should handle arrays', () => {
      expect(() => validateObjectDepth([1, 2, 3])).not.toThrow();
      expect(() => validateObjectDepth([[1, [2, [3]]]])).not.toThrow();
    });
  });

  describe('validateContextSize', () => {
    it('should accept normal-sized contexts', () => {
      const context: Record<string, unknown> = {};
      for (let i = 0; i < 100; i++) {
        context[`key${i}`] = `value${i}`;
      }
      expect(() => validateContextSize(context)).not.toThrow();
    });

    it('should reject contexts with too many keys', () => {
      const context: Record<string, unknown> = {};
      for (let i = 0; i < 10001; i++) {
        context[`key${i}`] = `value${i}`;
      }
      expect(() => validateContextSize(context)).toThrow('too many keys');
    });
  });

  describe('validateContext', () => {
    it('should accept valid contexts', () => {
      const context = {
        theme: 'dark',
        user: { name: 'John', age: 30 },
        tags: ['important', 'urgent'],
      };
      expect(() => validateContext(context)).not.toThrow();
    });

    it('should reject contexts with dangerous keys', () => {
      // Note: __proto__ is not enumerable, so we need to use Object.create(null)
      // or set it directly. For this test, we'll use a different dangerous key.
      const context: Record<string, unknown> = {
        constructor: { polluted: true },
        normal: 'value',
      };
      expect(() => validateContext(context)).toThrow('Dangerous context key');

      // Test __proto__ separately using Object.defineProperty
      const protoContext: Record<string, unknown> = { normal: 'value' };
      Object.defineProperty(protoContext, '__proto__', {
        value: { polluted: true },
        enumerable: true,
        configurable: true,
      });
      expect(() => validateContext(protoContext)).toThrow('Dangerous context key');
    });

    it('should reject contexts with undefined values', () => {
      const context = {
        valid: 'value',
        invalid: undefined,
      } as Record<string, unknown>;
      expect(() => validateContext(context)).toThrow('cannot be undefined');
    });

    it('should reject contexts with functions', () => {
      const context = {
        valid: 'value',
        invalid: () => undefined,
      };
      expect(() => validateContext(context)).toThrow('cannot be functions');
    });
  });

  describe('hasCircularReference', () => {
    it('should detect circular references', () => {
      const obj: { a: number; self?: unknown } = { a: 1 };
      obj.self = obj;
      expect(hasCircularReference(obj)).toBe(true);
    });

    it('should detect nested circular references', () => {
      const obj: { a: { b: { c: { self?: unknown } } } } = { a: { b: { c: {} } } };
      obj.a.b.c.self = obj;
      expect(hasCircularReference(obj)).toBe(true);
    });

    it('should return false for non-circular objects', () => {
      expect(hasCircularReference({ a: 1, b: { c: 2 } })).toBe(false);
      expect(hasCircularReference([1, 2, 3])).toBe(false);
      expect(hasCircularReference('string')).toBe(false);
      expect(hasCircularReference(null)).toBe(false);
    });

    it('should handle arrays with circular references', () => {
      const arr: unknown[] = [1, 2];
      arr.push(arr);
      expect(hasCircularReference(arr)).toBe(true);
    });
  });
});
