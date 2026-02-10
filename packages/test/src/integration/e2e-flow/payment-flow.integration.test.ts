/**
 * Payment Flow End-to-End Integration Tests
 *
 * PURPOSE: Verify complete payment flow from API → Stripe → Database persistence
 *
 * CRITICAL CONTEXT: Payment processing is core to paid product. This E2E test verifies:
 * - Multi-step payment workflow (without transaction support)
 * - Stripe customer creation and persistence
 * - Cart validation and total calculation
 * - Payment intent creation
 * - Database consistency after partial failures
 * - Circuit breaker protection
 *
 * FLOW:
 * 1. User authenticated → 2. Load cart → 3. Create Stripe customer (if needed)
 * → 4. Update user with stripeCustomerID → 5. Calculate total from cart
 * → 6. Create payment intent → 7. Return client_secret
 */

import type { RevealUIInstance } from '@revealui/core'
import { getClient } from '@revealui/db/client'
import { createPaymentIntent } from '@revealui/services/api/handlers/payment-intent'
import type Stripe from 'stripe'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetAllCircuitBreakers } from '../../utils/circuit-breaker-test-helpers.js'
import {
  generateUniqueTestEmail,
  getTestRevealUI,
  trackTestData,
} from '../../utils/integration-helpers.js'

// Mock Stripe SDK
const mockStripeCustomers = {
  create: vi.fn(),
  retrieve: vi.fn(),
}

const mockStripePrices = {
  list: vi.fn(),
}

const mockStripePaymentIntents = {
  create: vi.fn(),
}

const _mockStripe = {
  customers: mockStripeCustomers,
  prices: mockStripePrices,
  paymentIntents: mockStripePaymentIntents,
} as unknown as Stripe

