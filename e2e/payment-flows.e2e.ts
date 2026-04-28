/**
 * Payment Flow E2E Tests
 *
 * Comprehensive tests for payment processing flows with Stripe integration:
 * Browser → Stripe Elements → API → Database → Stripe Webhooks
 *
 * Tests verify:
 * - Payment intent creation
 * - Stripe Elements interaction
 * - Database transaction records
 * - Webhook processing
 * - Order fulfillment
 */

import { expect, test } from '@playwright/test';
import {
  cleanupTestData,
  createTestDb,
  type DbTestHelper,
  waitForDbRecord,
} from './utils/db-helpers';
import { fillField, waitForApiResponse, waitForNetworkIdle } from './utils/test-helpers';

test.describe('Payment Processing Flows', () => {
  let db: DbTestHelper;

  test.beforeAll(async () => {
    db = createTestDb();
    await db.connect();
  });

  test.afterAll(async () => {
    await db.disconnect();
  });

  test.describe('Checkout Flow', () => {
    const testEmail = `test-payment-${Date.now()}@example.com`;

    test.afterEach(async () => {
      // Clean up test data
      await cleanupTestData(db, 'orders', { column: 'email', value: testEmail });
      await cleanupTestData(db, 'payments', { column: 'email', value: testEmail });
    });

    test('should create payment intent and order in database', async ({ page }) => {
      // 1. Navigate to product page
      await page.goto('/products/test-product');
      await waitForNetworkIdle(page);

      // 2. Add to cart
      await page.click('button:has-text("Add to Cart")');
      await waitForNetworkIdle(page);

      // 3. Take screenshot of cart
      await page.screenshot({
        path: 'test-results/payments/01-add-to-cart.png',
      });

      // 4. Navigate to checkout
      await page.click('a[href="/checkout"], button:has-text("Checkout")');
      await waitForNetworkIdle(page);

      // 5. Fill checkout form
      await fillField(page, 'input[name="email"]', testEmail);
      await fillField(page, 'input[name="name"]', 'Test Customer');
      await fillField(page, 'input[name="address"]', '123 Test St');
      await fillField(page, 'input[name="city"]', 'Test City');
      await fillField(page, 'input[name="zip"]', '12345');

      // 6. Take screenshot of filled form
      await page.screenshot({
        path: 'test-results/payments/02-checkout-form-filled.png',
        fullPage: true,
      });

      // 7. Wait for payment intent creation
      const paymentIntentPromise = waitForApiResponse(page, '/api/payment/create-intent', 'POST');

      // 8. Continue to payment
      await page.click('button:has-text("Continue to Payment")');

      const paymentIntentResponse = await paymentIntentPromise;
      expect(paymentIntentResponse.status()).toBe(200);

      const paymentIntentData = await paymentIntentResponse.json();
      expect(paymentIntentData.clientSecret).toBeTruthy();

      // 9. Verify order created in database
      const order = await waitForDbRecord<{
        id: string;
        email: string;
        status: string;
        total: number;
      }>(db, 'orders', { column: 'email', value: testEmail });

      expect(order).toBeTruthy();
      expect(order?.email).toBe(testEmail);
      expect(order?.status).toBe('pending');

      // 10. Take screenshot of payment form
      await page.waitForSelector('iframe[name^="__privateStripeFrame"]');
      await page.screenshot({
        path: 'test-results/payments/03-stripe-payment-form.png',
        fullPage: true,
      });
    });

    test('should process successful payment and update database', async ({ page }) => {
      // Setup: Create a test order
      const order = await db.insert<{ id: string }>('orders', {
        email: testEmail,
        status: 'pending',
        total: 4999, // $49.99
        created_at: new Date(),
        updated_at: new Date(),
      });

      // 1. Navigate to checkout with existing order
      await page.goto(`/checkout/${order.id}`);
      await waitForNetworkIdle(page);

      // 2. Wait for Stripe Elements to load
      await page.waitForSelector('iframe[name^="__privateStripeFrame"]');

      // 3. Fill Stripe card element (using test card)
      // Note: Stripe Elements are in iframes, requires special handling
      const stripeCardFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first();

      // Stripe test card number
      const cardNumberInput = stripeCardFrame.locator('input[name="cardnumber"]');
      if ((await cardNumberInput.count()) > 0) {
        await cardNumberInput.fill('4242424242424242');

        const expiryInput = stripeCardFrame.locator('input[name="exp-date"]');
        await expiryInput.fill('12/34');

        const cvcInput = stripeCardFrame.locator('input[name="cvc"]');
        await cvcInput.fill('123');

        const zipInput = stripeCardFrame.locator('input[name="postal"]');
        await zipInput.fill('12345');

        // 4. Take screenshot with filled payment details
        await page.screenshot({
          path: 'test-results/payments/04-payment-details-filled.png',
          fullPage: true,
        });
      }

      // 5. Wait for payment confirmation API call
      const confirmPromise = waitForApiResponse(page, '/api/payment/confirm', 'POST');

      // 6. Submit payment
      await page.click('button:has-text("Pay"), button[type="submit"]');

      // 7. Wait for payment confirmation
      const confirmResponse = await confirmPromise;
      expect(confirmResponse.status()).toBe(200);

      // 8. Wait for success redirect
      await page.waitForURL(/\/order\/.*\/success/, { timeout: 10000 });

      // 9. Take screenshot of success page
      await page.screenshot({
        path: 'test-results/payments/05-payment-success.png',
        fullPage: true,
      });

      // 10. Verify order updated in database
      await page.waitForTimeout(1000); // Allow webhook processing time

      const updatedOrder = await db.getById<{ status: string; paid: boolean }>('orders', order.id);

      expect(updatedOrder?.status).toBe('paid');
      expect(updatedOrder?.paid).toBe(true);

      // 11. Verify payment record created
      const payment = await waitForDbRecord<{
        order_id: string;
        status: string;
        amount: number;
      }>(db, 'payments', { column: 'order_id', value: order.id });

      expect(payment).toBeTruthy();
      expect(payment?.status).toBe('succeeded');
      expect(payment?.amount).toBe(4999);
    });

    test('should handle payment failure correctly', async ({ page }) => {
      // Setup: Create a test order
      const order = await db.insert<{ id: string }>('orders', {
        email: testEmail,
        status: 'pending',
        total: 4999,
        created_at: new Date(),
        updated_at: new Date(),
      });

      // 1. Navigate to checkout
      await page.goto(`/checkout/${order.id}`);
      await waitForNetworkIdle(page);

      // 2. Fill Stripe Elements with card that will decline
      await page.waitForSelector('iframe[name^="__privateStripeFrame"]');
      const stripeCardFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first();

      const cardNumberInput = stripeCardFrame.locator('input[name="cardnumber"]');
      if ((await cardNumberInput.count()) > 0) {
        // Use Stripe test card that always declines
        await cardNumberInput.fill('4000000000000002');
        await stripeCardFrame.locator('input[name="exp-date"]').fill('12/34');
        await stripeCardFrame.locator('input[name="cvc"]').fill('123');

        // 3. Submit payment
        await page.click('button:has-text("Pay"), button[type="submit"]');

        // 4. Wait for error handling
        await page.waitForTimeout(2000);

        // 5. Take screenshot of error state
        await page.screenshot({
          path: 'test-results/payments/06-payment-declined.png',
          fullPage: true,
        });

        // 6. Verify error message shown
        await expect(page.locator('text=/declined|payment.*failed/i').first()).toBeVisible();

        // 7. Verify order status in database
        const failedOrder = await db.getById<{ status: string }>('orders', order.id);
        expect(failedOrder?.status).toBe('payment_failed');

        // 8. Verify payment record with failed status
        const failedPayment = await waitForDbRecord<{ status: string }>(db, 'payments', {
          column: 'order_id',
          value: order.id,
        });
        expect(failedPayment?.status).toBe('failed');
      }
    });
  });

  test.describe('Subscription Flow', () => {
    const testEmail = `test-sub-${Date.now()}@example.com`;

    test.afterEach(async () => {
      await cleanupTestData(db, 'subscriptions', {
        column: 'email',
        value: testEmail,
      });
    });

    test('should create subscription and verify in database', async ({ page }) => {
      // 1. Navigate to pricing page
      await page.goto('/pricing');
      await waitForNetworkIdle(page);

      // 2. Take screenshot of pricing options
      await page.screenshot({
        path: 'test-results/payments/07-pricing-page.png',
        fullPage: true,
      });

      // 3. Select a plan
      await page.click('button:has-text("Subscribe"), a[href*="/subscribe"]');
      await waitForNetworkIdle(page);

      // 4. Fill subscription form
      await fillField(page, 'input[name="email"]', testEmail);
      await fillField(page, 'input[name="name"]', 'Test Subscriber');

      // 5. Wait for Stripe Elements
      await page.waitForSelector('iframe[name^="__privateStripeFrame"]');
      const stripeCardFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first();

      const cardNumberInput = stripeCardFrame.locator('input[name="cardnumber"]');
      if ((await cardNumberInput.count()) > 0) {
        await cardNumberInput.fill('4242424242424242');
        await stripeCardFrame.locator('input[name="exp-date"]').fill('12/34');
        await stripeCardFrame.locator('input[name="cvc"]').fill('123');

        // 6. Take screenshot before subscribing
        await page.screenshot({
          path: 'test-results/payments/08-subscription-form.png',
          fullPage: true,
        });

        // 7. Wait for subscription creation
        const subPromise = waitForApiResponse(page, '/api/subscriptions/create', 'POST');

        // 8. Submit subscription
        await page.click('button:has-text("Subscribe Now")');

        const subResponse = await subPromise;
        expect(subResponse.status()).toBe(200);

        // 9. Wait for success
        await page.waitForURL(/\/subscription\/success/, { timeout: 10000 });

        // 10. Take screenshot of success
        await page.screenshot({
          path: 'test-results/payments/09-subscription-success.png',
          fullPage: true,
        });

        // 11. Verify subscription in database
        const subscription = await waitForDbRecord<{
          id: string;
          email: string;
          status: string;
          stripe_subscription_id: string;
        }>(db, 'subscriptions', { column: 'email', value: testEmail });

        expect(subscription).toBeTruthy();
        expect(subscription?.email).toBe(testEmail);
        expect(subscription?.status).toBe('active');
        expect(subscription?.stripe_subscription_id).toBeTruthy();
      }
    });
  });

  test.describe('Refund Flow', () => {
    let orderId: string;
    let paymentId: string;

    test.beforeEach(async () => {
      // Setup: Create completed order and payment
      const order = await db.insert<{ id: string }>('orders', {
        email: 'refund-test@example.com',
        status: 'paid',
        total: 4999,
        paid: true,
        created_at: new Date(),
        updated_at: new Date(),
      });
      orderId = order.id;

      const payment = await db.insert<{ id: string }>('payments', {
        order_id: orderId,
        stripe_payment_intent_id: 'pi_test_123',
        amount: 4999,
        status: 'succeeded',
        created_at: new Date(),
      });
      paymentId = payment.id;
    });

    test.afterEach(async () => {
      await db.delete('payments', paymentId);
      await db.delete('orders', orderId);
    });

    test('should process refund and update database', async ({ page }) => {
      // 1. Navigate to order (admin view)
      await page.goto(`/orders/${orderId}`);
      await waitForNetworkIdle(page);

      // 2. Take screenshot of order details
      await page.screenshot({
        path: 'test-results/payments/10-order-details.png',
        fullPage: true,
      });

      // 3. Click refund button
      const refundButton = page.locator('button:has-text("Refund")');
      if ((await refundButton.count()) > 0) {
        // 4. Handle confirmation
        page.on('dialog', (dialog) => dialog.accept());

        // 5. Wait for refund API call
        const refundPromise = waitForApiResponse(page, '/api/payment/refund', 'POST');

        await refundButton.click();

        const refundResponse = await refundPromise;
        expect(refundResponse.status()).toBe(200);

        // 6. Wait for UI update
        await page.waitForTimeout(1000);

        // 7. Take screenshot of refunded state
        await page.screenshot({
          path: 'test-results/payments/11-order-refunded.png',
          fullPage: true,
        });

        // 8. Verify order status updated
        const refundedOrder = await db.getById<{ status: string }>('orders', orderId);
        expect(refundedOrder?.status).toBe('refunded');

        // 9. Verify refund record created
        const refund = await waitForDbRecord<{
          payment_id: string;
          amount: number;
          status: string;
        }>(db, 'refunds', { column: 'payment_id', value: paymentId });

        expect(refund).toBeTruthy();
        expect(refund?.amount).toBe(4999);
        expect(refund?.status).toBe('succeeded');

        // 10. Verify UI shows refund status
        await expect(page.locator('text=/refunded/i')).toBeVisible();
      }
    });
  });

  test.describe('Webhook Processing', () => {
    test('should process payment.succeeded webhook', async ({ page }) => {
      // This test simulates Stripe webhook processing

      // 1. Create a pending order
      const order = await db.insert<{ id: string }>('orders', {
        email: 'webhook-test@example.com',
        status: 'pending',
        total: 4999,
        stripe_payment_intent_id: 'pi_test_webhook',
        created_at: new Date(),
        updated_at: new Date(),
      });

      // 2. Simulate webhook call (in real scenario, this comes from Stripe)
      const webhookPayload = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_webhook',
            amount: 4999,
            status: 'succeeded',
          },
        },
      };

      // 3. Call webhook endpoint
      const response = await page.request.post('/api/webhooks/stripe', {
        data: webhookPayload,
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': 'test_signature',
        },
      });

      expect(response.status()).toBe(200);

      // 4. Wait for webhook processing
      await page.waitForTimeout(1000);

      // 5. Verify order updated in database
      const updatedOrder = await db.getById<{ status: string; paid: boolean }>('orders', order.id);

      expect(updatedOrder?.status).toBe('paid');
      expect(updatedOrder?.paid).toBe(true);

      // Clean up
      await db.delete('orders', order.id);
    });
  });

  test.describe('Payment Methods', () => {
    test('should save payment method for future use', async ({ page }) => {
      const testEmail = `save-card-${Date.now()}@example.com`;

      // 1. Navigate to payment methods page
      await page.goto('/account/payment-methods');
      await waitForNetworkIdle(page);

      // 2. Click add payment method
      await page.click('button:has-text("Add Payment Method")');
      await waitForNetworkIdle(page);

      // 3. Fill Stripe Elements
      await page.waitForSelector('iframe[name^="__privateStripeFrame"]');
      const stripeFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first();

      const cardInput = stripeFrame.locator('input[name="cardnumber"]');
      if ((await cardInput.count()) > 0) {
        await cardInput.fill('4242424242424242');
        await stripeFrame.locator('input[name="exp-date"]').fill('12/34');
        await stripeFrame.locator('input[name="cvc"]').fill('123');

        // 4. Save payment method
        await page.click('button:has-text("Save Card")');
        await waitForNetworkIdle(page);

        // 5. Verify saved in database
        const savedCard = await waitForDbRecord<{
          stripe_payment_method_id: string;
          last4: string;
        }>(db, 'payment_methods', { column: 'user_email', value: testEmail });

        expect(savedCard).toBeTruthy();
        expect(savedCard?.last4).toBe('4242');

        // 6. Take screenshot
        await page.screenshot({
          path: 'test-results/payments/12-saved-payment-method.png',
        });

        // Clean up
        if (savedCard) {
          await db.query('DELETE FROM payment_methods WHERE stripe_payment_method_id = $1', [
            savedCard.stripe_payment_method_id,
          ]);
        }
      }
    });
  });
});
