/**
 * Stripe Webhook Handler Tests
 *
 * Tests all handler modules in packages/services/src/api/handlers/:
 * - customer-handlers: createOrRetrieveCustomer, copyBillingDetailsToCustomer,
 *   handleCustomerCreated, handleCustomerUpdated
 * - subscription-handlers: manageSubscriptionStatusChange, handleCheckoutSessionCompleted,
 *   handleCustomerSubscription{Created,Updated,Deleted}, handleSupabaseError
 * - invoice-handlers: handleInvoicePayment{Succeeded,Failed}
 * - payment-handlers: handlePaymentMethod{Attached,Detached,Created,Updated},
 *   handleSetupIntent{Succeeded,Failed}
 * - product-handlers: upsertRecord, upsertProductRecord, upsertPriceRecord, toDateTime
 * - payment-intent: createPaymentIntent
 */

import type Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockStripeCustomersCreate = vi.fn();
const mockStripeCustomersUpdate = vi.fn();
const mockStripeSubscriptionsRetrieve = vi.fn();
const mockStripePricesList = vi.fn();
const mockStripePaymentIntentsCreate = vi.fn();

vi.mock('../src/stripe/stripeClient.js', () => ({
  protectedStripe: {
    customers: {
      create: (...args: unknown[]) => mockStripeCustomersCreate(...args),
      update: (...args: unknown[]) => mockStripeCustomersUpdate(...args),
      list: vi.fn(),
    },
    subscriptions: {
      retrieve: (...args: unknown[]) => mockStripeSubscriptionsRetrieve(...args),
    },
    prices: {
      list: (...args: unknown[]) => mockStripePricesList(...args),
    },
    paymentIntents: {
      create: (...args: unknown[]) => mockStripePaymentIntentsCreate(...args),
    },
  },
}));

vi.mock('@revealui/core/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@revealui/config', () => ({
  default: {
    stripe: { secretKey: 'sk_test_mock' },
  },
}));

// ---------------------------------------------------------------------------
// Supabase mock helpers
// ---------------------------------------------------------------------------

function createMockSupabase(overrides: Record<string, unknown> = {}) {
  const defaultChain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  return {
    from: vi.fn().mockReturnValue({ ...defaultChain, ...overrides }),
  };
}

// ---------------------------------------------------------------------------
// Product Handlers
// ---------------------------------------------------------------------------

