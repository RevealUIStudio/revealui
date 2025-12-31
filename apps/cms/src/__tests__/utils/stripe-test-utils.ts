/**
 * Stripe Test Utilities
 * Helper functions for testing Stripe integration
 */

import Stripe from "stripe"

/**
 * Create a mock Stripe instance for testing
 */
export function createMockStripe(): Partial<Stripe> {
  return {
    webhooks: {
      constructEvent: vi.fn(),
    } as any,
    customers: {
      create: vi.fn(),
      retrieve: vi.fn(),
      update: vi.fn(),
      del: vi.fn(),
    } as any,
    paymentIntents: {
      create: vi.fn(),
      retrieve: vi.fn(),
    } as any,
    checkout: {
      sessions: {
        create: vi.fn(),
        retrieve: vi.fn(),
      } as any,
    } as any,
    products: {
      create: vi.fn(),
      retrieve: vi.fn(),
      update: vi.fn(),
    } as any,
    prices: {
      create: vi.fn(),
      retrieve: vi.fn(),
      update: vi.fn(),
    } as any,
    subscriptions: {
      retrieve: vi.fn(),
      update: vi.fn(),
      cancel: vi.fn(),
    } as any,
  }
}

/**
 * Create a mock Stripe webhook event
 */
export function createMockWebhookEvent(
  type: string,
  data: Record<string, unknown> = {}
): Stripe.Event {
  return {
    id: `evt_test_${Date.now()}`,
    object: "event",
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
    api_version: "2024-06-20",
  } as Stripe.Event
}

/**
 * Create a mock Stripe webhook signature
 */
export function createMockWebhookSignature(
  payload: string,
  secret: string
): string {
  // In real implementation, this would use crypto.createHmac
  // For testing, we'll return a mock signature
  return `t=${Date.now()},v1=mock_signature_${Buffer.from(payload).toString("base64")}`
}

/**
 * Create a mock Stripe customer
 */
export function createMockCustomer(
  email: string,
  metadata: Record<string, string> = {}
): Stripe.Customer {
  return {
    id: `cus_test_${Date.now()}`,
    object: "customer",
    email,
    metadata,
    created: Math.floor(Date.now() / 1000),
  } as Stripe.Customer
}

/**
 * Create a mock Stripe payment intent
 */
export function createMockPaymentIntent(
  amount: number,
  currency: string = "usd"
): Stripe.PaymentIntent {
  return {
    id: `pi_test_${Date.now()}`,
    object: "payment_intent",
    amount,
    currency,
    status: "succeeded",
    created: Math.floor(Date.now() / 1000),
  } as Stripe.PaymentIntent
}

/**
 * Create a mock Stripe checkout session
 */
export function createMockCheckoutSession(
  customerId: string,
  amount: number
): Stripe.Checkout.Session {
  return {
    id: `cs_test_${Date.now()}`,
    object: "checkout.session",
    customer: customerId,
    amount_total: amount,
    currency: "usd",
    status: "complete",
    payment_status: "paid",
    created: Math.floor(Date.now() / 1000),
  } as Stripe.Checkout.Session
}

import { vi } from "vitest"

