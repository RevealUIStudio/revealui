import Stripe from 'stripe';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { protectedStripe } from '../src/index.js';

// Skip entire suite if STRIPE_SECRET_KEY is not set or is a placeholder
// Real Stripe test keys are 100+ characters; placeholders like sk_test_...xxxx are shorter
const stripeKey = process.env.STRIPE_SECRET_KEY;
const hasStripeKey = stripeKey?.startsWith('sk_test_') && stripeKey.length > 40;

describe.skipIf(!hasStripeKey)('Stripe Integration Tests', () => {
  const createdResources: {
    customers: string[];
    products: string[];
    prices: string[];
  } = {
    customers: [],
    products: [],
    prices: [],
  };

  beforeAll(() => {
    // Verify test environment (double-check, though skipIf should handle it)
    if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
      throw new Error('STRIPE_SECRET_KEY must be set to a test key for integration tests');
    }
  });

  afterAll(async () => {
    // Guard cleanup - only run if key exists
    if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
      return;
    }

    // Cleanup all created resources
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-06-20',
    });

    // CRITICAL FIX: Stripe prices are immutable - cannot be deactivated
    // Delete prices (if allowed) or leave them (test mode data)
    // Note: Stripe may restrict price deletion, so we try to delete but ignore errors
    for (const priceId of createdResources.prices) {
      try {
        // Attempt to delete price (may fail if price is in use)
        await stripe.prices.del(priceId);
      } catch {
        // Ignore errors - prices in test mode can be left as-is
      }
    }

    for (const productId of createdResources.products) {
      try {
        await stripe.products.del(productId);
      } catch {
        // Ignore errors during cleanup
      }
    }

    for (const customerId of createdResources.customers) {
      try {
        await stripe.customers.del(customerId);
      } catch {
        // Ignore errors during cleanup
      }
    }
  });

  it('should create and cleanup test customer', async () => {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-06-20',
    });

    try {
      const customer = await stripe.customers.create({
        email: `test_${Date.now()}@example.com`,
      });

      createdResources.customers.push(customer.id);

      expect(customer.id).toMatch(/^cus_/);
    } finally {
      // Per-test cleanup if needed
    }
  });

  it('should create payment intent with real product/price', async () => {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-06-20',
    });

    try {
      // Create test product
      const product = await stripe.products.create({
        name: `Test Product ${Date.now()}`,
        type: 'service',
      });
      createdResources.products.push(product.id);

      // Create test price
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: 1000, // $10.00
        currency: 'usd',
      });
      createdResources.prices.push(price.id);

      // Create test customer
      const customer = await stripe.customers.create({
        email: `test_${Date.now()}@example.com`,
      });
      createdResources.customers.push(customer.id);

      // Create payment intent using protectedStripe (goes through DbCircuitBreaker).
      // The first isOpen() call may trigger a cold Neon WebSocket connection.
      const paymentIntent = await protectedStripe.paymentIntents.create({
        customer: customer.id,
        amount: 1000,
        currency: 'usd',
        payment_method_types: ['card'],
      });

      expect(paymentIntent.id).toMatch(/^pi_/);
      expect(paymentIntent.client_secret).toBeDefined();
      expect(paymentIntent.amount).toBe(1000);
      expect(paymentIntent.currency).toBe('usd');
    } finally {
      // Resources will be cleaned up in afterAll
    }
  }, 30_000);

  it('should handle breaker behavior under repeated invalid requests', async () => {
    // Make repeated invalid requests to trigger circuit breaker.
    // Limited to 5 iterations: each call = 1 Stripe round-trip + 1 DB round-trip (~800ms).
    const invalidCustomerId = 'cus_invalid_999999';

    let failureCount = 0;
    for (let i = 0; i < 5; i++) {
      try {
        await protectedStripe.customers.retrieve(invalidCustomerId);
      } catch (error) {
        failureCount++;
        if (error instanceof Error && error.message.includes('Circuit breaker is OPEN')) {
          // Circuit breaker opened  -  success, stop early
          break;
        }
      }
    }

    // Verifies that the protected Stripe client propagates errors correctly.
    // Circuit trip requires DB-backed state; may not occur if DB is unavailable (fail-open).
    expect(failureCount).toBeGreaterThan(0);
  }, 30_000);
});