describe('Product Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('toDateTime', () => {
    it('converts seconds since epoch to a Date', async () => {
      const { toDateTime } = await import('../src/api/handlers/product-handlers.js');

      const date = toDateTime(1609459200); // 2021-01-01T00:00:00Z
      expect(date).toBeInstanceOf(Date);
      expect(date.getFullYear()).toBe(2021);
    });

    it('returns epoch for 0 seconds', async () => {
      const { toDateTime } = await import('../src/api/handlers/product-handlers.js');

      const date = toDateTime(0);
      expect(date).toBeInstanceOf(Date);
      expect(date.getFullYear()).toBe(1970);
    });
  });

  describe('upsertRecord', () => {
    it('upserts a record into the given table', async () => {
      const { upsertRecord } = await import('../src/api/handlers/product-handlers.js');

      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      const supabase = createMockSupabase({ upsert: mockUpsert });

      await upsertRecord(supabase as never, 'products', {
        stripe_product_i_d: 'prod_123',
        title: 'Test Product',
      } as never);

      expect(supabase.from).toHaveBeenCalledWith('products');
      expect(mockUpsert).toHaveBeenCalledWith([
        { stripe_product_i_d: 'prod_123', title: 'Test Product' },
      ]);
    });

    it('throws on supabase upsert error', async () => {
      const { upsertRecord } = await import('../src/api/handlers/product-handlers.js');

      const supabaseError = { message: 'duplicate key', code: '23505' };
      const mockUpsert = vi.fn().mockResolvedValue({ error: supabaseError });
      const supabase = createMockSupabase({ upsert: mockUpsert });

      await expect(
        upsertRecord(supabase as never, 'products', {
          stripe_product_i_d: 'prod_123',
          title: 'Test',
        } as never),
      ).rejects.toEqual(supabaseError);
    });
  });

  describe('upsertProductRecord', () => {
    it('maps Stripe product to DB record and upserts', async () => {
      const { upsertProductRecord } = await import('../src/api/handlers/product-handlers.js');

      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      const supabase = createMockSupabase({ upsert: mockUpsert });

      const product = {
        id: 'prod_123',
        name: 'RevealUI Pro',
        created: 1609459200,
        updated: 1609545600,
        default_price: 'price_abc',
      } as unknown as Stripe.Product;

      await upsertProductRecord(supabase as never, product);

      expect(supabase.from).toHaveBeenCalledWith('products');
      expect(mockUpsert).toHaveBeenCalledWith([
        expect.objectContaining({
          stripe_product_i_d: 'prod_123',
          title: 'RevealUI Pro',
          price_j_s_o_n: 'price_abc',
        }),
      ]);
    });

    it('handles product with object default_price', async () => {
      const { upsertProductRecord } = await import('../src/api/handlers/product-handlers.js');

      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      const supabase = createMockSupabase({ upsert: mockUpsert });

      const product = {
        id: 'prod_456',
        name: 'Test',
        created: 1609459200,
        updated: 1609545600,
        default_price: { id: 'price_obj_123' },
      } as unknown as Stripe.Product;

      await upsertProductRecord(supabase as never, product);

      expect(mockUpsert).toHaveBeenCalledWith([
        expect.objectContaining({
          price_j_s_o_n: 'price_obj_123',
        }),
      ]);
    });

    it('handles product with null default_price', async () => {
      const { upsertProductRecord } = await import('../src/api/handlers/product-handlers.js');

      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      const supabase = createMockSupabase({ upsert: mockUpsert });

      const product = {
        id: 'prod_789',
        name: 'Free',
        created: 1609459200,
        updated: 1609545600,
        default_price: null,
      } as unknown as Stripe.Product;

      await upsertProductRecord(supabase as never, product);

      expect(mockUpsert).toHaveBeenCalledWith([
        expect.objectContaining({
          price_j_s_o_n: null,
        }),
      ]);
    });
  });

  describe('upsertPriceRecord', () => {
    it('maps Stripe price to DB record and upserts', async () => {
      const { upsertPriceRecord } = await import('../src/api/handlers/product-handlers.js');

      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      const supabase = createMockSupabase({ upsert: mockUpsert });

      const price = { id: 'price_123' } as Stripe.Price;

      await upsertPriceRecord(supabase as never, price);

      expect(supabase.from).toHaveBeenCalledWith('prices');
      expect(mockUpsert).toHaveBeenCalledWith([
        expect.objectContaining({
          price_j_s_o_n: 'price_123',
        }),
      ]);
    });
  });
});

// ---------------------------------------------------------------------------
// Customer Handlers
// ---------------------------------------------------------------------------

