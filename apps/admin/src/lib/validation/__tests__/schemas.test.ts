import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import {
  emailSchema,
  formSubmissionSchema,
  getValidationErrors,
  numberFieldSchema,
  paginationSchema,
  slugSchema,
  stripeWebhookSchema,
  tenantIdSchema,
  textareaFieldSchema,
  textFieldSchema,
  urlSchema,
  userRoleSchema,
  validateFormData,
  webhookSignatureSchema,
} from '../schemas';

describe('emailSchema', () => {
  it('accepts valid email', () => {
    expect(emailSchema.parse('user@example.com')).toBe('user@example.com');
  });

  it('rejects empty string', () => {
    expect(() => emailSchema.parse('')).toThrow();
  });

  it('rejects invalid format', () => {
    expect(() => emailSchema.parse('not-an-email')).toThrow();
  });

  it('rejects email exceeding 255 chars', () => {
    const long = `${'a'.repeat(250)}@test.com`;
    expect(() => emailSchema.parse(long)).toThrow();
  });
});

describe('formSubmissionSchema', () => {
  it('accepts valid submission', () => {
    const data = {
      form: 'contact-form',
      submissionData: [
        { field: 'name', value: 'John' },
        { field: 'age', value: 30 },
        { field: 'agree', value: true },
        { field: 'tags', value: ['a', 'b'] },
        { field: 'optional', value: null },
      ],
    };
    expect(() => formSubmissionSchema.parse(data)).not.toThrow();
  });

  it('rejects empty form ID', () => {
    expect(() => formSubmissionSchema.parse({ form: '', submissionData: [] })).toThrow();
  });

  it('rejects invalid field value type', () => {
    expect(() =>
      formSubmissionSchema.parse({
        form: 'f',
        submissionData: [{ field: 'x', value: { nested: true } }],
      }),
    ).toThrow();
  });
});

describe('textFieldSchema', () => {
  it('accepts and trims valid text', () => {
    expect(textFieldSchema.parse('  hello  ')).toBe('hello');
  });

  it('rejects empty string', () => {
    expect(() => textFieldSchema.parse('')).toThrow();
  });

  it('rejects text exceeding 1000 chars', () => {
    expect(() => textFieldSchema.parse('a'.repeat(1001))).toThrow();
  });
});

describe('textareaFieldSchema', () => {
  it('accepts and trims valid text', () => {
    expect(textareaFieldSchema.parse(' paragraph ')).toBe('paragraph');
  });

  it('rejects text exceeding 5000 chars', () => {
    expect(() => textareaFieldSchema.parse('a'.repeat(5001))).toThrow();
  });
});

describe('numberFieldSchema', () => {
  it('accepts a number', () => {
    expect(numberFieldSchema.parse(42)).toBe(42);
  });

  it('accepts a numeric string and coerces to number', () => {
    expect(numberFieldSchema.parse('123')).toBe(123);
  });

  it('rejects negative numbers', () => {
    expect(() => numberFieldSchema.parse(-1)).toThrow();
  });

  it('rejects non-numeric strings', () => {
    expect(() => numberFieldSchema.parse('abc')).toThrow();
  });
});

describe('urlSchema', () => {
  it('accepts valid URL', () => {
    expect(urlSchema.parse('https://example.com')).toBe('https://example.com');
  });

  it('rejects invalid URL', () => {
    expect(() => urlSchema.parse('not a url')).toThrow();
  });

  it('rejects URL exceeding 2048 chars', () => {
    expect(() => urlSchema.parse(`https://example.com/${'a'.repeat(2040)}`)).toThrow();
  });
});

describe('slugSchema', () => {
  it('accepts valid slug', () => {
    expect(slugSchema.parse('my-post-title')).toBe('my-post-title');
  });

  it('accepts single word', () => {
    expect(slugSchema.parse('hello')).toBe('hello');
  });

  it('rejects uppercase', () => {
    expect(() => slugSchema.parse('My-Post')).toThrow();
  });

  it('rejects leading/trailing hyphens', () => {
    expect(() => slugSchema.parse('-leading')).toThrow();
    expect(() => slugSchema.parse('trailing-')).toThrow();
  });

  it('rejects consecutive hyphens', () => {
    expect(() => slugSchema.parse('double--hyphen')).toThrow();
  });

  it('rejects spaces', () => {
    expect(() => slugSchema.parse('has space')).toThrow();
  });
});

describe('webhookSignatureSchema', () => {
  it('accepts valid signature and payload', () => {
    const data = { signature: 'sig_abc123', payload: '{"event":"test"}' };
    expect(() => webhookSignatureSchema.parse(data)).not.toThrow();
  });

  it('rejects empty signature', () => {
    expect(() => webhookSignatureSchema.parse({ signature: '', payload: 'x' })).toThrow();
  });
});

describe('stripeWebhookSchema', () => {
  it('accepts valid stripe event', () => {
    const event = {
      id: 'evt_123',
      object: 'event',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_123' } },
    };
    expect(() => stripeWebhookSchema.parse(event)).not.toThrow();
  });

  it('rejects non-event object literal', () => {
    expect(() =>
      stripeWebhookSchema.parse({
        id: 'evt_123',
        object: 'charge',
        type: 'test',
        data: { object: {} },
      }),
    ).toThrow();
  });
});

describe('tenantIdSchema', () => {
  it('accepts non-empty string', () => {
    expect(tenantIdSchema.parse('tenant-abc')).toBe('tenant-abc');
  });

  it('rejects empty string', () => {
    expect(() => tenantIdSchema.parse('')).toThrow();
  });
});

describe('userRoleSchema', () => {
  it('accepts all valid roles', () => {
    for (const role of ['super-admin', 'admin', 'tenant-super-admin', 'tenant-admin']) {
      expect(userRoleSchema.parse(role)).toBe(role);
    }
  });

  it('rejects invalid role', () => {
    expect(() => userRoleSchema.parse('viewer')).toThrow();
  });
});

describe('paginationSchema', () => {
  it('applies defaults', () => {
    const result = paginationSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
  });

  it('accepts valid values', () => {
    const result = paginationSchema.parse({ page: 3, limit: 50 });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(50);
  });

  it('rejects limit exceeding 100', () => {
    expect(() => paginationSchema.parse({ page: 1, limit: 101 })).toThrow();
  });

  it('rejects non-positive page', () => {
    expect(() => paginationSchema.parse({ page: 0 })).toThrow();
  });
});

describe('validateFormData', () => {
  it('returns success with parsed data', () => {
    const result = validateFormData(emailSchema, 'test@example.com');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('test@example.com');
    }
  });

  it('returns failure with errors', () => {
    const result = validateFormData(emailSchema, 'invalid');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toBeInstanceOf(z.ZodError);
    }
  });
});

describe('getValidationErrors', () => {
  it('formats errors as path-to-message record', () => {
    const result = formSubmissionSchema.safeParse({ form: '', submissionData: 'bad' });
    if (!result.success) {
      const errors = getValidationErrors(result.error);
      expect(typeof errors).toBe('object');
      expect(Object.keys(errors).length).toBeGreaterThan(0);
    }
  });
});
