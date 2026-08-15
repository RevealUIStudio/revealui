import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { sanitizeProviderToolSchema, toolParametersToJsonSchema } from '../tool-json-schema.js';

describe('toolParametersToJsonSchema', () => {
  it('rewrites z.string().email() lookaround patterns to format: email', () => {
    const schema = z.object({
      email: z.string().email().describe('User email address'),
    });

    const raw = z.toJSONSchema(schema) as {
      properties?: { email?: { pattern?: string; format?: string } };
    };
    expect(raw.properties?.email?.pattern).toMatch(/\(\?/);

    const safe = toolParametersToJsonSchema(schema);
    const email = (safe.properties as Record<string, { pattern?: string; format?: string }>).email;
    expect(email.pattern).toBeUndefined();
    expect(email.format).toBe('email');
  });

  it('leaves lookaround-free patterns intact', () => {
    const schema = z.object({
      slug: z.string().regex(/^[a-z0-9-]+$/),
    });
    const safe = toolParametersToJsonSchema(schema);
    const slug = (safe.properties as Record<string, { pattern?: string }>).slug;
    expect(slug.pattern).toBeDefined();
    expect(slug.pattern).not.toMatch(/\(\?/);
  });
});

describe('sanitizeProviderToolSchema', () => {
  it('rewrites nested $defs lookaround email patterns', () => {
    const raw = {
      type: 'object',
      $defs: {
        User: {
          type: 'object',
          properties: {
            email: {
              type: 'string',
              pattern: '^(?!\\.)(?!.*\\.\\.)([A-Za-z0-9]+)@example.com$',
              description: 'User email address',
            },
          },
        },
      },
    };

    const safe = sanitizeProviderToolSchema(raw);
    const email = (
      safe.$defs as Record<
        string,
        { properties: Record<string, { pattern?: string; format?: string }> }
      >
    ).User.properties.email;
    expect(email.pattern).toBeUndefined();
    expect(email.format).toBe('email');
  });
});