describe('Customer Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createOrRetrieveCustomer', () => {
    it('returns existing customer data when user found in DB', async () => {
      const { createOrRetrieveCustomer } = await import('../src/api/handlers/customer-handlers.js');

      const mockSingle = vi.fn().mockResolvedValue({
        data: { stripe_customer_id: 'cus_existing' },
        error: null,
      });
      const supabase = createMockSupabase({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: mockSingle,
          }),
        }),
      });

      const result = await createOrRetrieveCustomer({
        email: 'test@test.com',
        uuid: 'user-123',
        supabase: supabase as never,
      });

      expect(result).toEqual({ stripe_customer_id: 'cus_existing' });
      expect(mockStripeCustomersCreate).not.toHaveBeenCalled();
    });

    it('creates new Stripe customer and inserts into DB when user not found', async () => {
      const { createOrRetrieveCustomer } = await import('../src/api/handlers/customer-handlers.js');

      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'not found' },
      });
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      const supabase = createMockSupabase({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: mockSingle,
          }),
        }),
        insert: mockInsert,
      });

      mockStripeCustomersCreate.mockResolvedValueOnce({ id: 'cus_new_123' } as Stripe.Customer);

      const result = await createOrRetrieveCustomer({
        email: 'new@test.com',
        uuid: 'user-456',
        supabase: supabase as never,
      });

      expect(result).toBe('cus_new_123');
      expect(mockStripeCustomersCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            supabaseUUID: 'user-456',
            email: 'new@test.com',
          }),
        }),
      );
      expect(mockInsert).toHaveBeenCalled();
    });

    it('throws on supabase insert error', async () => {
      const { createOrRetrieveCustomer } = await import('../src/api/handlers/customer-handlers.js');

      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'not found' },
      });
      const supabaseInsertError = { message: 'insert failed', code: '500' };
      const mockInsert = vi.fn().mockResolvedValue({ error: supabaseInsertError });
      const supabase = createMockSupabase({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: mockSingle,
          }),
        }),
        insert: mockInsert,
      });

      mockStripeCustomersCreate.mockResolvedValueOnce({ id: 'cus_err' } as Stripe.Customer);

      await expect(
        createOrRetrieveCustomer({
          email: 'err@test.com',
          uuid: 'user-err',
          supabase: supabase as never,
        }),
      ).rejects.toEqual(supabaseInsertError);
    });
  });

  describe('copyBillingDetailsToCustomer', () => {
    it('updates Stripe customer and supabase user with billing details', async () => {
      const { copyBillingDetailsToCustomer } = await import(
        '../src/api/handlers/customer-handlers.js'
      );

      mockStripeCustomersUpdate.mockResolvedValueOnce({} as Stripe.Customer);

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      const supabase = createMockSupabase({ update: mockUpdate });

      const paymentMethod = {
        customer: 'cus_123',
        billing_details: {
          name: 'John Doe',
          phone: '+1234567890',
          address: {
            city: 'NYC',
            country: 'US',
            line1: '123 Main St',
            line2: null,
            postal_code: '10001',
            state: 'NY',
          },
        },
      } as unknown as Stripe.PaymentMethod;

      await copyBillingDetailsToCustomer('user-123', paymentMethod, supabase as never);

      expect(mockStripeCustomersUpdate).toHaveBeenCalledWith(
        'cus_123',
        expect.objectContaining({
          name: 'John Doe',
          phone: '+1234567890',
          address: expect.objectContaining({
            city: 'NYC',
            country: 'US',
          }),
        }),
      );
    });

    it('throws when payment method has no customer', async () => {
      const { copyBillingDetailsToCustomer } = await import(
        '../src/api/handlers/customer-handlers.js'
      );

      const paymentMethod = {
        customer: null,
        billing_details: {
          name: 'Test',
          phone: '123',
          address: { city: 'NYC' },
        },
      } as unknown as Stripe.PaymentMethod;

      const supabase = createMockSupabase();

      await expect(
        copyBillingDetailsToCustomer('user-123', paymentMethod, supabase as never),
      ).rejects.toThrow('Payment method does not have a valid customer ID');
    });

    it('returns early when billing details are incomplete', async () => {
      const { copyBillingDetailsToCustomer } = await import(
        '../src/api/handlers/customer-handlers.js'
      );

      const paymentMethod = {
        customer: 'cus_123',
        billing_details: {
          name: 'John',
          phone: null,
          address: null,
        },
      } as unknown as Stripe.PaymentMethod;

      const supabase = createMockSupabase();

      await copyBillingDetailsToCustomer('user-123', paymentMethod, supabase as never);

      expect(mockStripeCustomersUpdate).not.toHaveBeenCalled();
    });
  });

  describe('handleCustomerCreated', () => {
    it('logs customer creation event', async () => {
      const { handleCustomerCreated } = await import('../src/api/handlers/customer-handlers.js');
      const { logger } = await import('@revealui/core/utils/logger');

      const event = {
        type: 'customer.created',
        data: {
          object: { id: 'cus_123', email: 'test@test.com' },
        },
      };

      handleCustomerCreated(event as never);

      expect(logger.info).toHaveBeenCalledWith('Stripe customer created', {
        customerId: 'cus_123',
        email: 'test@test.com',
      });
    });

    it('handles customer without email', async () => {
      const { handleCustomerCreated } = await import('../src/api/handlers/customer-handlers.js');
      const { logger } = await import('@revealui/core/utils/logger');

      const event = {
        type: 'customer.created',
        data: {
          object: { id: 'cus_no_email', email: null },
        },
      };

      handleCustomerCreated(event as never);

      expect(logger.info).toHaveBeenCalledWith('Stripe customer created', {
        customerId: 'cus_no_email',
        email: '(no email)',
      });
    });
  });

  describe('handleCustomerUpdated', () => {
    it('logs customer update event', async () => {
      const { handleCustomerUpdated } = await import('../src/api/handlers/customer-handlers.js');
      const { logger } = await import('@revealui/core/utils/logger');

      const event = {
        type: 'customer.updated',
        data: {
          object: { id: 'cus_456', email: 'updated@test.com' },
        },
      };

      handleCustomerUpdated(event as never);

      expect(logger.info).toHaveBeenCalledWith('Stripe customer updated', {
        customerId: 'cus_456',
        email: 'updated@test.com',
      });
    });
  });
});

