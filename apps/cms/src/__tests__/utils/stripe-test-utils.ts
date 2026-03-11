/**
 * Stripe Test Utilities
 * Helper functions for testing Stripe integration
 */

import type Stripe from 'stripe';
import { vi } from 'vitest';

type MockFn = ReturnType<typeof vi.fn>;

type MockStripe = {
  webhooks: {
    constructEvent: MockFn;
  };
  customers: {
    create: MockFn;
    retrieve: MockFn;
    update: MockFn;
    del: MockFn;
  };
  paymentIntents: {
    create: MockFn;
    retrieve: MockFn;
  };
  checkout: {
    sessions: {
      create: MockFn;
      retrieve: MockFn;
    };
  };
  products: {
    create: MockFn;
    retrieve: MockFn;
    update: MockFn;
  };
  prices: {
    create: MockFn;
    retrieve: MockFn;
    update: MockFn;
  };
  subscriptions: {
    retrieve: MockFn;
    update: MockFn;
    cancel: MockFn;
  };
};

/**
 * Create a mock Stripe instance for testing
 */
export function createMockStripe(): MockStripe {
  return {
    webhooks: {
      constructEvent: vi.fn(),
    },
    customers: {
      create: vi.fn(),
      retrieve: vi.fn(),
      update: vi.fn(),
      del: vi.fn(),
    },
    paymentIntents: {
      create: vi.fn(),
      retrieve: vi.fn(),
    },
    checkout: {
      sessions: {
        create: vi.fn(),
        retrieve: vi.fn(),
      },
    },
    products: {
      create: vi.fn(),
      retrieve: vi.fn(),
      update: vi.fn(),
    },
    prices: {
      create: vi.fn(),
      retrieve: vi.fn(),
      update: vi.fn(),
    },
    subscriptions: {
      retrieve: vi.fn(),
      update: vi.fn(),
      cancel: vi.fn(),
    },
  };
}

/**
 * Create a mock Stripe webhook event
 */
export function createMockWebhookEvent(
  type: string,
  data: Record<string, unknown> = {},
): Stripe.Event {
  return {
    id: `evt_test_${Date.now()}`,
    object: 'event',
    type: type as Stripe.Event.Type,
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 0,
    request: {
      id: null,
      idempotency_key: null,
    },
    data: {
      object: data as Stripe.Event.Data.Object,
      previous_attributes: {},
    },
    api_version: '2024-06-20',
  } as Stripe.Event;
}

/**
 * Create a mock Stripe webhook signature
 */
export function createMockWebhookSignature(payload: string, _secret: string): string {
  // In real implementation, this would use crypto.createHmac
  // For testing, we'll return a mock signature
  return `t=${Date.now()},v1=mock_signature_${Buffer.from(payload).toString('base64')}`;
}

/**
 * Create a mock Stripe customer
 */
export function createMockCustomer(
  email: string,
  metadata: Record<string, string> = {},
): Stripe.Customer {
  return {
    id: `cus_test_${Date.now()}`,
    object: 'customer',
    email,
    metadata,
    created: Math.floor(Date.now() / 1000),
  } as Stripe.Customer;
}

/**
 * Create a mock Stripe payment intent
 */
export function createMockPaymentIntent(
  amount: number,
  currency: string = 'usd',
): Stripe.PaymentIntent {
  return {
    id: `pi_test_${Date.now()}`,
    object: 'payment_intent',
    amount,
    currency,
    status: 'succeeded',
    created: Math.floor(Date.now() / 1000),
  } as Stripe.PaymentIntent;
}

/**
 * Create a mock Stripe checkout session
 */
export function createMockCheckoutSession(
  customerId: string,
  amount: number,
): Stripe.Checkout.Session {
  return {
    id: `cs_test_${Date.now()}`,
    object: 'checkout.session',
    customer: customerId,
    amount_total: amount,
    currency: 'usd',
    status: 'complete',
    payment_status: 'paid',
    created: Math.floor(Date.now() / 1000),
  } as Stripe.Checkout.Session;
}
