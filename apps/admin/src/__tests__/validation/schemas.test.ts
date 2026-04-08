import { describe, expect, it } from 'vitest';
import {
  emailSchema,
  formSubmissionSchema,
  getValidationErrors,
  passwordSchema,
  slugSchema,
  textFieldSchema,
  urlSchema,
  validateFormData,
} from '@/lib/validation/schemas';

describe('Validation Schemas', () => {
  describe('Email Validation', () => {
    it('should accept valid email addresses', () => {
      const validEmails = [
        'user@example.com',
        'test.user@example.co.uk',
        'user+tag@example.com',
        'user123@test-domain.com',
      ];

      validEmails.forEach((email) => {
        const result = emailSchema.safeParse(email);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        '',
        'invalid',
        '@example.com',
        'user@',
        'user @example.com',
        'user..test@example.com',
      ];

      invalidEmails.forEach((email) => {
        const result = emailSchema.safeParse(email);
        expect(result.success).toBe(false);
      });
    });

    it('should reject emails exceeding max length', () => {
      const longEmail = `${'a'.repeat(250)}@example.com`;
      const result = emailSchema.safeParse(longEmail);
      expect(result.success).toBe(false);
    });
  });

  describe('Password Validation', () => {
    it('should accept strong passwords', () => {
      const strongPasswords = ['Password123', 'Test1234Pass', 'MyP@ssw0rd', 'SecurePass1'];

      strongPasswords.forEach((password) => {
        const result = passwordSchema.safeParse(password);
        expect(result.success).toBe(true);
      });
    });

    it('should reject weak passwords', () => {
      const weakPasswords = [
        'short1A', // Too short
        'password123', // No uppercase
        'PASSWORD123', // No lowercase
        'PasswordTest', // No number
        'Pass1', // Too short
      ];

      weakPasswords.forEach((password) => {
        const result = passwordSchema.safeParse(password);
        expect(result.success).toBe(false);
      });
    });

    it('should enforce minimum length requirement', () => {
      const result = passwordSchema.safeParse('Pass1');
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toContain('at least 8 characters');
    });

    it('should reject passwords exceeding max length', () => {
      const longPassword = `P${'a'.repeat(128)}1`;
      const result = passwordSchema.safeParse(longPassword);
      expect(result.success).toBe(false);
    });
  });

  describe('Form Submission Validation', () => {
    it('should accept valid form submission', () => {
      const submission = {
        form: 'contact-form-123',
        submissionData: [
          { field: 'name', value: 'John Doe' },
          { field: 'email', value: 'john@example.com' },
          { field: 'message', value: 'Hello world' },
        ],
      };

      const result = formSubmissionSchema.safeParse(submission);
      expect(result.success).toBe(true);
    });

    it('should reject submission without form ID', () => {
      const submission = {
        form: '',
        submissionData: [],
      };

      const result = formSubmissionSchema.safeParse(submission);
      expect(result.success).toBe(false);
    });

    it('should accept different value types', () => {
      const submission = {
        form: 'test-form',
        submissionData: [
          { field: 'text', value: 'string value' },
          { field: 'number', value: 42 },
          { field: 'boolean', value: true },
          { field: 'array', value: ['option1', 'option2'] },
          { field: 'null', value: null },
        ],
      };

      const result = formSubmissionSchema.safeParse(submission);
      expect(result.success).toBe(true);
    });
  });

  describe('Text Field Validation', () => {
    it('should trim whitespace from text', () => {
      const result = textFieldSchema.parse('  test value  ');
      expect(result).toBe('test value');
    });

    it('should reject empty strings', () => {
      const result = textFieldSchema.safeParse('');
      expect(result.success).toBe(false);
    });

    it('should enforce max length', () => {
      const longText = 'a'.repeat(1001);
      const result = textFieldSchema.safeParse(longText);
      expect(result.success).toBe(false);
    });
  });

  describe('URL Validation', () => {
    it('should accept valid URLs', () => {
      const validUrls = [
        'https://example.com',
        'http://localhost:3000',
        'https://example.com/path/to/page',
        'https://example.com?query=param',
      ];

      validUrls.forEach((url) => {
        const result = urlSchema.safeParse(url);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid URLs', () => {
      const invalidUrls = ['', 'not-a-url', '//example.com'];

      invalidUrls.forEach((url) => {
        const result = urlSchema.safeParse(url);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Slug Validation', () => {
    it('should accept valid slugs', () => {
      const validSlugs = ['my-page', 'about-us', 'product-123', 'hello-world'];

      validSlugs.forEach((slug) => {
        const result = slugSchema.safeParse(slug);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid slugs', () => {
      const invalidSlugs = [
        'My Page', // Spaces
        'PAGE-NAME', // Uppercase
        'page_name', // Underscores
        'page/name', // Slashes
        '-page', // Leading hyphen
        'page-', // Trailing hyphen
      ];

      invalidSlugs.forEach((slug) => {
        const result = slugSchema.safeParse(slug);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Validation Utility Functions', () => {
    it('should return validated data on success', () => {
      const result = validateFormData(emailSchema, 'test@example.com');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('test@example.com');
      }
    });

    it('should return errors on validation failure', () => {
      const result = validateFormData(emailSchema, 'invalid-email');
      expect(result.success).toBe(false);
    });

    it('should extract error messages correctly', () => {
      const result = passwordSchema.safeParse('weak');
      expect(result.success).toBe(false);

      if (!result.success) {
        const errors = getValidationErrors(result.error);
        expect(Object.keys(errors).length).toBeGreaterThan(0);
      }
    });
  });
});
