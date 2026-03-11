import { describe, expect, it } from 'vitest';
import { passwordSchema } from '../validation/password-schema.js';

describe('Password Schema', () => {
  it('accepts a valid password', () => {
    const result = passwordSchema.safeParse('Abc12345');
    expect(result.success).toBe(true);
  });

  it('accepts a complex password', () => {
    const result = passwordSchema.safeParse('MyStr0ngP@ssw0rd!');
    expect(result.success).toBe(true);
  });

  it('rejects passwords shorter than 8 characters', () => {
    const result = passwordSchema.safeParse('Ab1cdef');
    expect(result.success).toBe(false);
  });

  it('rejects passwords longer than 128 characters', () => {
    const result = passwordSchema.safeParse(`A1${'a'.repeat(127)}`);
    expect(result.success).toBe(false);
  });

  it('rejects passwords without uppercase letters', () => {
    const result = passwordSchema.safeParse('abc12345');
    expect(result.success).toBe(false);
  });

  it('rejects passwords without lowercase letters', () => {
    const result = passwordSchema.safeParse('ABC12345');
    expect(result.success).toBe(false);
  });

  it('rejects passwords without numbers', () => {
    const result = passwordSchema.safeParse('Abcdefgh');
    expect(result.success).toBe(false);
  });

  it('accepts passwords at exactly 8 characters', () => {
    const result = passwordSchema.safeParse('Abcdef1x');
    expect(result.success).toBe(true);
  });

  it('accepts passwords at exactly 128 characters', () => {
    const password = `A1${'a'.repeat(126)}`;
    expect(password.length).toBe(128);
    const result = passwordSchema.safeParse(password);
    expect(result.success).toBe(true);
  });
});
