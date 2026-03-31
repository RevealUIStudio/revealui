/**
 * Extended Payment Handler Tests
 *
 * Covers the untested handlers in src/api/handlers/payment-handlers.ts:
 * - handlePaymentMethodCreated
 * - handlePaymentMethodUpdated
 * - handleSetupIntentSucceeded
 * - handleSetupIntentFailed
 *
 * handlers.test.ts already covers handlePaymentMethodAttached and Detached.
 */

import type Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — same pattern as handlers.test.ts
// ---------------------------------------------------------------------------

const mockStripeCustomersUpdate = vi.fn();

vi.mock('../src/stripe/stripeClient.js', () => ({
  protectedStripe: {
    customers: {
      update: (...args: unknown[]) => mockStripeCustomersUpdate(...args),
    },
  },
}));

vi.mock('@revealui/core/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@revealui/config', () => ({
  default: { stripe: { secretKey: 'sk_test_mock' } },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockSupabase(overrides: Record<string, unknown> = {}) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  return { from: vi.fn().mockReturnValue({ ...chain, ...overrides }) };
}

function buildPaymentMethodEvent<T extends string>(
  type: T,
  paymentMethod: Record<string, unknown>,
): { type: T; data: { object: unknown } } {
  return { type, data: { object: paymentMethod } };
}

function buildSetupIntentEvent<T extends string>(
  type: T,
  setupIntent: Record<string, unknown>,
): { type: T; data: { object: unknown } } {
  return { type, data: { object: setupIntent } };
}

// ---------------------------------------------------------------------------
// handlePaymentMethodCreated
// ---------------------------------------------------------------------------

describe('handlePaymentMethodCreated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when data.object is not a payment method', async () => {
    const { handlePaymentMethodCreated } = await import('../src/api/handlers/payment-handlers.js');
    const event = buildPaymentMethodEvent('payment_method.created', {
      id: 'x',
      object: 'customer', // wrong type
    });
    const supabase = createMockSupabase();

    await expect(handlePaymentMethodCreated(event as never, supabase as never)).rejects.toThrow(
      'Invalid payment method in event',
    );
  });

  it('throws when payment method has no customer', async () => {
    const { handlePaymentMethodCreated } = await import('../src/api/handlers/payment-handlers.js');
    const event = buildPaymentMethodEvent('payment_method.created', {
      id: 'pm_1',
      object: 'payment_method',
      customer: null,
      billing_details: {},
    });
    const supabase = createMockSupabase();

    await expect(handlePaymentMethodCreated(event as never, supabase as never)).rejects.toThrow(
      'Payment method missing customer',
    );
  });

  it('throws when user not found for customer', async () => {
    const { handlePaymentMethodCreated } = await import('../src/api/handlers/payment-handlers.js');
    const event = buildPaymentMethodEvent('payment_method.created', {
      id: 'pm_1',
      object: 'payment_method',
      customer: 'cus_1',
      billing_details: { name: null, phone: null, address: null },
    });
    const supabase = createMockSupabase({
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    await expect(handlePaymentMethodCreated(event as never, supabase as never)).rejects.toThrow(
      'User not found for customer',
    );
  });

  it('calls copyBillingDetailsToCustomer when billing details are missing (no-op)', async () => {
    const { handlePaymentMethodCreated } = await import('../src/api/handlers/payment-handlers.js');
    const event = buildPaymentMethodEvent('payment_method.created', {
      id: 'pm_1',
      object: 'payment_method',
      customer: 'cus_1',
      billing_details: { name: null, phone: null, address: null },
    });
    const supabase = createMockSupabase({
      single: vi.fn().mockResolvedValue({ data: { id: 'user_1' }, error: null }),
    });
    mockStripeCustomersUpdate.mockResolvedValue({});
    // Should complete without throwing (billing details incomplete → copyBillingDetailsToCustomer no-ops)

    await expect(
      handlePaymentMethodCreated(event as never, supabase as never),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// handlePaymentMethodUpdated
// ---------------------------------------------------------------------------

describe('handlePaymentMethodUpdated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when data.object is not a payment method', async () => {
    const { handlePaymentMethodUpdated } = await import('../src/api/handlers/payment-handlers.js');
    const event = buildPaymentMethodEvent('payment_method.updated', {
      id: 'x',
      object: 'subscription',
    });
    const supabase = createMockSupabase();

    await expect(handlePaymentMethodUpdated(event as never, supabase as never)).rejects.toThrow(
      'Invalid payment method in event',
    );
  });

  it('throws when payment method has no customer', async () => {
    const { handlePaymentMethodUpdated } = await import('../src/api/handlers/payment-handlers.js');
    const event = buildPaymentMethodEvent('payment_method.updated', {
      id: 'pm_1',
      object: 'payment_method',
      customer: null,
      billing_details: {},
    });
    const supabase = createMockSupabase();

    await expect(handlePaymentMethodUpdated(event as never, supabase as never)).rejects.toThrow(
      'Payment method missing customer',
    );
  });

  it('completes when billing details are missing (no-op copy)', async () => {
    const { handlePaymentMethodUpdated } = await import('../src/api/handlers/payment-handlers.js');
    const event = buildPaymentMethodEvent('payment_method.updated', {
      id: 'pm_1',
      object: 'payment_method',
      customer: 'cus_1',
      billing_details: { name: null, phone: null, address: null },
    });
    const supabase = createMockSupabase({
      single: vi.fn().mockResolvedValue({ data: { id: 'user_1' }, error: null }),
    });
    mockStripeCustomersUpdate.mockResolvedValue({});

    await expect(
      handlePaymentMethodUpdated(event as never, supabase as never),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// handleSetupIntentSucceeded
// ---------------------------------------------------------------------------

describe('handleSetupIntentSucceeded', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs and completes when payment_method is a string id', async () => {
    const { handleSetupIntentSucceeded } = await import('../src/api/handlers/payment-handlers.js');
    const event = buildSetupIntentEvent('setup_intent.succeeded', {
      id: 'seti_1',
      payment_method: 'pm_abc',
    } as Partial<Stripe.SetupIntent>);
    const supabase = createMockSupabase();

    expect(() => handleSetupIntentSucceeded(event as never, supabase as never)).not.toThrow();
  });

  it('logs and completes when payment_method is an object with id', async () => {
    const { handleSetupIntentSucceeded } = await import('../src/api/handlers/payment-handlers.js');
    const event = buildSetupIntentEvent('setup_intent.succeeded', {
      id: 'seti_1',
      payment_method: { id: 'pm_nested', object: 'payment_method' },
    });
    const supabase = createMockSupabase();

    expect(() => handleSetupIntentSucceeded(event as never, supabase as never)).not.toThrow();
  });

  it('throws when payment_method is missing', async () => {
    const { handleSetupIntentSucceeded } = await import('../src/api/handlers/payment-handlers.js');
    const event = buildSetupIntentEvent('setup_intent.succeeded', {
      id: 'seti_1',
      payment_method: null,
    });
    const supabase = createMockSupabase();

    expect(() => handleSetupIntentSucceeded(event as never, supabase as never)).toThrow(
      'Setup intent missing payment method',
    );
  });
});

// ---------------------------------------------------------------------------
// handleSetupIntentFailed
// ---------------------------------------------------------------------------

describe('handleSetupIntentFailed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs and completes without throwing', async () => {
    const { handleSetupIntentFailed } = await import('../src/api/handlers/payment-handlers.js');
    const event = buildSetupIntentEvent('setup_intent.failed', {
      id: 'seti_fail',
      last_setup_error: { message: 'card declined' },
    });
    const supabase = createMockSupabase();

    expect(() => handleSetupIntentFailed(event as never, supabase as never)).not.toThrow();
  });

  it('handles null last_setup_error gracefully', async () => {
    const { handleSetupIntentFailed } = await import('../src/api/handlers/payment-handlers.js');
    const event = buildSetupIntentEvent('setup_intent.failed', {
      id: 'seti_fail',
      last_setup_error: null,
    });
    const supabase = createMockSupabase();

    expect(() => handleSetupIntentFailed(event as never, supabase as never)).not.toThrow();
  });
});
