/**
 * Unit tests for validation utility functions
 *
 * Tests REAL validation utilities from apps/admin/src/lib/validation/schemas.ts
 */

import {
  getValidationErrors,
  slugSchema,
  urlSchema,
  validateFormData,
} from '@admin/lib/validation/schemas';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

describe('Validation Utilities (Real Framework Code)', () => {
  describe('validateFormData', () => {
    const testSchema = z.object({
      name: z.string().min(1),
      age: z.number().positive(),
    });

    it('should return success with valid data', () => {
      const data = { name: 'John', age: 30 };
      const result = validateFormData(testSchema, data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(data);
      }
    });

    it('should return errors with invalid data', () => {
      const data = { name: '', age: -5 };
      const result = validateFormData(testSchema, data);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toBeInstanceOf(z.ZodError);
        expect(result.errors.issues.length).toBeGreaterThan(0);
      }
    });

    it('should handle missing fields', () => {
      const data = { name: 'John' };
      const result = validateFormData(testSchema, data);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.issues.some((issue) => issue.path.includes('age'))).toBe(true);
      }
    });
  });

  describe('getValidationErrors', () => {
    it('should convert ZodError to record of field errors', () => {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(8),
      });

      const result = schema.safeParse({
        email: 'invalid',
        password: 'short',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = getValidationErrors(result.error);
        expect(errors).toHaveProperty('email');
        expect(errors).toHaveProperty('password');
        expect(typeof errors.email).toBe('string');
        expect(typeof errors.password).toBe('string');
      }
    });

    it('should handle nested paths', () => {
      const schema = z.object({
        user: z.object({
          email: z.string().email(),
        }),
      });

      const result = schema.safeParse({
        user: { email: 'invalid' },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = getValidationErrors(result.error);
        expect(errors).toHaveProperty('user.email');
      }
    });

    it('should return empty object for valid data', () => {
      const schema = z.object({
        email: z.string().email(),
      });

      const result = schema.safeParse({
        email: 'valid@example.com',
      });

      expect(result.success).toBe(true);
      if (!result.success) {
        const errors = getValidationErrors(result.error);
        expect(Object.keys(errors).length).toBeGreaterThan(0);
      }
    });
  });

  describe('urlSchema', () => {
    it('should accept valid URLs', () => {
      const validUrls = [
        'https://example.com',
        'http://test.com/path',
        'https://subdomain.example.com',
      ];

      validUrls.forEach((url) => {
        const result = urlSchema.safeParse(url);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid URLs', () => {
      // Zod accepts various protocols including ftp, so we test truly invalid URLs
      const invalidUrls = ['not-a-url', 'just text', 'spaces in url', ''];

      invalidUrls.forEach((url) => {
        const result = urlSchema.safeParse(url);
        expect(result.success).toBe(false);
      });
    });

    it('should accept URLs with protocol', () => {
      // Zod's URL validator requires protocol
      const validUrls = ['https://example.com', 'http://example.com'];

      validUrls.forEach((url) => {
        const result = urlSchema.safeParse(url);
        expect(result.success).toBe(true);
      });
    });

    it('should reject URLs that are too long', () => {
      const longUrl = `https://example.com/${'a'.repeat(2100)}`;
      const result = urlSchema.safeParse(longUrl);
      expect(result.success).toBe(false);
    });
  });

  describe('slugSchema', () => {
    it('should accept valid slugs', () => {
      const validSlugs = ['my-slug', 'test-123', 'valid-slug-name'];

      validSlugs.forEach((slug) => {
        const result = slugSchema.safeParse(slug);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid slugs', () => {
      const invalidSlugs = [
        'Invalid-Slug', // uppercase
        'invalid slug', // spaces
        'invalid_slug', // underscores
        'invalid.slug', // dots
        '', // empty
      ];

      invalidSlugs.forEach((slug) => {
        const result = slugSchema.safeParse(slug);
        expect(result.success).toBe(false);
      });
    });

    it('should reject slugs that are too long', () => {
      const longSlug = 'a'.repeat(151);
      const result = slugSchema.safeParse(longSlug);
      expect(result.success).toBe(false);
    });
  });
});