// ---------------------------------------------------------------------------
// Subscription Handlers
// ---------------------------------------------------------------------------

describe('Subscription Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleSupabaseError', () => {
    it('logs the error', async () => {
      const { handleSupabaseError } = await import('../src/api/handlers/subscription-handlers.js');
      const { logger } = await import('@revealui/core/utils/logger');

      handleSupabaseError(new Error('test error'));

      expect(logger.error).toHaveBeenCalledWith('Supabase error', {
        error: expect.any(Error),
      });
    });
  });

  describe('manageSubscriptionStatusChange', () => {
    it('retrieves subscription and upserts into supabase', async () => {
      const { manageSubscriptionStatusChange } = await import(
        '../src/api/handlers/subscription-handlers.js'
      );

      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: 'user-abc' },
        error: null,
      });
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      const supabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'users') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: mockSingle,
                }),
              }),
            };
          }
          return { upsert: mockUpsert };
        }),
      };

      mockStripeSubscriptionsRetrieve.mockResolvedValueOnce({
        id: 'sub_123',
        metadata: { plan: 'pro' },
        status: 'active',
        items: { data: [{ price: { id: 'price_abc' } }] },
        current_period_start: 1609459200,
        current_period_end: 1612137600,
      });

      await manageSubscriptionStatusChange('sub_123', 'cus_abc', false, supabase as never);

      expect(mockStripeSubscriptionsRetrieve).toHaveBeenCalledWith('sub_123');
      expect(mockUpsert).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 'sub_123',
          user_id: 'user-abc',
          status: 'active',
          price_id: 'price_abc',
          stripe_subscription_id: 'sub_123',
        }),
      ]);
    });

    it('throws when customer not found in supabase', async () => {
      const { manageSubscriptionStatusChange } = await import(
        '../src/api/handlers/subscription-handlers.js'
      );

      const supabaseError = { message: 'not found', code: 'PGRST116' };
      const supabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: supabaseError }),
            }),
          }),
        }),
      };

      await expect(
        manageSubscriptionStatusChange('sub_123', 'cus_missing', false, supabase as never),
      ).rejects.toEqual(supabaseError);
    });
  });

  describe('handleCheckoutSessionCompleted', () => {
    it('throws when subscription or customer is missing', async () => {
      const { handleCheckoutSessionCompleted } = await import(
        '../src/api/handlers/subscription-handlers.js'
      );

      const event = {
        type: 'checkout.session.completed',
        data: {
          object: {
            subscription: null,
            customer: null,
          },
        },
      };

      const supabase = createMockSupabase();

      await expect(
        handleCheckoutSessionCompleted(event as never, supabase as never),
      ).rejects.toThrow('Checkout session missing subscription or customer');
    });
  });

  describe('handleCustomerSubscriptionDeleted', () => {
    it('throws when customer is missing from subscription', async () => {
      const { handleCustomerSubscriptionDeleted } = await import(
        '../src/api/handlers/subscription-handlers.js'
      );

      const event = {
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_del',
            customer: null,
          },
        },
      };

      const supabase = createMockSupabase();

      await expect(
        handleCustomerSubscriptionDeleted(event as never, supabase as never),
      ).rejects.toThrow('Subscription missing customer');
    });
  });

  describe('handleCustomerSubscriptionCreated', () => {
    it('throws when customer is missing from subscription', async () => {
      const { handleCustomerSubscriptionCreated } = await import(
        '../src/api/handlers/subscription-handlers.js'
      );

      const event = {
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_new',
            customer: null,
          },
        },
      };

      const supabase = createMockSupabase();

      await expect(
        handleCustomerSubscriptionCreated(event as never, supabase as never),
      ).rejects.toThrow('Subscription missing customer');
    });
  });

  describe('handleCustomerSubscriptionUpdated', () => {
    it('throws when customer is missing from subscription', async () => {
      const { handleCustomerSubscriptionUpdated } = await import(
        '../src/api/handlers/subscription-handlers.js'
      );

      const event = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_upd',
            customer: null,
          },
        },
      };

      const supabase = createMockSupabase();

      await expect(
        handleCustomerSubscriptionUpdated(event as never, supabase as never),
      ).rejects.toThrow('Subscription missing customer');
    });
  });
});

