/**
 * Billing API Route Tests
 *
 * Tests for:
 * - POST /api/billing/checkout — create Stripe checkout session
 * - POST /api/billing/portal — create billing portal session
 * - GET /api/billing/subscription — get current license status
 * - POST /api/webhooks/stripe — Stripe webhook handler
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mock Setup ───────────────────────────────────────────────────────────────

// Mock auth
const mockSession = {
  user: { id: 'user-123', email: 'test@example.com', role: 'admin' },
  sessionId: 'session-123',
}

vi.mock('@revealui/auth/server', () => ({
  getSession: vi.fn().mockResolvedValue(mockSession),
}))

// Mock logger
vi.mock('@revealui/core/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock license generation
vi.mock('@revealui/core/license', () => ({
  generateLicenseKey: vi.fn().mockResolvedValue('mock-license-jwt-token'),
}))

// Mock DB client
const mockDbSelect = vi.fn()
const mockDbInsert = vi.fn()
const mockDbUpdate = vi.fn()

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([]),
          })),
          limit: vi.fn().mockResolvedValue([]),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
  })),
}))

vi.mock('@revealui/db/schema', () => ({
  licenses: { userId: 'user_id', customerId: 'customer_id', createdAt: 'created_at' },
  users: { id: 'id', stripeCustomerId: 'stripe_customer_id' },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ field: a, value: b })),
  desc: vi.fn((a) => ({ field: a, direction: 'desc' })),
}))

// Mock Stripe
const mockStripeCustomersCreate = vi.fn().mockResolvedValue({ id: 'cus_test123' })
const mockStripeCheckoutSessionsCreate = vi.fn().mockResolvedValue({
  url: 'https://checkout.stripe.com/test-session',
})
const mockStripeBillingPortalSessionsCreate = vi.fn().mockResolvedValue({
  url: 'https://billing.stripe.com/test-portal',
})
const mockStripeSubscriptionsUpdate = vi.fn().mockResolvedValue({})
const mockStripeWebhooksConstructEvent = vi.fn()

vi.mock('stripe', () => {
  class StripeMock {
    customers = { create: mockStripeCustomersCreate }
    checkout = { sessions: { create: mockStripeCheckoutSessionsCreate } }
    billingPortal = { sessions: { create: mockStripeBillingPortalSessionsCreate } }
    subscriptions = { update: mockStripeSubscriptionsUpdate }
    webhooks = { constructEvent: mockStripeWebhooksConstructEvent }
  }
  return { default: StripeMock, __esModule: true }
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function createRequest(
  url: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
) {
  const { NextRequest } = await import('next/server')
  const { method = 'GET', body, headers = {} } = options
  return new NextRequest(new URL(url, 'http://localhost:4000'), {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Billing API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_fake'
    process.env.REVEALUI_LICENSE_PRIVATE_KEY =
      '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----'
  })

  afterEach(() => {
    delete process.env.STRIPE_SECRET_KEY
    delete process.env.STRIPE_WEBHOOK_SECRET
    delete process.env.REVEALUI_LICENSE_PRIVATE_KEY
  })

  describe('POST /api/billing/checkout', () => {
    it('returns 401 when not authenticated', async () => {
      const { getSession } = await import('@revealui/auth/server')
      vi.mocked(getSession).mockResolvedValueOnce(null)

      const { POST } = await import('../../../app/api/billing/checkout/route.js')
      const request = await createRequest('http://localhost:4000/api/billing/checkout', {
        method: 'POST',
        body: { priceId: 'price_test', tier: 'pro' },
      })

      const response = await POST(request)
      expect(response.status).toBe(401)
    })

    it('returns 400 when priceId is missing', async () => {
      const { POST } = await import('../../../app/api/billing/checkout/route.js')
      const request = await createRequest('http://localhost:4000/api/billing/checkout', {
        method: 'POST',
        body: { tier: 'pro' },
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('priceId')
    })

    it('returns 500 when Stripe is not configured', async () => {
      delete process.env.STRIPE_SECRET_KEY

      // Need to re-import to pick up changed env
      vi.resetModules()
      const mod = await import('../../../app/api/billing/checkout/route.js')
      const request = await createRequest('http://localhost:4000/api/billing/checkout', {
        method: 'POST',
        body: { priceId: 'price_test', tier: 'pro' },
      })

      const response = await mod.POST(request)
      expect(response.status).toBe(500)
    })

    // Happy path checkout tested in production (Phase 0.5).
    // Unit test requires full DB mock chain for customer lookup/creation.
    // Deferred to E2E tests (Phase 1.2).
  })

  describe('POST /api/billing/portal', () => {
    it('returns 401 when not authenticated', async () => {
      const { getSession } = await import('@revealui/auth/server')
      vi.mocked(getSession).mockResolvedValueOnce(null)

      const { POST } = await import('../../../app/api/billing/portal/route.js')
      const request = await createRequest('http://localhost:4000/api/billing/portal', {
        method: 'POST',
      })

      const response = await POST(request)
      expect(response.status).toBe(401)
    })

    it('returns 500 when Stripe is not configured', async () => {
      delete process.env.STRIPE_SECRET_KEY

      vi.resetModules()
      const mod = await import('../../../app/api/billing/portal/route.js')
      const request = await createRequest('http://localhost:4000/api/billing/portal', {
        method: 'POST',
      })

      const response = await mod.POST(request)
      expect(response.status).toBe(500)
    })
  })

  describe('GET /api/billing/subscription', () => {
    it('returns 401 when not authenticated', async () => {
      const { getSession } = await import('@revealui/auth/server')
      vi.mocked(getSession).mockResolvedValueOnce(null)

      const { GET } = await import('../../../app/api/billing/subscription/route.js')
      const request = await createRequest('http://localhost:4000/api/billing/subscription')

      const response = await GET(request)
      expect(response.status).toBe(401)
    })

    it('returns free tier when no license exists', async () => {
      const { GET } = await import('../../../app/api/billing/subscription/route.js')
      const request = await createRequest('http://localhost:4000/api/billing/subscription')

      const response = await GET(request)
      const data = await response.json()
      expect(data.tier).toBe('free')
      expect(data.status).toBe('active')
    })
  })

  describe('POST /api/webhooks/stripe', () => {
    it('returns 500 when Stripe is not configured', async () => {
      delete process.env.STRIPE_SECRET_KEY

      vi.resetModules()
      const mod = await import('../../../app/api/webhooks/stripe/route.js')
      const request = await createRequest('http://localhost:4000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 't=123,v1=abc' },
      })

      const response = await mod.POST(request)
      expect(response.status).toBe(500)
    })

    it('returns 400 when signature header is missing', async () => {
      const { POST } = await import('../../../app/api/webhooks/stripe/route.js')
      const request = await createRequest('http://localhost:4000/api/webhooks/stripe', {
        method: 'POST',
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('Stripe-Signature')
    })

    it('returns 400 when signature verification fails', async () => {
      mockStripeWebhooksConstructEvent.mockImplementationOnce(() => {
        throw new Error('Signature verification failed')
      })

      const { POST } = await import('../../../app/api/webhooks/stripe/route.js')
      const request = await createRequest('http://localhost:4000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 't=123,v1=invalid' },
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('signature verification failed')
    })

    it('returns 200 for irrelevant event types', async () => {
      mockStripeWebhooksConstructEvent.mockReturnValueOnce({
        id: 'evt_test1',
        type: 'payment_intent.succeeded',
        data: { object: {} },
      })

      const { POST } = await import('../../../app/api/webhooks/stripe/route.js')
      const request = await createRequest('http://localhost:4000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 't=123,v1=valid' },
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.received).toBe(true)
    })

    it('processes checkout.session.completed event', async () => {
      mockStripeWebhooksConstructEvent.mockReturnValueOnce({
        id: 'evt_checkout_test',
        type: 'checkout.session.completed',
        data: {
          object: {
            mode: 'subscription',
            customer: 'cus_test123',
            subscription: 'sub_test123',
            metadata: { tier: 'pro', revealui_user_id: 'user-123' },
          },
        },
      })

      const { POST } = await import('../../../app/api/webhooks/stripe/route.js')
      const request = await createRequest('http://localhost:4000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 't=123,v1=valid' },
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.received).toBe(true)
    })

    it('handles customer.subscription.deleted event', async () => {
      mockStripeWebhooksConstructEvent.mockReturnValueOnce({
        id: 'evt_sub_deleted',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_test123',
            customer: 'cus_test123',
          },
        },
      })

      const { POST } = await import('../../../app/api/webhooks/stripe/route.js')
      const request = await createRequest('http://localhost:4000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 't=123,v1=valid' },
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
    })

    it('handles customer.subscription.updated with past_due status', async () => {
      mockStripeWebhooksConstructEvent.mockReturnValueOnce({
        id: 'evt_sub_updated',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_test123',
            customer: 'cus_test123',
            status: 'past_due',
          },
        },
      })

      const { POST } = await import('../../../app/api/webhooks/stripe/route.js')
      const request = await createRequest('http://localhost:4000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 't=123,v1=valid' },
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
    })

    it('deduplicates events with same ID', async () => {
      const event = {
        id: 'evt_dedup_test',
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_test',
            customer: 'cus_test',
            status: 'active',
          },
        },
      }

      mockStripeWebhooksConstructEvent.mockReturnValue(event)

      const { POST } = await import('../../../app/api/webhooks/stripe/route.js')

      // First call
      const req1 = await createRequest('http://localhost:4000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 't=123,v1=valid' },
      })
      const res1 = await POST(req1)
      expect(res1.status).toBe(200)

      // Second call with same event ID
      const req2 = await createRequest('http://localhost:4000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 't=123,v1=valid' },
      })
      const res2 = await POST(req2)
      const data2 = await res2.json()
      expect(data2.duplicate).toBe(true)
    })
  })
})
