import { describe, expect, it } from 'vitest';
import { isValidID } from '../isValidID.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('isValidID', () => {
  describe('text IDs (default)', () => {
    it('accepts non-empty strings', () => {
      expect(isValidID('abc')).toBe(true);
      expect(isValidID('123')).toBe(true);
      expect(isValidID('a')).toBe(true);
    });

    it('rejects empty strings', () => {
      expect(isValidID('')).toBe(false);
    });

    it('accepts finite numbers as text IDs', () => {
      expect(isValidID(42)).toBe(true);
      expect(isValidID(0)).toBe(true);
    });

    it('rejects NaN', () => {
      expect(isValidID(Number.NaN)).toBe(false);
    });

    it('rejects Infinity', () => {
      expect(isValidID(Number.POSITIVE_INFINITY)).toBe(false);
    });

    it('rejects non-string/non-number types', () => {
      expect(isValidID(null)).toBe(false);
      expect(isValidID(undefined)).toBe(false);
      expect(isValidID(true)).toBe(false);
      expect(isValidID({})).toBe(false);
    });
  });

  describe('number IDs', () => {
    it('accepts finite numbers', () => {
      expect(isValidID(1, 'number')).toBe(true);
      expect(isValidID(0, 'number')).toBe(true);
      expect(isValidID(-1, 'number')).toBe(true);
    });

    it('rejects NaN', () => {
      expect(isValidID(Number.NaN, 'number')).toBe(false);
    });

    it('rejects Infinity', () => {
      expect(isValidID(Number.POSITIVE_INFINITY, 'number')).toBe(false);
    });

    it('rejects strings', () => {
      expect(isValidID('42', 'number')).toBe(false);
    });

    it('rejects null/undefined', () => {
      expect(isValidID(null, 'number')).toBe(false);
      expect(isValidID(undefined, 'number')).toBe(false);
    });
  });
});
