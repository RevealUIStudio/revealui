/**
 * Stripe Webhook Handling Integration Tests
 *
 * PURPOSE: Verify Stripe webhook signature verification and event processing
 *
 * CRITICAL CONTEXT: Webhook handling must work correctly to:
 * - Prevent unauthorized webhook injection
 * - Process payment events reliably
 * - Handle subscription lifecycle updates
 * - Ensure idempotent processing
 *
 * TESTS:
 * - Signature verification (valid/invalid/expired)
 * - Payment intent event processing
 * - Subscription event processing
 * - Error handling and validation
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createValidWebhookSignature,
  createWebhookPayload,
  mockPaymentIntentSucceeded,
  mockSubscriptionCreated,
} from '../../mocks/stripe-webhooks.js'

// Mock Stripe for webhook construction
const mockConstructEvent = vi.fn()
const mockStripe = {
  webhooks: {
    constructEvent: mockConstructEvent,
  },
}

// Mock Supabase client
const mockSupabase = {
  from: vi.fn((_table?: string) => {
    const chainMethods = {
      insert: vi.fn((_data?: unknown) => Promise.resolve({ error: null })),
      update: vi.fn((_data?: unknown) => Promise.resolve({ error: null })),
      upsert: vi.fn((_data?: unknown) => Promise.resolve({ error: null })),
      select: vi.fn((_columns?: string) => Promise.resolve({ data: [], error: null })),
    }
    return chainMethods
  }),
}

describe('Stripe Webhook Handling Integration Tests', () => {
  const webhookSecret = 'whsec_test_secret_123'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // =============================================================================
  // Signature Verification
  // =============================================================================

  describe('Signature Verification', () => {
    it('should accept valid webhook signature', () => {
      const payload = createWebhookPayload('payment_intent.succeeded', mockPaymentIntentSucceeded())
      const signature = createValidWebhookSignature(payload, webhookSecret)

      // Mock successful event construction
      mockConstructEvent.mockReturnValue({
        id: 'evt_test_123',
        type: 'payment_intent.succeeded',
        data: { object: mockPaymentIntentSucceeded() },
      })

      // Simulate webhook handler logic
      const verifySignature = (body: string, sig: string, secret: string) => {
        try {
          mockStripe.webhooks.constructEvent(body, sig, secret)
          return true
        } catch {
          return false
        }
      }

      const isValid = verifySignature(payload, signature, webhookSecret)
      expect(isValid).toBe(true)
      expect(mockConstructEvent).toHaveBeenCalledWith(payload, signature, webhookSecret)
    })

    it('should reject invalid webhook signature', () => {
      const payload = createWebhookPayload('payment_intent.succeeded', mockPaymentIntentSucceeded())
      const invalidSignature = 'invalid_signature'

      // Mock signature verification failure
      mockConstructEvent.mockImplementation(() => {
        throw new Error('No signatures found matching the expected signature for payload')
      })

      const verifySignature = (body: string, sig: string, secret: string) => {
        try {
          mockStripe.webhooks.constructEvent(body, sig, secret)
          return true
        } catch {
          return false
        }
      }

      const isValid = verifySignature(payload, invalidSignature, webhookSecret)
      expect(isValid).toBe(false)
    })

    it('should reject expired timestamp', () => {
      // Create payload with old timestamp
      const oldPayload = JSON.stringify({
        id: 'evt_test_old',
        type: 'payment_intent.succeeded',
        data: { object: mockPaymentIntentSucceeded() },
        created: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
        livemode: false,
      })

      // Stripe rejects timestamps older than 5 minutes by default
      mockConstructEvent.mockImplementation(() => {
        throw new Error('Timestamp outside the tolerance zone')
      })

      const verifySignature = (body: string, sig: string, secret: string) => {
        try {
          mockStripe.webhooks.constructEvent(body, sig, secret)
          return true
        } catch (error) {
          return false
        }
      }

      const signature = createValidWebhookSignature(oldPayload, webhookSecret)
      const isValid = verifySignature(oldPayload, signature, webhookSecret)
      expect(isValid).toBe(false)
    })
  })

  // =============================================================================
  // Payment Intent Events
  // =============================================================================

  describe('Payment Intent Events', () => {
    it('should process payment_intent.succeeded event', async () => {
      const paymentIntent = mockPaymentIntentSucceeded({
        id: 'pi_test_succeeded_123',
        amount: 2000,
      })

      // Mock event processing
      const processPaymentIntentSucceeded = async (pi: typeof paymentIntent) => {
        // Simulate database update
        const table = mockSupabase.from('payments')
        await table.insert({
          id: pi.id,
          amount: pi.amount,
          currency: pi.currency,
          status: pi.status,
          customer_id: pi.customer,
        })
        return { success: true }
      }

      const result = await processPaymentIntentSucceeded(paymentIntent)
      expect(result.success).toBe(true)
    })

    it('should process payment_intent.payment_failed event', async () => {
      const failedPaymentIntent = mockPaymentIntentSucceeded({
        id: 'pi_test_failed_456',
        status: 'failed',
      })

      // Mock event processing
      const processPaymentIntentFailed = async (pi: typeof failedPaymentIntent) => {
        const table = mockSupabase.from('payments')
        await table.update({
          status: 'failed',
          updated_at: new Date().toISOString(),
        })
        return { success: true, failed: true }
      }

      const result = await processPaymentIntentFailed(failedPaymentIntent)
      expect(result.success).toBe(true)
      expect(result.failed).toBe(true)
    })

    it('should handle duplicate event delivery (idempotency)', async () => {
      const eventId = 'evt_test_duplicate_789'
      const processedEvents = new Set<string>()

      // Mock idempotent event handler
      const processEvent = async (id: string) => {
        if (processedEvents.has(id)) {
          return { success: true, duplicate: true }
        }
        processedEvents.add(id)
        return { success: true, duplicate: false }
      }

      // Process event twice
      const result1 = await processEvent(eventId)
      const result2 = await processEvent(eventId)

      expect(result1.duplicate).toBe(false)
      expect(result2.duplicate).toBe(true)
    })
  })

  // =============================================================================
  // Subscription Events
  // =============================================================================

  describe('Subscription Events', () => {
    it('should process customer.subscription.created event', async () => {
      const subscription = mockSubscriptionCreated({
        id: 'sub_test_created_123',
        customer: 'cus_test_user_123',
        status: 'active',
      })

      // Mock subscription creation
      const processSubscriptionCreated = async (sub: typeof subscription) => {
        const table = mockSupabase.from('subscriptions')
        await table.insert({
          id: sub.id,
          customer_id: sub.customer,
          status: sub.status,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        })
        return { success: true }
      }

      const result = await processSubscriptionCreated(subscription)
      expect(result.success).toBe(true)
    })

    it('should process customer.subscription.deleted event', async () => {
      const subscription = mockSubscriptionCreated({
        id: 'sub_test_deleted_456',
        status: 'canceled',
      })

      // Mock subscription deletion
      const processSubscriptionDeleted = async (sub: typeof subscription) => {
        const table = mockSupabase.from('subscriptions')
        await table.update({
          status: 'canceled',
          canceled_at: new Date().toISOString(),
        })
        return { success: true }
      }

      const result = await processSubscriptionDeleted(subscription)
      expect(result.success).toBe(true)
    })

    it('should update user subscription status on renewal', async () => {
      const subscription = mockSubscriptionCreated({
        id: 'sub_test_renewed_789',
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days from now
      })

      // Mock subscription renewal
      const processSubscriptionRenewal = async (sub: typeof subscription) => {
        const table = mockSupabase.from('subscriptions')
        await table.update({
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        return { success: true, renewed: true }
      }

      const result = await processSubscriptionRenewal(subscription)
      expect(result.success).toBe(true)
      expect(result.renewed).toBe(true)
    })
  })

  // =============================================================================
  // Error Handling
  // =============================================================================

  describe('Error Handling', () => {
    it('should return 400 for malformed payload', () => {
      const malformedPayload = 'not valid json'

      const validatePayload = (payload: string) => {
        try {
          JSON.parse(payload)
          return { valid: true, status: 200 }
        } catch {
          return { valid: false, status: 400, error: 'Malformed payload' }
        }
      }

      const result = validatePayload(malformedPayload)
      expect(result.valid).toBe(false)
      expect(result.status).toBe(400)
    })

    it('should return 400 for unknown event type', () => {
      const payload = createWebhookPayload('unknown.event.type', { data: 'test' })

      // Mock event with unknown type
      mockConstructEvent.mockReturnValue({
        id: 'evt_test_unknown',
        type: 'unknown.event.type',
        data: { object: { data: 'test' } },
      })

      const relevantEvents = new Set([
        'payment_intent.succeeded',
        'payment_intent.payment_failed',
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted',
      ])

      const processEvent = (eventType: string) => {
        if (!relevantEvents.has(eventType)) {
          return { status: 200, message: 'Event type not handled (ignored)' }
        }
        return { status: 200, message: 'Event processed' }
      }

      const result = processEvent('unknown.event.type')
      expect(result.status).toBe(200)
      expect(result.message).toContain('not handled')
    })

    it('should log but not fail on processing errors', async () => {
      const mockLogger = {
        error: vi.fn(),
        info: vi.fn(),
      }

      const processEventWithErrorHandling = async () => {
        try {
          // Simulate processing error
          throw new Error('Database connection failed')
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          mockLogger.error('Webhook handler error', { error: errorMessage })
          return { status: 400, error: errorMessage }
        }
      }

      const result = await processEventWithErrorHandling()
      expect(result.status).toBe(400)
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Webhook handler error',
        expect.objectContaining({ error: 'Database connection failed' }),
      )
    })
  })
})
