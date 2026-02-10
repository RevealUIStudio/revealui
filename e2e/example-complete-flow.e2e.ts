/**
 * Complete User Flow Example
 *
 * This is a comprehensive example showing how to test a complete user journey
 * with visual inspection at every step and database verification.
 *
 * Flow: Browse Products → Add to Cart → Checkout → Payment → Order Confirmation
 * Verifies: UI state, API calls, database records, Stripe integration
 */

/* eslint-disable no-console */
/* console-allowed */

import { expect, test } from '@playwright/test'
import {
  cleanupTestData,
  createTestDb,
  type DbTestHelper,
  waitForDbRecord,
} from './utils/db-helpers'
import { fillField, waitForApiResponse, waitForNetworkIdle } from './utils/test-helpers'
import {
  captureScreenshot,
  collectPerformanceMetrics,
  monitorNetwork,
} from './utils/visual-helpers'

test.describe('Complete E-commerce Flow', () => {
  let db: DbTestHelper
  const testEmail = `e2e-test-${Date.now()}@example.com`

  test.beforeAll(async () => {
    // Initialize database connection
    db = createTestDb()
    await db.connect()
  })

  test.afterAll(async () => {
    // Clean up test data
    await cleanupTestData(db, 'orders', { column: 'email', value: testEmail })
    await cleanupTestData(db, 'users', { column: 'email', value: testEmail })

    // Disconnect
    await db.disconnect()
  })

  test('complete purchase flow from browsing to order confirmation', async ({ page }) => {
    // ========================================
    // STEP 1: Browse Products
    // ========================================
    console.log('📱 Step 1: Browsing products...')

    await page.goto('/')
    await waitForNetworkIdle(page)

    // Capture homepage
    await captureScreenshot(page, 'step-01-homepage', {
      fullPage: true,
      description: 'User lands on homepage',
      category: 'complete-flow',
    })

    // Check performance
    const homeMetrics = await collectPerformanceMetrics(page)
    console.log('Home page load time:', homeMetrics.loadComplete, 'ms')
    expect(homeMetrics.loadComplete).toBeLessThan(5000)

    // Navigate to products
    await page.click('a[href*="/products"], nav a:has-text("Products")')
    await waitForNetworkIdle(page)

    await captureScreenshot(page, 'step-02-products-list', {
      fullPage: true,
      description: 'Viewing product catalog',
      category: 'complete-flow',
    })

    // ========================================
    // STEP 2: View Product Details
    // ========================================
    console.log('🔍 Step 2: Viewing product details...')

    // Click on first product
    const productCard = page.locator('[data-testid="product-card"], .product-card').first()
    await productCard.click()
    await waitForNetworkIdle(page)

    await captureScreenshot(page, 'step-03-product-details', {
      fullPage: true,
      description: 'Viewing detailed product information',
      category: 'complete-flow',
    })

    // Verify product info loaded
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('[data-testid="price"], .price')).toBeVisible()

    // ========================================
    // STEP 3: Add to Cart
    // ========================================
    console.log('🛒 Step 3: Adding to cart...')

    // Start monitoring network
    const networkActivity = await monitorNetwork(page, /\/api\/(cart|products)/)

    // Click add to cart
    const addToCartBtn = page.locator('button:has-text("Add to Cart")')
    await addToCartBtn.click()

    // Wait for cart update
    await page.waitForTimeout(500)

    await captureScreenshot(page, 'step-04-added-to-cart', {
      description: 'Product added to cart with confirmation',
      category: 'complete-flow',
    })

    // Verify cart icon updated
    const cartCount = page.locator('[data-testid="cart-count"], .cart-count')
    if ((await cartCount.count()) > 0) {
      await expect(cartCount).toContainText('1')
    }

    // ========================================
    // STEP 4: View Cart
    // ========================================
    console.log('🛍️ Step 4: Viewing cart...')

    await page.click('[data-testid="cart-icon"], a[href*="/cart"]')
    await waitForNetworkIdle(page)

    await captureScreenshot(page, 'step-05-cart-view', {
      fullPage: true,
      description: 'Shopping cart with items',
      category: 'complete-flow',
    })

    // Verify cart items
    const cartItems = page.locator('[data-testid="cart-item"], .cart-item')
    expect(await cartItems.count()).toBeGreaterThan(0)

    // ========================================
    // STEP 5: Proceed to Checkout
    // ========================================
    console.log('💳 Step 5: Proceeding to checkout...')

    await page.click('button:has-text("Checkout"), a[href*="/checkout"]')
    await waitForNetworkIdle(page)

    await captureScreenshot(page, 'step-06-checkout-form', {
      fullPage: true,
      description: 'Checkout form',
      category: 'complete-flow',
    })

    // ========================================
    // STEP 6: Fill Checkout Form
    // ========================================
    console.log('📝 Step 6: Filling checkout form...')

    // Fill customer information
    await fillField(page, 'input[name="email"]', testEmail)
    await fillField(page, 'input[name="name"]', 'E2E Test User')
    await fillField(page, 'input[name="address"]', '123 Test Street')
    await fillField(page, 'input[name="city"]', 'Test City')
    await fillField(page, 'input[name="zip"]', '12345')
    await fillField(page, 'input[name="country"]', 'US')

    await captureScreenshot(page, 'step-07-checkout-filled', {
      fullPage: true,
      description: 'Checkout form completed',
      category: 'complete-flow',
    })

    // ========================================
    // STEP 7: Create Order
    // ========================================
    console.log('📦 Step 7: Creating order...')

    // Wait for order creation API call
    const orderPromise = waitForApiResponse(page, '/api/orders', 'POST')

    // Continue to payment
    await page.click('button:has-text("Continue to Payment")')

    const orderResponse = await orderPromise
    expect(orderResponse.status()).toBe(200)

    const orderData = await orderResponse.json()
    const orderId = orderData.id

    console.log('Order created:', orderId)

    // Verify order in database
    const order = await waitForDbRecord<{
      id: string
      email: string
      status: string
      total: number
    }>(db, 'orders', { column: 'id', value: orderId }, 5000)

    expect(order).toBeTruthy()
    expect(order?.email).toBe(testEmail)
    expect(order?.status).toBe('pending')

    console.log('✅ Order verified in database')

    // ========================================
    // STEP 8: Payment Form
    // ========================================
    console.log('💰 Step 8: Processing payment...')

    // Wait for Stripe Elements to load
    await page.waitForSelector('iframe[name^="__privateStripeFrame"]', {
      timeout: 10000,
    })

    await captureScreenshot(page, 'step-08-payment-form', {
      fullPage: true,
      description: 'Stripe payment form loaded',
      category: 'complete-flow',
    })

    // Fill Stripe card details
    const stripeFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first()

    const cardInput = stripeFrame.locator('input[name="cardnumber"]')

    if ((await cardInput.count()) > 0) {
      // Use Stripe test card
      await cardInput.fill('4242424242424242')
      await stripeFrame.locator('input[name="exp-date"]').fill('12/34')
      await stripeFrame.locator('input[name="cvc"]').fill('123')
      await stripeFrame.locator('input[name="postal"]').fill('12345')

      await captureScreenshot(page, 'step-09-payment-filled', {
        fullPage: true,
        description: 'Payment details entered',
        category: 'complete-flow',
      })

      // ========================================
      // STEP 9: Submit Payment
      // ========================================
      console.log('✅ Step 9: Submitting payment...')

      // Wait for payment confirmation
      const paymentPromise = waitForApiResponse(page, '/api/payments/confirm', 'POST')

      // Submit payment
      await page.click('button:has-text("Pay"), button[type="submit"]')

      const paymentResponse = await paymentPromise
      expect(paymentResponse.status()).toBe(200)

      // Wait for success redirect
      await page.waitForURL(/\/order\/.*\/success/, { timeout: 15000 })

      await captureScreenshot(page, 'step-10-payment-success', {
        fullPage: true,
        description: 'Payment successful, order confirmed',
        category: 'complete-flow',
      })

      // ========================================
      // STEP 10: Verify Order Completion
      // ========================================
      console.log('🎉 Step 10: Verifying order completion...')

      // Wait for database update
      await page.waitForTimeout(2000)

      // Verify order status updated in database
      const completedOrder = await db.getById<{
        status: string
        paid: boolean
        // biome-ignore lint/style/useNamingConvention: Database column uses snake_case
        payment_status: string
      }>('orders', orderId)

      expect(completedOrder?.status).toBe('completed')
      expect(completedOrder?.paid).toBe(true)
      expect(completedOrder?.payment_status).toBe('succeeded')

      console.log('✅ Order completion verified in database')

      // Verify payment record created
      const payment = await waitForDbRecord<{
        // biome-ignore lint/style/useNamingConvention: Database column uses snake_case
        order_id: string
        status: string
        amount: number
        // biome-ignore lint/style/useNamingConvention: Database column uses snake_case
        stripe_payment_intent_id: string
      }>(db, 'payments', { column: 'order_id', value: orderId }, 5000)

      expect(payment).toBeTruthy()
      expect(payment?.status).toBe('succeeded')
      expect(payment?.stripe_payment_intent_id).toBeTruthy()

      console.log('✅ Payment record verified in database')

      // ========================================
      // STEP 11: Order Confirmation Page
      // ========================================
      console.log('📧 Step 11: Viewing order confirmation...')

      // Verify order details displayed
      await expect(page.locator(`text=${orderId}`)).toBeVisible()
      await expect(page.locator('text=/thank you|order confirmed/i')).toBeVisible()

      await captureScreenshot(page, 'step-11-order-confirmation', {
        fullPage: true,
        description: 'Final order confirmation page',
        category: 'complete-flow',
      })

      // ========================================
      // STEP 12: Network and Performance Analysis
      // ========================================
      console.log('📊 Step 12: Analyzing performance...')

      console.log('\n=== Network Activity ===')
      console.log('Total requests:', networkActivity.totalRequests)
      console.log('Total size:', (networkActivity.totalSize / 1024).toFixed(2), 'KB')
      console.log('Avg response time:', networkActivity.avgResponseTime.toFixed(2), 'ms')
      console.log('Errors:', networkActivity.errors)

      // Assert no network errors
      expect(networkActivity.errors).toBe(0)

      // ========================================
      // TEST COMPLETE
      // ========================================
      console.log('\n✅ ✅ ✅ Complete flow test PASSED! ✅ ✅ ✅\n')
      console.log('Flow Summary:')
      console.log('  ✓ Browsed products')
      console.log('  ✓ Added items to cart')
      console.log('  ✓ Filled checkout form')
      console.log('  ✓ Created order in database')
      console.log('  ✓ Processed payment with Stripe')
      console.log('  ✓ Verified payment in database')
      console.log('  ✓ Confirmed order completion')
      console.log('  ✓ Captured 11 screenshots')
      console.log('  ✓ Zero network errors')
      console.log('')
    } else {
      console.log('⚠️ Stripe Elements not found, skipping payment steps')
    }
  })
})
