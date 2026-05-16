/**
 * Tests for runtime Zod validation in the revealui-stripe MCP server.
 *
 * Coverage targets:
 *   - validateToolArgs helper: happy path returns parsed value; bad args return MCP error.
 *   - Per-tool: valid args pass through; missing required fields + extra fields are rejected.
 *   - stripe_get_customer: missing customer_id is rejected; valid customer_id passes.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { validateToolArgs } from '../validate-tool-args.js';

// ---------------------------------------------------------------------------
// Helper tests
// ---------------------------------------------------------------------------

describe('validateToolArgs', () => {
  const Schema = z.object({ id: z.string(), count: z.number().int().positive() }).strict();

  it('returns ok:true with parsed value on valid input', () => {
    const result = validateToolArgs(Schema, { id: 'abc', count: 3 }, 'my_tool');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe('abc');
      expect(result.value.count).toBe(3);
    }
  });

  it('returns ok:false with isError MCP response on missing required field', () => {
    const result = validateToolArgs(Schema, { count: 5 }, 'my_tool');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.isError).toBe(true);
      expect(result.error.content[0].text).toContain('my_tool');
    }
  });

  it('returns ok:false on wrong type', () => {
    const result = validateToolArgs(Schema, { id: 42, count: 1 }, 'my_tool');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.content[0].text).toMatch(/id/);
    }
  });

  it('returns ok:false on extra fields when schema is .strict()', () => {
    const result = validateToolArgs(Schema, { id: 'x', count: 1, extra: true }, 'my_tool');
    expect(result.ok).toBe(false);
  });

  it('returns ok:false when args is null', () => {
    const result = validateToolArgs(Schema, null, 'my_tool');
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Per-tool schema smoke tests (happy + sad path per tool)
// ---------------------------------------------------------------------------

// Import the schemas indirectly by re-testing the shapes validateToolArgs enforces.
// The server module is not re-imported here to avoid standing up the MCP transport.

const CreatePaymentIntentSchema = z
  .object({
    amount: z.number().int().positive(),
    currency: z.string().optional(),
    customer_id: z.string().optional(),
    description: z.string().optional(),
  })
  .strict();

const ListCustomersSchema = z
  .object({
    email: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  })
  .strict();

const GetCustomerSchema = z.object({ customer_id: z.string().min(1) }).strict();

const ListSubscriptionsSchema = z
  .object({
    customer_id: z.string().optional(),
    status: z
      .enum(['active', 'canceled', 'past_due', 'trialing', 'all', 'unpaid', 'incomplete'])
      .optional(),
    limit: z.number().int().min(1).max(100).optional(),
  })
  .strict();

describe('stripe_create_payment_intent args', () => {
  it('accepts valid args with required amount only', () => {
    const r = validateToolArgs(
      CreatePaymentIntentSchema,
      { amount: 2999 },
      'stripe_create_payment_intent',
    );
    expect(r.ok).toBe(true);
  });

  it('accepts valid args with all optional fields', () => {
    const r = validateToolArgs(
      CreatePaymentIntentSchema,
      { amount: 1000, currency: 'eur', customer_id: 'cus_abc', description: 'Test' },
      'stripe_create_payment_intent',
    );
    expect(r.ok).toBe(true);
  });

  it('rejects missing amount', () => {
    const r = validateToolArgs(CreatePaymentIntentSchema, {}, 'stripe_create_payment_intent');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.content[0].text).toContain('stripe_create_payment_intent');
  });

  it('rejects non-integer amount', () => {
    const r = validateToolArgs(
      CreatePaymentIntentSchema,
      { amount: 'not-a-number' },
      'stripe_create_payment_intent',
    );
    expect(r.ok).toBe(false);
  });
});

describe('stripe_list_customers args', () => {
  it('accepts empty args (all optional)', () => {
    const r = validateToolArgs(ListCustomersSchema, {}, 'stripe_list_customers');
    expect(r.ok).toBe(true);
  });

  it('accepts email filter', () => {
    const r = validateToolArgs(ListCustomersSchema, { email: 'a@b.com' }, 'stripe_list_customers');
    expect(r.ok).toBe(true);
  });

  it('rejects limit > 100', () => {
    const r = validateToolArgs(ListCustomersSchema, { limit: 200 }, 'stripe_list_customers');
    expect(r.ok).toBe(false);
  });

  it('rejects unknown field', () => {
    const r = validateToolArgs(ListCustomersSchema, { bogus: true }, 'stripe_list_customers');
    expect(r.ok).toBe(false);
  });
});

describe('stripe_get_customer args', () => {
  it('accepts valid customer_id', () => {
    const r = validateToolArgs(
      GetCustomerSchema,
      { customer_id: 'cus_abc123' },
      'stripe_get_customer',
    );
    expect(r.ok).toBe(true);
  });

  it('rejects missing customer_id', () => {
    const r = validateToolArgs(GetCustomerSchema, {}, 'stripe_get_customer');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.content[0].text).toContain('stripe_get_customer');
  });

  it('rejects empty string customer_id', () => {
    const r = validateToolArgs(GetCustomerSchema, { customer_id: '' }, 'stripe_get_customer');
    expect(r.ok).toBe(false);
  });
});

describe('stripe_list_subscriptions args', () => {
  it('accepts empty args (all optional)', () => {
    const r = validateToolArgs(ListSubscriptionsSchema, {}, 'stripe_list_subscriptions');
    expect(r.ok).toBe(true);
  });

  it('accepts valid status enum value', () => {
    const r = validateToolArgs(
      ListSubscriptionsSchema,
      { status: 'past_due' },
      'stripe_list_subscriptions',
    );
    expect(r.ok).toBe(true);
  });

  it('rejects invalid status value', () => {
    const r = validateToolArgs(
      ListSubscriptionsSchema,
      { status: 'bogus_status' },
      'stripe_list_subscriptions',
    );
    expect(r.ok).toBe(false);
  });

  it('rejects limit out of range', () => {
    const r = validateToolArgs(ListSubscriptionsSchema, { limit: 0 }, 'stripe_list_subscriptions');
    expect(r.ok).toBe(false);
  });
});
