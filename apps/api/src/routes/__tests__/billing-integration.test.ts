/**
 * Billing Integration Tests — OV-3
 *
 * Tests billing endpoints against real Stripe test-mode API.
 * These tests require STRIPE_SECRET_KEY (test mode) to be set.
 * Tagged as integration — run separately from unit tests.
 *
 * @group integration
 */

import Stripe from 'stripe';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY ?? '';
const isTestKey = STRIPE_KEY.startsWith('sk_test_');
const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === 'true';

// Skip unless explicitly opted in AND a test-mode key is present
const describeIf = isTestKey && integrationEnabled ? describe : describe.skip;

let stripe: Stripe;
let testCustomerId: string;

describeIf('Stripe Integration Tests (OV-3)', () => {
  beforeAll(() => {
    stripe = new Stripe(STRIPE_KEY);
  });

  afterAll(async () => {
    // Clean up test customer
    if (testCustomerId) {
      try {
        await stripe.customers.del(testCustomerId);
      } catch {
        // Customer may already be deleted
      }
    }
  });

  describe('OV-3.1: Checkout Session Creation', () => {
    it('creates a checkout session with valid parameters', async () => {
      // Create a test customer first
      const customer = await stripe.customers.create({
        email: `ov3-test-${Date.now()}@test.revealui.com`,
        metadata: { test: 'ov3-integration' },
      });
      testCustomerId = customer.id;

      expect(customer.id).toMatch(/^cus_/);

      // Create a checkout session (subscription mode)
      const session = await stripe.checkout.sessions.create({
        customer: customer.id,
        mode: 'subscription',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'OV-3 Test Product',
                metadata: { test: 'true' },
              },
              recurring: { interval: 'month' },
              unit_amount: 100, // $1.00 test
            },
            quantity: 1,
          },
        ],
        success_url: 'https://admin.revealui.com/account/billing?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'https://admin.revealui.com/account/billing?canceled=true',
        metadata: {
          revealui_user_id: 'test-user-ov3',
          tier: 'pro',
        },
      });

      expect(session.id).toMatch(/^cs_test_/);
      expect(session.url).toContain('checkout.stripe.com');
      expect(session.mode).toBe('subscription');
      expect(session.metadata?.tier).toBe('pro');
    });
  });

  describe('OV-3.2: Webhook Signature Verification', () => {
    it('generates and verifies a valid webhook signature', async () => {
      const payload = JSON.stringify({
        id: 'evt_test_ov3',
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_test_ov3' } },
      });

      const webhookSecret = 'whsec_test_secret_ov3_verification'; // gitleaks:allow
      const timestamp = Math.floor(Date.now() / 1000);

      // Generate signature the same way Stripe does
      const signedPayload = `${timestamp}.${payload}`;
      const crypto = require('node:crypto');
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(signedPayload)
        .digest('hex');

      const header = `t=${timestamp},v1=${signature}`;

      // Verify with Stripe's async library method
      const event = await stripe.webhooks.constructEventAsync(payload, header, webhookSecret);

      expect(event.id).toBe('evt_test_ov3');
      expect(event.type).toBe('checkout.session.completed');
    });

    it('rejects tampered payloads', async () => {
      const payload = JSON.stringify({ id: 'evt_test_ov3', type: 'test' });
      const webhookSecret = 'whsec_test_secret_ov3_tamper'; // gitleaks:allow
      const timestamp = Math.floor(Date.now() / 1000);

      const crypto = require('node:crypto');
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(`${timestamp}.${payload}`)
        .digest('hex');

      const header = `t=${timestamp},v1=${signature}`;

      // Tamper with the payload
      const tamperedPayload = JSON.stringify({ id: 'evt_HACKED', type: 'test' });

      await expect(
        stripe.webhooks.constructEventAsync(tamperedPayload, header, webhookSecret),
      ).rejects.toThrow();
    });

    it('rejects expired timestamps', async () => {
      const payload = JSON.stringify({ id: 'evt_test_ov3', type: 'test' });
      const webhookSecret = 'whsec_test_secret_ov3_expiry'; // gitleaks:allow
      // 10 minutes ago — Stripe's default tolerance is 5 minutes
      const oldTimestamp = Math.floor(Date.now() / 1000) - 600;

      const crypto = require('node:crypto');
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(`${oldTimestamp}.${payload}`)
        .digest('hex');

      const header = `t=${oldTimestamp},v1=${signature}`;

      await expect(
        stripe.webhooks.constructEventAsync(payload, header, webhookSecret),
      ).rejects.toThrow(/timestamp/i);
    });
  });

  describe('OV-3.3: Subscription Updates', () => {
    it('lists subscriptions for a customer', async () => {
      // Use the test customer if available
      if (!testCustomerId) return;

      const subscriptions = await stripe.subscriptions.list({
        customer: testCustomerId,
        limit: 10,
      });

      // New customer should have no subscriptions
      expect(subscriptions.data).toBeDefined();
      expect(Array.isArray(subscriptions.data)).toBe(true);
    });
  });

  describe('OV-3.4: Refund Processing', () => {
    it('Stripe refund API is accessible', async () => {
      // We can't create a real refund without a real charge,
      // but we can verify the API rejects an invalid charge ID properly
      try {
        await stripe.refunds.create({
          charge: 'ch_nonexistent_ov3_test',
        });
        // Should not succeed
        expect.unreachable('Should have thrown');
      } catch (error) {
        // Stripe should return a proper error, not crash
        expect(error).toBeDefined();
        expect((error as Stripe.errors.StripeError).type).toBe('StripeInvalidRequestError');
      }
    });
  });

  describe('OV-3.5: Pricing Products', () => {
    it('can list products from Stripe', async () => {
      const products = await stripe.products.list({
        limit: 10,
        active: true,
      });

      expect(products.data).toBeDefined();
      expect(Array.isArray(products.data)).toBe(true);
      // Products may or may not exist in test mode — the API call itself is the test
    });

    it('can list prices from Stripe', async () => {
      const prices = await stripe.prices.list({
        limit: 10,
        active: true,
      });

      expect(prices.data).toBeDefined();
      expect(Array.isArray(prices.data)).toBe(true);
    });
  });
});