// ---------------------------------------------------------------------------
// Invoice Handlers
// ---------------------------------------------------------------------------

describe('Invoice Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleInvoicePaymentSucceeded', () => {
    it('throws when invoice is missing subscription or customer', async () => {
      const { handleInvoicePaymentSucceeded } = await import(
        '../src/api/handlers/invoice-handlers.js'
      );

      const event = {
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            subscription: null,
            customer: null,
          },
        },
      };

      const supabase = createMockSupabase();

      await expect(
        handleInvoicePaymentSucceeded(event as never, supabase as never),
      ).rejects.toThrow('Invoice missing subscription or customer');
    });
  });

  describe('handleInvoicePaymentFailed', () => {
    it('throws when invoice is missing subscription or customer', async () => {
      const { handleInvoicePaymentFailed } = await import(
        '../src/api/handlers/invoice-handlers.js'
      );

      const event = {
        type: 'invoice.payment_failed',
        data: {
          object: {
            subscription: null,
            customer: null,
          },
        },
      };

      const supabase = createMockSupabase();

      await expect(handleInvoicePaymentFailed(event as never, supabase as never)).rejects.toThrow(
        'Invoice missing subscription or customer',
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Payment Handlers
// ---------------------------------------------------------------------------

describe('Payment Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handlePaymentMethodAttached', () => {
    it('throws when event data is not a valid payment method', async () => {
      const { handlePaymentMethodAttached } = await import(
        '../src/api/handlers/payment-handlers.js'
      );

      const event = {
        type: 'payment_method.attached',
        data: {
          object: { id: 'pm_123', object: 'not_payment_method' },
        },
      };

      const supabase = createMockSupabase();

      await expect(handlePaymentMethodAttached(event as never, supabase as never)).rejects.toThrow(
        'Invalid payment method in event',
      );
    });

    it('throws when payment method has no customer', async () => {
      const { handlePaymentMethodAttached } = await import(
        '../src/api/handlers/payment-handlers.js'
      );

      const event = {
        type: 'payment_method.attached',
        data: {
          object: {
            id: 'pm_123',
            object: 'payment_method',
            customer: null,
          },
        },
      };

      const supabase = createMockSupabase();

      await expect(handlePaymentMethodAttached(event as never, supabase as never)).rejects.toThrow(
        'Payment method missing customer',
      );
    });
  });

  describe('handlePaymentMethodDetached', () => {
    it('throws when event data is not a valid payment method', async () => {
      const { handlePaymentMethodDetached } = await import(
        '../src/api/handlers/payment-handlers.js'
      );

      const event = {
        type: 'payment_method.detached',
        data: {
          object: { id: 'pm_det', object: 'invalid' },
        },
      };

      const supabase = createMockSupabase();

      await expect(handlePaymentMethodDetached(event as never, supabase as never)).rejects.toThrow(
        'Invalid payment method in event',
      );
    });
  });

  describe('handlePaymentMethodCreated', () => {
    it('throws when payment method is invalid', async () => {
      const { handlePaymentMethodCreated } = await import(
        '../src/api/handlers/payment-handlers.js'
      );

      const event = {
        type: 'payment_method.created',
        data: {
          object: { id: 'pm_new', object: 'not_pm' },
        },
      };

      const supabase = createMockSupabase();

      await expect(handlePaymentMethodCreated(event as never, supabase as never)).rejects.toThrow(
        'Invalid payment method in event',
      );
    });
  });

  describe('handlePaymentMethodUpdated', () => {
    it('throws when payment method is invalid', async () => {
      const { handlePaymentMethodUpdated } = await import(
        '../src/api/handlers/payment-handlers.js'
      );

      const event = {
        type: 'payment_method.updated',
        data: {
          object: { id: 'pm_upd', object: 'wrong' },
        },
      };

      const supabase = createMockSupabase();

      await expect(handlePaymentMethodUpdated(event as never, supabase as never)).rejects.toThrow(
        'Invalid payment method in event',
      );
    });
  });

  describe('handleSetupIntentSucceeded', () => {
    it('logs success with payment method id (string)', async () => {
      const { handleSetupIntentSucceeded } = await import(
        '../src/api/handlers/payment-handlers.js'
      );
      const { logger } = await import('@revealui/core/utils/logger');

      const event = {
        type: 'setup_intent.succeeded',
        data: {
          object: {
            id: 'seti_123',
            payment_method: 'pm_abc',
          },
        },
      };

      const supabase = createMockSupabase();

      handleSetupIntentSucceeded(event as never, supabase as never);

      expect(logger.info).toHaveBeenCalledWith('Setup intent succeeded', {
        setupIntentId: 'seti_123',
        paymentMethodId: 'pm_abc',
      });
    });

    it('logs success with payment method id (object)', async () => {
      const { handleSetupIntentSucceeded } = await import(
        '../src/api/handlers/payment-handlers.js'
      );
      const { logger } = await import('@revealui/core/utils/logger');

      const event = {
        type: 'setup_intent.succeeded',
        data: {
          object: {
            id: 'seti_456',
            payment_method: { id: 'pm_obj_789' },
          },
        },
      };

      const supabase = createMockSupabase();

      handleSetupIntentSucceeded(event as never, supabase as never);

      expect(logger.info).toHaveBeenCalledWith('Setup intent succeeded', {
        setupIntentId: 'seti_456',
        paymentMethodId: 'pm_obj_789',
      });
    });

    it('throws when setup intent has no payment method', async () => {
      const { handleSetupIntentSucceeded } = await import(
        '../src/api/handlers/payment-handlers.js'
      );

      const event = {
        type: 'setup_intent.succeeded',
        data: {
          object: {
            id: 'seti_no_pm',
            payment_method: null,
          },
        },
      };

      const supabase = createMockSupabase();

      expect(() => handleSetupIntentSucceeded(event as never, supabase as never)).toThrow(
        'Setup intent missing payment method',
      );
    });
  });

  describe('handleSetupIntentFailed', () => {
    it('logs setup intent failure', async () => {
      const { handleSetupIntentFailed } = await import('../src/api/handlers/payment-handlers.js');
      const { logger } = await import('@revealui/core/utils/logger');

      const event = {
        type: 'setup_intent.failed',
        data: {
          object: {
            id: 'seti_fail',
            last_setup_error: { message: 'Card declined' },
          },
        },
      };

      const supabase = createMockSupabase();

      handleSetupIntentFailed(event as never, supabase as never);

      expect(logger.error).toHaveBeenCalledWith('Setup intent failed', {
        setupIntentId: 'seti_fail',
        error: { message: 'Card declined' },
      });
    });
  });
});

// ---------------------------------------------------------------------------
// Payment Intent
// ---------------------------------------------------------------------------

describe('Payment Intent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createPaymentIntent', () => {
    it('returns 401 when user is not authenticated', async () => {
      const { createPaymentIntent } = await import('../src/api/handlers/payment-intent.js');

      const req = { user: null, revealui: {} };
      const result = await createPaymentIntent({ req } as never);

      expect(result).toEqual({ status: 401, json: { error: 'Unauthorized' } });
    });

    it('returns 401 when user has no email', async () => {
      const { createPaymentIntent } = await import('../src/api/handlers/payment-intent.js');

      const req = { user: { id: 'u1', email: 123 }, revealui: {} };
      const result = await createPaymentIntent({ req } as never);

      expect(result).toEqual({ status: 401, json: { error: 'Unauthorized' } });
    });

    it('returns 500 when revealui instance is not available', async () => {
      const { createPaymentIntent } = await import('../src/api/handlers/payment-intent.js');

      const req = { user: { id: 'u1', email: 'test@test.com' }, revealui: null };
      const result = await createPaymentIntent({ req } as never);

      expect(result).toEqual({
        status: 500,
        json: { error: 'RevealUI instance not available' },
      });
    });

    it('returns 404 when user is not found via findByID', async () => {
      const { createPaymentIntent } = await import('../src/api/handlers/payment-intent.js');

      const req = {
        user: { id: 'u1', email: 'test@test.com' },
        revealui: {
          findByID: vi.fn().mockResolvedValue(null),
        },
      };
      const result = await createPaymentIntent({ req } as never);

      expect(result).toEqual({ status: 404, json: { error: 'User not found' } });
    });

    it('returns 400 when cart is empty', async () => {
      const { createPaymentIntent } = await import('../src/api/handlers/payment-intent.js');

      const req = {
        user: { id: 'u1', email: 'test@test.com' },
        revealui: {
          findByID: vi.fn().mockResolvedValue({
            stripeCustomerID: 'cus_123',
            cart: { items: [] },
          }),
          update: vi.fn(),
        },
      };
      const result = await createPaymentIntent({ req } as never);

      expect(result).toEqual({ status: 400, json: { error: 'No items in cart' } });
    });

    it('creates payment intent for valid cart', async () => {
      const { createPaymentIntent } = await import('../src/api/handlers/payment-intent.js');

      mockStripePricesList.mockResolvedValueOnce({
        data: [{ unit_amount: 2000 }],
      });
      mockStripePaymentIntentsCreate.mockResolvedValueOnce({
        client_secret: 'pi_secret_123',
      });

      const req = {
        user: { id: 'u1', email: 'test@test.com' },
        revealui: {
          findByID: vi.fn().mockResolvedValue({
            stripeCustomerID: 'cus_123',
            cart: {
              items: [{ product: { stripeProductID: 'prod_abc' }, quantity: 2 }],
            },
          }),
          update: vi.fn(),
        },
      };

      const result = await createPaymentIntent({ req } as never);

      expect(result).toEqual({
        status: 200,
        send: { client_secret: 'pi_secret_123' },
      });
      expect(mockStripePaymentIntentsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_123',
          amount: 4000,
          currency: 'usd',
          payment_method_types: ['card'],
        }),
      );
    });

    it('creates Stripe customer when user has no stripeCustomerID', async () => {
      const { createPaymentIntent } = await import('../src/api/handlers/payment-intent.js');

      mockStripeCustomersCreate.mockResolvedValueOnce({ id: 'cus_new' } as Stripe.Customer);
      mockStripePricesList.mockResolvedValueOnce({
        data: [{ unit_amount: 1000 }],
      });
      mockStripePaymentIntentsCreate.mockResolvedValueOnce({
        client_secret: 'pi_secret_new',
      });

      const mockUpdate = vi.fn();
      const req = {
        user: { id: 'u1', email: 'test@test.com' },
        revealui: {
          findByID: vi.fn().mockResolvedValue({
            name: 'Test User',
            cart: {
              items: [{ product: { stripeProductID: 'prod_xyz' }, quantity: 1 }],
            },
          }),
          update: mockUpdate,
          logger: null,
        },
      };

      const result = await createPaymentIntent({ req } as never);

      expect(mockStripeCustomersCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@test.com',
          name: 'Test User',
        }),
      );
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'users',
          data: { stripeCustomerID: 'cus_new' },
        }),
      );
      expect(result).toEqual({
        status: 200,
        send: { client_secret: 'pi_secret_new' },
      });
    });

    it('returns 500 when Stripe prices.list fails (allSettled swallows, total stays 0)', async () => {
      const { createPaymentIntent } = await import('../src/api/handlers/payment-intent.js');

      mockStripePricesList.mockRejectedValueOnce(new Error('Stripe down'));

      const req = {
        user: { id: 'u1', email: 'test@test.com' },
        revealui: {
          findByID: vi.fn().mockResolvedValue({
            stripeCustomerID: 'cus_123',
            cart: {
              items: [{ product: { stripeProductID: 'prod_abc' }, quantity: 1 }],
            },
          }),
          logger: { error: vi.fn() },
        },
      };

      const result = await createPaymentIntent({ req } as never);

      // Promise.allSettled swallows the prices.list rejection, so total stays 0
      // and the code throws "nothing to pay for" instead of the original error
      expect(result).toEqual({
        status: 500,
        json: {
          error: 'There is nothing to pay for, add some items to your cart and try again.',
        },
      });
    });
  });
});
