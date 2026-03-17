import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { isFormContentType, isJSONContentType, isZod } from '../type-guard.js';

describe('isZod', () => {
  it('returns true for a Zod schema', () => {
    expect(isZod(z.string())).toBe(true);
  });

  it('returns true for a Zod object schema', () => {
    expect(isZod(z.object({ name: z.string() }))).toBe(true);
  });

  it('returns false for null', () => {
    expect(isZod(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isZod(undefined)).toBe(false);
  });

  it('returns false for a plain object', () => {
    expect(isZod({ parse: 'not a function' })).toBe(false);
  });

  it('returns false for a number', () => {
    expect(isZod(42)).toBe(false);
  });
});

describe('isJSONContentType', () => {
  it('matches application/json', () => {
    expect(isJSONContentType('application/json')).toBe(true);
  });

  it('matches application/vnd.api+json', () => {
    expect(isJSONContentType('application/vnd.api+json')).toBe(true);
  });

  it('matches application/json; charset=utf-8', () => {
    expect(isJSONContentType('application/json; charset=utf-8')).toBe(true);
  });

  it('does not match text/plain', () => {
    expect(isJSONContentType('text/plain')).toBe(false);
  });

  it('does not match multipart/form-data', () => {
    expect(isJSONContentType('multipart/form-data')).toBe(false);
  });
});

describe('isFormContentType', () => {
  it('matches multipart/form-data', () => {
    expect(isFormContentType('multipart/form-data')).toBe(true);
  });

  it('matches application/x-www-form-urlencoded', () => {
    expect(isFormContentType('application/x-www-form-urlencoded')).toBe(true);
  });

  it('matches multipart/form-data with boundary', () => {
    expect(isFormContentType('multipart/form-data; boundary=----WebKitFormBoundary')).toBe(true);
  });

  it('does not match application/json', () => {
    expect(isFormContentType('application/json')).toBe(false);
  });
});
