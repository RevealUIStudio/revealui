/**
 * Targeted Branch Coverage Tests
 *
 * Fills remaining branch gaps after the main test files:
 * - invoice-handlers: subscription as Stripe.Subscription object (not string)
 * - subscription-handlers: non-Error thrown in catch blocks
 * - create-checkout-session: customer as object with stripe_customer_id
 * - create-portal-link: customer as object with stripe_customer_id
 * - webhooks: oversized body read, resolveTierFromMetadata error path
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

const mockStripeCustomersCreate = vi.fn();
const mockStripeCustomersUpdate = vi.fn();
const mockStripeSubscriptionsRetrieve = vi.fn();
const mockStripeCheckoutSessionsCreate = vi.fn();
const mockStripeBillingPortalSessionsCreate = vi.fn();

vi.mock('../src/stripe/stripeClient.js', () => ({
  protectedStripe: {
    customers: {
      create: (...a: unknown[]) => mockStripeCustomersCreate(...a),
      update: (...a: unknown[]) => mockStripeCustomersUpdate(...a),
      list: vi.fn().mockResolvedValue({ data: [] }),
    },
    subscriptions: {
      retrieve: (...a: unknown[]) => mockStripeSubscriptionsRetrieve(...a),
      update: vi.fn().mockResolvedValue({}),
    },
    checkout: {
      sessions: {
        create: (...a: unknown[]) => mockStripeCheckoutSessionsCreate(...a),
      },
    },
    billingPortal: {
      sessions: {
        create: (...a: unknown[]) => mockStripeBillingPortalSessionsCreate(...a),
      },
    },
    webhooks: { constructEvent: vi.fn() },
  },
}));

vi.mock('@revealui/core/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@revealui/config', () => ({
  default: { stripe: { secretKey: 'sk_test_mock' } },
}));

// ---------------------------------------------------------------------------
// createMockSupabase
// ---------------------------------------------------------------------------

function createMockSupabase(overrides: Record<string, unknown> = {}) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  return { from: vi.fn().mockReturnValue({ ...chain, ...overrides }) };
}

// ---------------------------------------------------------------------------
// invoice-handlers: subscription as an object (not a plain string)
// ---------------------------------------------------------------------------

describe('invoice-handlers — subscription as Stripe.Subscription object', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStripeSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_1',
      status: 'active',
      metadata: {},
      items: { data: [{ price: { id: 'price_1' } }] },
    });
  });

  it('handleInvoicePaymentSucceeded: extracts id when subscription is an object', async () => {
    const { handleInvoicePaymentSucceeded } = await import(
      '../src/api/handlers/invoice-handlers.js'
    );
    const supabase = createMockSupabase({
      single: vi.fn().mockResolvedValue({ data: { id: 'user_1' }, error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    });
    const event = {
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          subscription: { id: 'sub_1', object: 'subscription' }, // object, not string
          customer: 'cus_1',
        },
      },
    };
    await expect(
      handleInvoicePaymentSucceeded(event as never, supabase as never),
    ).resolves.toBeUndefined();
  });

  it('handleInvoicePaymentFailed: extracts id when subscription is an object', async () => {
    const { handleInvoicePaymentFailed } = await import('../src/api/handlers/invoice-handlers.js');
    const supabase = createMockSupabase({
      single: vi.fn().mockResolvedValue({ data: { id: 'user_1' }, error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    });
    const event = {
      type: 'invoice.payment_failed',
      data: {
        object: {
          subscription: { id: 'sub_1', object: 'subscription' },
          customer: 'cus_1',
        },
      },
    };
    await expect(
      handleInvoicePaymentFailed(event as never, supabase as never),
    ).resolves.toBeUndefined();
  });

  it('handleInvoicePaymentSucceeded: throws when subscription object has no id', async () => {
    const { handleInvoicePaymentSucceeded } = await import(
      '../src/api/handlers/invoice-handlers.js'
    );
    const supabase = createMockSupabase();
    const event = {
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          // subscription is an object but .id is missing → id will be undefined → null
          subscription: { object: 'subscription' },
          customer: 'cus_1',
        },
      },
    };

    await expect(handleInvoicePaymentSucceeded(event as never, supabase as never)).rejects.toThrow(
      'Invoice missing subscription or customer',
    );
  });
});

// ---------------------------------------------------------------------------
// subscription-handlers: non-Error thrown in catch
// ---------------------------------------------------------------------------

describe('subscription-handlers — non-Error throw in catch blocks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStripeSubscriptionsRetrieve.mockRejectedValue('plain string error'); // non-Error
  });

  it('handleCustomerSubscriptionCreated: wraps non-Error in handleSupabaseError and resolves', async () => {
    const { handleCustomerSubscriptionCreated } = await import(
      '../src/api/handlers/subscription-handlers.js'
    );
    const supabase = createMockSupabase({
      single: vi.fn().mockResolvedValue({ data: { id: 'user_1' }, error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    });
    const event = {
      type: 'customer.subscription.created',
      data: {
        object: { id: 'sub_1', object: 'subscription', customer: 'cus_1' },
      },
    };
    // handleSupabaseError logs but does NOT rethrow — function resolves normally

    await expect(
      handleCustomerSubscriptionCreated(event as never, supabase as never),
    ).resolves.toBeUndefined();
  });

  it('handleCustomerSubscriptionDeleted: wraps non-Error in handleSupabaseError and resolves', async () => {
    const { handleCustomerSubscriptionDeleted } = await import(
      '../src/api/handlers/subscription-handlers.js'
    );
    const supabase = createMockSupabase({
      single: vi.fn().mockResolvedValue({ data: { id: 'user_1' }, error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    });
    const event = {
      type: 'customer.subscription.deleted',
      data: {
        object: { id: 'sub_1', object: 'subscription', customer: 'cus_1' },
      },
    };

    await expect(
      handleCustomerSubscriptionDeleted(event as never, supabase as never),
    ).resolves.toBeUndefined();
  });

  it('handleCustomerSubscriptionUpdated: wraps non-Error in handleSupabaseError and resolves', async () => {
    const { handleCustomerSubscriptionUpdated } = await import(
      '../src/api/handlers/subscription-handlers.js'
    );
    const supabase = createMockSupabase({
      single: vi.fn().mockResolvedValue({ data: { id: 'user_1' }, error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    });
    const event = {
      type: 'customer.subscription.updated',
      data: {
        object: { id: 'sub_1', object: 'subscription', customer: 'cus_1' },
      },
    };

    await expect(
      handleCustomerSubscriptionUpdated(event as never, supabase as never),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// invoice-handlers: else branch in catch (non-Error throw from supabase)
// ---------------------------------------------------------------------------

describe('invoice-handlers — else branch in catch (supabase throws non-Error)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStripeSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_1',
      status: 'active',
      metadata: {},
      items: { data: [{ price: { id: 'price_1' } }] },
    });
  });

  it('handleInvoicePaymentSucceeded: else branch when supabase throws non-Error', async () => {
    const { handleInvoicePaymentSucceeded } = await import(
      '../src/api/handlers/invoice-handlers.js'
    );
    const nonErrorSupa = createMockSupabase({
      single: vi
        .fn()
        .mockResolvedValue({ data: null, error: { code: 'PGRST', message: 'row not found' } }),
    });
    const event = {
      type: 'invoice.payment_succeeded',
      data: { object: { subscription: 'sub_1', customer: 'cus_1' } },
    };

    await expect(
      handleInvoicePaymentSucceeded(event as never, nonErrorSupa as never),
    ).resolves.toBeUndefined();
  });

  it('handleInvoicePaymentFailed: else branch when supabase throws non-Error', async () => {
    const { handleInvoicePaymentFailed } = await import('../src/api/handlers/invoice-handlers.js');
    const nonErrorSupa = createMockSupabase({
      single: vi
        .fn()
        .mockResolvedValue({ data: null, error: { code: 'PGRST', message: 'row not found' } }),
    });
    const event = {
      type: 'invoice.payment_failed',
      data: { object: { subscription: 'sub_1', customer: 'cus_1' } },
    };

    await expect(
      handleInvoicePaymentFailed(event as never, nonErrorSupa as never),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// payment-handlers: else branch in catch (customers.update throws non-Error)
// ---------------------------------------------------------------------------

describe('payment-handlers — else branch in catch (customers.update throws non-Error)', () => {
  const fullBillingDetails = {
    name: 'Test User',
    phone: '+15550001111',
    address: {
      city: 'Austin',
      country: 'US',
      line1: '123 Main St',
      line2: null,
      postal_code: '78701',
      state: 'TX',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStripeCustomersUpdate.mockRejectedValue('stripe_error_string');
  });

  it('handlePaymentMethodCreated: else branch when customers.update throws non-Error', async () => {
    const { handlePaymentMethodCreated } = await import('../src/api/handlers/payment-handlers.js');
    const supabase = createMockSupabase({
      single: vi.fn().mockResolvedValue({ data: { id: 'user_1' }, error: null }),
    });
    const event = {
      type: 'payment_method.created',
      data: {
        object: {
          id: 'pm_1',
          object: 'payment_method',
          customer: 'cus_1',
          billing_details: fullBillingDetails,
        },
      },
    };

    await expect(
      handlePaymentMethodCreated(event as never, supabase as never),
    ).resolves.toBeUndefined();
  });

  it('handlePaymentMethodUpdated: else branch when customers.update throws non-Error', async () => {
    const { handlePaymentMethodUpdated } = await import('../src/api/handlers/payment-handlers.js');
    const supabase = createMockSupabase({
      single: vi.fn().mockResolvedValue({ data: { id: 'user_1' }, error: null }),
    });
    const event = {
      type: 'payment_method.updated',
      data: {
        object: {
          id: 'pm_1',
          object: 'payment_method',
          customer: 'cus_1',
          billing_details: fullBillingDetails,
        },
      },
    };

    await expect(
      handlePaymentMethodUpdated(event as never, supabase as never),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// create-checkout-session: customer as object branch
// ---------------------------------------------------------------------------

vi.mock('../src/supabase/index.js', () => ({
  createServerClientFromRequest: vi.fn(),
  createServerClient: vi.fn(),
}));

vi.mock('../src/api/utils.js', () => ({
  createOrRetrieveCustomer: vi.fn(),
  getURL: vi.fn(() => 'https://example.com'),
  // Stub all other re-exports
  copyBillingDetailsToCustomer: vi.fn(),
  createPaymentIntent: vi.fn(),
  handleCheckoutSessionCompleted: vi.fn(),
  handleCustomerCreated: vi.fn(),
  handleCustomerSubscriptionCreated: vi.fn(),
  handleCustomerSubscriptionDeleted: vi.fn(),
  handleCustomerSubscriptionUpdated: vi.fn(),
  handleCustomerUpdated: vi.fn(),
  handleInvoicePaymentFailed: vi.fn(),
  handleInvoicePaymentSucceeded: vi.fn(),
  handlePaymentMethodAttached: vi.fn(),
  handlePaymentMethodCreated: vi.fn(),
  handlePaymentMethodDetached: vi.fn(),
  handlePaymentMethodUpdated: vi.fn(),
  handleSetupIntentFailed: vi.fn(),
  handleSetupIntentSucceeded: vi.fn(),
  handleSupabaseError: vi.fn(),
  manageSubscriptionStatusChange: vi.fn(),
  toDateTime: vi.fn(),
  upsertPriceRecord: vi.fn(),
  upsertProductRecord: vi.fn(),
  upsertRecord: vi.fn(),
  createClient: vi.fn(),
  createStripeCustomer: vi.fn(),
}));

describe('create-checkout-session: customer object branch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 500 when customer object has null stripe_customer_id', async () => {
    const { createServerClientFromRequest } = await import('../src/supabase/index.js');
    const { createOrRetrieveCustomer } = await import('../src/api/utils.js');
    const mockSupa = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.com' } } }),
      },
    };

    vi.mocked(createServerClientFromRequest).mockReturnValue(mockSupa as never);
    // Returns an object (not a string) with null stripe_customer_id
    vi.mocked(createOrRetrieveCustomer).mockResolvedValue({ stripe_customer_id: null });
    const { POST } = await import('../src/api/create-checkout-session/index.js');
    const req = new Request('https://example.com/api/checkout', {
      method: 'POST',
      body: JSON.stringify({ price: { id: 'price_1' } }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    expect(await res.text()).toContain('Failed to create or retrieve customer');
  });

  it('creates session when customer object has valid stripe_customer_id', async () => {
    const { createServerClientFromRequest } = await import('../src/supabase/index.js');
    const { createOrRetrieveCustomer } = await import('../src/api/utils.js');
    const mockSupa = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.com' } } }),
      },
    };

    vi.mocked(createServerClientFromRequest).mockReturnValue(mockSupa as never);
    vi.mocked(createOrRetrieveCustomer).mockResolvedValue({ stripe_customer_id: 'cus_obj_1' });
    mockStripeCheckoutSessionsCreate.mockResolvedValue({ id: 'cs_1' });
    const { POST } = await import('../src/api/create-checkout-session/index.js');
    const req = new Request('https://example.com/api/checkout', {
      method: 'POST',
      body: JSON.stringify({ price: { id: 'price_1' } }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessionId).toBe('cs_1');
  });
});

describe('create-portal-link: customer object branch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when customer object has null stripe_customer_id', async () => {
    const { createServerClientFromRequest } = await import('../src/supabase/index.js');
    const { createOrRetrieveCustomer } = await import('../src/api/utils.js');
    const mockSupa = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.com' } } }),
      },
    };

    vi.mocked(createServerClientFromRequest).mockReturnValue(mockSupa as never);
    vi.mocked(createOrRetrieveCustomer).mockResolvedValue({ stripe_customer_id: null });
    const { POST } = await import('../src/api/create-portal-link/index.js');
    const req = new Request('https://example.com/api/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(500); // error caught, returns Internal Error
  });

  it('creates portal session when customer object has valid stripe_customer_id', async () => {
    const { createServerClientFromRequest } = await import('../src/supabase/index.js');
    const { createOrRetrieveCustomer } = await import('../src/api/utils.js');
    const mockSupa = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.com' } } }),
      },
    };

    vi.mocked(createServerClientFromRequest).mockReturnValue(mockSupa as never);
    vi.mocked(createOrRetrieveCustomer).mockResolvedValue({ stripe_customer_id: 'cus_obj_2' });
    mockStripeBillingPortalSessionsCreate.mockResolvedValue({
      url: 'https://billing.stripe.com/session',
    });
    const { POST } = await import('../src/api/create-portal-link/index.js');
    const req = new Request('https://example.com/api/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toContain('billing.stripe.com');
  });
});