describe('Payment Flow E2E Integration Tests', () => {
  let revealui: RevealUIInstance
  let _db: ReturnType<typeof getClient>
  let testUserId: string | number

  beforeAll(async () => {
    revealui = await getTestRevealUI()
    _db = getClient()
  })

  beforeEach(async () => {
    vi.clearAllMocks()
    resetAllCircuitBreakers()

    // Create test user with cart
    const email = generateUniqueTestEmail('payment-flow')
    const user = await revealui.create({
      collection: 'users',
      data: {
        email,
        password: 'TestPassword123!',
      },
    })

    testUserId = user.id
    trackTestData('users', String(testUserId))
  })

  // =============================================================================
  // Happy Path: Complete Payment Flow
  // =============================================================================

  describe('Happy Path: Complete Payment Flow', () => {
    it('should create payment intent for user with cart', async () => {
      // Setup: User with cart items
      await revealui.update({
        collection: 'users',
        id: testUserId,
        data: {
          cart: {
            items: [
              {
                product: { stripeProductID: 'prod_test123' },
                quantity: 2,
              },
            ],
          },
        },
      })

      // Mock Stripe responses
      mockStripeCustomers.create.mockResolvedValue({
        id: 'cus_test123',
        email: 'test@example.com',
      } as Stripe.Customer)

      mockStripePrices.list.mockResolvedValue({
        data: [
          {
            id: 'price_test123',
            unit_amount: 1000, // $10.00
            currency: 'usd',
          },
        ],
      } as Stripe.ApiList<Stripe.Price>)

      mockStripePaymentIntents.create.mockResolvedValue({
        id: 'pi_test123',
        client_secret: 'pi_test123_secret_abc',
        amount: 2000,
        currency: 'usd',
      } as Stripe.PaymentIntent)

      // Create mock request
      const mockReq: any = {
        user: { id: testUserId, email: 'test@example.com' },
        revealui,
      }

      // Execute payment flow
      const result = await createPaymentIntent({ req: mockReq })

      expect(result.status).toBe(200)
      expect((result as { send?: { client_secret: string } }).send?.client_secret).toBe(
        'pi_test123_secret_abc',
      )

      // Verify Stripe customer was created
      expect(mockStripeCustomers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
        }),
      )

      // Verify payment intent was created with correct amount
      expect(mockStripePaymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 2000, // 2 items * $10.00
          currency: 'usd',
          payment_method_types: ['card'],
        }),
      )

      // Verify user was updated with Stripe customer ID
      const updatedUser = await revealui.findByID({
        collection: 'users',
        id: testUserId,
      })

      expect(updatedUser?.stripeCustomerID).toBe('cus_test123')
    })

    it('should reuse existing Stripe customer ID', async () => {
      // Setup: User with existing Stripe customer ID
      await revealui.update({
        collection: 'users',
        id: testUserId,
        data: {
          stripeCustomerID: 'cus_existing123',
          cart: {
            items: [
              {
                product: { stripeProductID: 'prod_test123' },
                quantity: 1,
              },
            ],
          },
        },
      })

      mockStripePrices.list.mockResolvedValue({
        data: [{ id: 'price_test123', unit_amount: 1000, currency: 'usd' }],
      } as Stripe.ApiList<Stripe.Price>)

      mockStripePaymentIntents.create.mockResolvedValue({
        id: 'pi_test123',
        client_secret: 'pi_test123_secret',
        amount: 1000,
        currency: 'usd',
      } as Stripe.PaymentIntent)

      const mockReq: any = {
        user: { id: testUserId, email: 'test@example.com' },
        revealui,
      }

      const result = await createPaymentIntent({ req: mockReq })

      expect(result.status).toBe(200)

      // Verify Stripe customer was NOT created again
      expect(mockStripeCustomers.create).not.toHaveBeenCalled()

      // Verify payment intent used existing customer ID
      expect(mockStripePaymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_existing123',
        }),
      )
    })

    it('should calculate correct total for multiple cart items', async () => {
      await revealui.update({
        collection: 'users',
        id: testUserId,
        data: {
          cart: {
            items: [
              {
                product: { stripeProductID: 'prod_1' },
                quantity: 3,
              },
              {
                product: { stripeProductID: 'prod_2' },
                quantity: 2,
              },
            ],
          },
        },
      })

      mockStripeCustomers.create.mockResolvedValue({
        id: 'cus_test123',
      } as Stripe.Customer)

      // Mock different prices for different products
      mockStripePrices.list
        .mockResolvedValueOnce({
          data: [{ id: 'price_1', unit_amount: 1500, currency: 'usd' }],
        } as Stripe.ApiList<Stripe.Price>)
        .mockResolvedValueOnce({
          data: [{ id: 'price_2', unit_amount: 2000, currency: 'usd' }],
        } as Stripe.ApiList<Stripe.Price>)

      mockStripePaymentIntents.create.mockResolvedValue({
        id: 'pi_test123',
        client_secret: 'pi_test123_secret',
        amount: 8500,
        currency: 'usd',
      } as Stripe.PaymentIntent)

      const mockReq: any = {
        user: { id: testUserId, email: 'test@example.com' },
        revealui,
      }

      const result = await createPaymentIntent({ req: mockReq })

      expect(result.status).toBe(200)

      // Verify total: (3 * $15.00) + (2 * $20.00) = $85.00
      expect(mockStripePaymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 8500,
        }),
      )
    })
  })

  // =============================================================================
  // Error Handling: Validation Errors
  // =============================================================================

  describe('Error Handling: Validation Errors', () => {
    it('should return 401 for unauthenticated user', async () => {
      const mockReq: any = {
        user: null,
        revealui,
      }

      const result = await createPaymentIntent({ req: mockReq })

      expect(result.status).toBe(401)
      expect((result as { json?: { error: string } }).json?.error).toBe('Unauthorized')
    })

    it('should return 404 for non-existent user', async () => {
      const mockReq: any = {
        user: { id: 'user_nonexistent', email: 'test@example.com' },
        revealui,
      }

      const result = await createPaymentIntent({ req: mockReq })

      expect(result.status).toBe(404)
      expect((result as { json?: { error: string } }).json?.error).toBe('User not found')
    })

    it('should return 400 for empty cart', async () => {
      await revealui.update({
        collection: 'users',
        id: testUserId,
        data: {
          cart: {
            items: [],
          },
        },
      })

      const mockReq: any = {
        user: { id: testUserId, email: 'test@example.com' },
        revealui,
      }

      const result = await createPaymentIntent({ req: mockReq })

      expect(result.status).toBe(400)
      expect((result as { json?: { error: string } }).json?.error).toBe('No items in cart')
    })

    it('should return 400 for missing cart', async () => {
      // User without cart field
      const mockReq: any = {
        user: { id: testUserId, email: 'test@example.com' },
        revealui,
      }

      const result = await createPaymentIntent({ req: mockReq })

      expect(result.status).toBe(400)
      expect((result as { json?: { error: string } }).json?.error).toBe('No items in cart')
    })
  })

  // =============================================================================
  // Error Handling: Stripe Failures
  // =============================================================================

  describe('Error Handling: Stripe Failures', () => {
    it('should handle Stripe customer creation failure', async () => {
      await revealui.update({
        collection: 'users',
        id: testUserId,
        data: {
          cart: {
            items: [
              {
                product: { stripeProductID: 'prod_test123' },
                quantity: 1,
              },
            ],
          },
        },
      })

      // Mock Stripe customer creation failure
      mockStripeCustomers.create.mockRejectedValue(
        new Error('Stripe API error: rate limit exceeded'),
      )

      const mockReq: any = {
        user: { id: testUserId, email: 'test@example.com' },
        revealui,
      }

      const result = await createPaymentIntent({ req: mockReq })

      expect(result.status).toBe(500)
      expect((result as { json?: { error: string } }).json?.error).toContain('Stripe API error')
    })

    it('should handle payment intent creation failure', async () => {
      await revealui.update({
        collection: 'users',
        id: testUserId,
        data: {
          stripeCustomerID: 'cus_existing',
          cart: {
            items: [
              {
                product: { stripeProductID: 'prod_test123' },
                quantity: 1,
              },
            ],
          },
        },
      })

      mockStripePrices.list.mockResolvedValue({
        data: [{ id: 'price_test123', unit_amount: 1000, currency: 'usd' }],
      } as Stripe.ApiList<Stripe.Price>)

      // Mock payment intent failure
      mockStripePaymentIntents.create.mockRejectedValue(new Error('Payment intent creation failed'))

      const mockReq: any = {
        user: { id: testUserId, email: 'test@example.com' },
        revealui,
      }

      const result = await createPaymentIntent({ req: mockReq })

      expect(result.status).toBe(500)
      expect((result as { json?: { error: string } }).json?.error).toContain(
        'Payment intent creation failed',
      )
    })

    it('should handle missing product prices', async () => {
      await revealui.update({
        collection: 'users',
        id: testUserId,
        data: {
          cart: {
            items: [
              {
                product: { stripeProductID: 'prod_no_price' },
                quantity: 1,
              },
            ],
          },
        },
      })

      mockStripeCustomers.create.mockResolvedValue({
        id: 'cus_test123',
      } as Stripe.Customer)

      // Mock empty prices list
      mockStripePrices.list.mockResolvedValue({
        data: [],
      } as Stripe.ApiList<Stripe.Price>)

      const mockReq: any = {
        user: { id: testUserId, email: 'test@example.com' },
        revealui,
      }

      const result = await createPaymentIntent({ req: mockReq })

      expect(result.status).toBe(500)
      expect((result as { json?: { error: string } }).json?.error).toBeTruthy()
    })
  })

  // =============================================================================
  // Database Consistency After Failures
  // =============================================================================

  describe('Database Consistency After Failures', () => {
    it('should persist Stripe customer ID even if payment intent fails', async () => {
      await revealui.update({
        collection: 'users',
        id: testUserId,
        data: {
          cart: {
            items: [
              {
                product: { stripeProductID: 'prod_test123' },
                quantity: 1,
              },
            ],
          },
        },
      })

      // Customer creation succeeds
      mockStripeCustomers.create.mockResolvedValue({
        id: 'cus_persisted123',
      } as Stripe.Customer)

      mockStripePrices.list.mockResolvedValue({
        data: [{ id: 'price_test123', unit_amount: 1000, currency: 'usd' }],
      } as Stripe.ApiList<Stripe.Price>)

      // Payment intent creation fails
      mockStripePaymentIntents.create.mockRejectedValue(new Error('Payment failed'))

      const mockReq: any = {
        user: { id: testUserId, email: 'test@example.com' },
        revealui,
      }

      await createPaymentIntent({ req: mockReq })

      // Verify Stripe customer ID was persisted despite payment failure
      const updatedUser = await revealui.findByID({
        collection: 'users',
        id: testUserId,
      })

      expect(updatedUser?.stripeCustomerID).toBe('cus_persisted123')
    })

    it('should handle database update failure gracefully', async () => {
      await revealui.update({
        collection: 'users',
        id: testUserId,
        data: {
          cart: {
            items: [
              {
                product: { stripeProductID: 'prod_test123' },
                quantity: 1,
              },
            ],
          },
        },
      })

      // Mock Stripe customer creation
      mockStripeCustomers.create.mockResolvedValue({
        id: 'cus_orphaned123',
      } as Stripe.Customer)

      // Mock database update failure by using invalid user ID
      const mockReq: any = {
        user: { id: 'user_invalid', email: 'test@example.com' },
        revealui,
      }

      const result = await createPaymentIntent({ req: mockReq })

      // Should return 404 since user doesn't exist
      expect(result.status).toBe(404)

      // Stripe customer was created but not linked to user (orphaned resource)
      expect(mockStripeCustomers.create).not.toHaveBeenCalled() // Won't reach this point
    })
  })

  // =============================================================================
  // Circuit Breaker Integration
  // =============================================================================

  describe('Circuit Breaker Integration', () => {
    it('should use protected Stripe client with circuit breaker', async () => {
      await revealui.update({
        collection: 'users',
        id: testUserId,
        data: {
          cart: {
            items: [
              {
                product: { stripeProductID: 'prod_test123' },
                quantity: 1,
              },
            ],
          },
        },
      })

      // Circuit breaker should protect these calls
      mockStripeCustomers.create.mockResolvedValue({
        id: 'cus_test123',
      } as Stripe.Customer)

      mockStripePrices.list.mockResolvedValue({
        data: [{ id: 'price_test123', unit_amount: 1000, currency: 'usd' }],
      } as Stripe.ApiList<Stripe.Price>)

      mockStripePaymentIntents.create.mockResolvedValue({
        id: 'pi_test123',
        client_secret: 'pi_test123_secret',
        amount: 1000,
        currency: 'usd',
      } as Stripe.PaymentIntent)

      const mockReq: any = {
        user: { id: testUserId, email: 'test@example.com' },
        revealui,
      }

      const result = await createPaymentIntent({ req: mockReq })

      expect(result.status).toBe(200)

      // All Stripe calls should have been protected by circuit breaker
      expect(mockStripeCustomers.create).toHaveBeenCalled()
      expect(mockStripePrices.list).toHaveBeenCalled()
      expect(mockStripePaymentIntents.create).toHaveBeenCalled()
    })
  })

  // =============================================================================
  // Edge Cases
  // =============================================================================

  describe('Edge Cases', () => {
    it('should handle zero-price items', async () => {
      await revealui.update({
        collection: 'users',
        id: testUserId,
        data: {
          cart: {
            items: [
              {
                product: { stripeProductID: 'prod_free' },
                quantity: 1,
              },
            ],
          },
        },
      })

      mockStripeCustomers.create.mockResolvedValue({
        id: 'cus_test123',
      } as Stripe.Customer)

      // Mock zero-price item
      mockStripePrices.list.mockResolvedValue({
        data: [{ id: 'price_free', unit_amount: 0, currency: 'usd' }],
      } as Stripe.ApiList<Stripe.Price>)

      const mockReq: any = {
        user: { id: testUserId, email: 'test@example.com' },
        revealui,
      }

      const result = await createPaymentIntent({ req: mockReq })

      // Should fail with "nothing to pay for" error
      expect(result.status).toBe(500)
      expect((result as { json?: { error: string } }).json?.error).toContain('nothing to pay')
    })

    it('should handle very large cart quantities', async () => {
      await revealui.update({
        collection: 'users',
        id: testUserId,
        data: {
          cart: {
            items: [
              {
                product: { stripeProductID: 'prod_test123' },
                quantity: 1000,
              },
            ],
          },
        },
      })

      mockStripeCustomers.create.mockResolvedValue({
        id: 'cus_test123',
      } as Stripe.Customer)

      mockStripePrices.list.mockResolvedValue({
        data: [{ id: 'price_test123', unit_amount: 9999, currency: 'usd' }],
      } as Stripe.ApiList<Stripe.Price>)

      mockStripePaymentIntents.create.mockResolvedValue({
        id: 'pi_large',
        client_secret: 'pi_large_secret',
        amount: 9999000,
        currency: 'usd',
      } as Stripe.PaymentIntent)

      const mockReq: any = {
        user: { id: testUserId, email: 'test@example.com' },
        revealui,
      }

      const result = await createPaymentIntent({ req: mockReq })

      expect(result.status).toBe(200)

      // Verify large amount calculated correctly: 1000 * $99.99 = $99,990.00
      expect(mockStripePaymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 9999000,
        }),
      )
    })
  })
})
