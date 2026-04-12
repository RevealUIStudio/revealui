/**
 * Stripe integration tests
 *
 * Tests payment intent creation, webhook signature verification,
 * checkout session handling, and subscription management.
 *
 * These tests require STRIPE_SECRET_KEY environment variable (test mode).
 */

import type Stripe from 'stripe';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Skip all tests if Stripe test key is not available
const hasTestKey = process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_');

// Fail fast in CI when credentials are expected but missing
if (process.env.RUN_INTEGRATION === 'true' && !hasTestKey) {
  throw new Error('STRIPE_SECRET_KEY (sk_test_*) required when RUN_INTEGRATION=true');
}

describe.skipIf(!hasTestKey)('Stripe Integration', () => {
  let stripe: Stripe;
  const createdPaymentIntents: string[] = [];

  beforeAll(async () => {
    const StripeModule = await import('stripe');
    const StripeClient = StripeModule.default;
    stripe = new StripeClient(process.env.STRIPE_SECRET_KEY!);
  });

  afterAll(async () => {
    // Clean up created payment intents
    for (const piId of createdPaymentIntents) {
      try {
        await stripe.paymentIntents.cancel(piId);
      } catch {
        // Ignore errors during cleanup (already canceled, etc.)
      }
    }
  });

  describe('Payment Intent Creation', () => {
    it('should create a payment intent', async () => {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: 1000, // $10.00
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
        metadata: { test: 'integration-test' },
      });

      createdPaymentIntents.push(paymentIntent.id);

      expect(paymentIntent.id).toMatch(/^pi_/);
      expect(paymentIntent.amount).toBe(1000);
      expect(paymentIntent.currency).toBe('usd');
      expect(paymentIntent.status).toBe('requires_payment_method');
      expect(paymentIntent.client_secret).toBeDefined();
      expect(paymentIntent.client_secret).toMatch(/^pi_.*_secret_/);
    });

    it('should retrieve a payment intent', async () => {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: 500,
        currency: 'usd',
      });
      createdPaymentIntents.push(paymentIntent.id);

      const retrieved = await stripe.paymentIntents.retrieve(paymentIntent.id);

      expect(retrieved.id).toBe(paymentIntent.id);
      expect(retrieved.amount).toBe(500);
    });

    it('should cancel a payment intent', async () => {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: 500,
        currency: 'usd',
      });

      const canceled = await stripe.paymentIntents.cancel(paymentIntent.id);

      expect(canceled.status).toBe('canceled');
      // Remove from cleanup list since it's already canceled
    });
  });

  describe('Webhook Signature Verification', () => {
    it('should construct webhook event from valid payload', () => {
      const webhookSecret = 'whsec_test_secret';
      const payload = JSON.stringify({
        id: 'evt_test_webhook',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_test' } },
      });

      // Generate a valid signature
      const timestamp = Math.floor(Date.now() / 1000);
      const signedPayload = `${timestamp}.${payload}`;

      // Use crypto to create HMAC
      const crypto = require('node:crypto');
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(signedPayload)
        .digest('hex');

      const header = `t=${timestamp},v1=${signature}`;

      // This should not throw
      const event = stripe.webhooks.constructEvent(payload, header, webhookSecret);

      expect(event.id).toBe('evt_test_webhook');
      expect(event.type).toBe('payment_intent.succeeded');
    });

    it('should reject invalid webhook signature', () => {
      const webhookSecret = 'whsec_test_secret';
      const payload = JSON.stringify({ id: 'evt_test' });
      const invalidHeader = 't=1234567890,v1=invalid_signature';

      expect(() => {
        stripe.webhooks.constructEvent(payload, invalidHeader, webhookSecret);
      }).toThrow();
    });
  });

  describe('Checkout Session Handling', () => {
    it('should create a checkout session', async () => {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: { name: 'Test Product' },
              unit_amount: 2000,
            },
            quantity: 1,
          },
        ],
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
      });

      expect(session.id).toMatch(/^cs_test_/);
      expect(session.url).toBeDefined();
      expect(session.url).toContain('checkout.stripe.com');
      expect(session.mode).toBe('payment');
      expect(session.status).toBe('open');
    });

    it('should create a subscription checkout session', async () => {
      // First create a product and price
      const product = await stripe.products.create({
        name: 'Test Subscription Product',
      });

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: 999,
        currency: 'usd',
        recurring: { interval: 'month' },
      });

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: price.id, quantity: 1 }],
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
      });

      expect(session.mode).toBe('subscription');
      expect(session.url).toBeDefined();

      // Clean up
      await stripe.products.update(product.id, { active: false });
    });
  });

  describe('Subscription Management', () => {
    it('should list products', async () => {
      const products = await stripe.products.list({ limit: 5 });

      expect(products).toBeDefined();
      expect(Array.isArray(products.data)).toBe(true);
      // Products may or may not exist, but we should get a valid response
    });

    it('should list prices', async () => {
      const prices = await stripe.prices.list({ limit: 5 });

      expect(prices).toBeDefined();
      expect(Array.isArray(prices.data)).toBe(true);
    });

    it('should create and archive a product', async () => {
      const product = await stripe.products.create({
        name: 'Integration Test Product',
        description: 'Created by automated tests',
      });

      expect(product.id).toMatch(/^prod_/);
      expect(product.name).toBe('Integration Test Product');
      expect(product.active).toBe(true);

      // Archive (deactivate) the product
      const archived = await stripe.products.update(product.id, { active: false });

      expect(archived.active).toBe(false);
    });

    it('should create a recurring price', async () => {
      const product = await stripe.products.create({
        name: 'Price Test Product',
      });

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: 1999,
        currency: 'usd',
        recurring: {
          interval: 'month',
          interval_count: 1,
        },
      });

      expect(price.id).toMatch(/^price_/);
      expect(price.unit_amount).toBe(1999);
      expect(price.recurring?.interval).toBe('month');
      expect(price.type).toBe('recurring');

      // Clean up
      await stripe.products.update(product.id, { active: false });
    });
  });
});

describe.skipIf(hasTestKey)('Stripe Integration (skipped)', () => {
  it.skip('STRIPE_SECRET_KEY not configured  -  set sk_test_* key to enable');
});
