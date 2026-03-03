/**
 * Stripe Webhook Handler Tests
 *
 * Covers: signature verification, idempotency, and license lifecycle events
 * (created, revoked, expired, reactivated).
 */

import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mocks — declared before imports so vi.mock hoisting takes effect ─────────

const mockConstructEvent = vi.fn()
const mockSubscriptionsUpdate = vi.fn().mockResolvedValue({})

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(
    // Must use a class — webhooks.ts calls `new Stripe(key)`
    class {
      webhooks = { constructEvent: mockConstructEvent }
      subscriptions = { update: mockSubscriptionsUpdate }
    } as unknown as (...args: unknown[]) => unknown,
  ),
}))

vi.mock('@revealui/core/features', () => ({
  isFeatureEnabled: vi.fn().mockReturnValue(false), // audit off by default
}))

vi.mock('@revealui/core/license', () => ({
  generateLicenseKey: vi.fn().mockResolvedValue('rv-license-key-test-123'),
}))

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

// ─── DB Mock — fluent chain for select / insert / update ─────────────────────

const mockDbSelectChain = {
  from: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
}
mockDbSelectChain.from.mockReturnValue(mockDbSelectChain)
mockDbSelectChain.where.mockReturnValue(mockDbSelectChain)
mockDbSelectChain.limit.mockResolvedValue([]) // default: no user found

const mockDbInsertChain = { values: vi.fn().mockResolvedValue(undefined) }
const mockDbUpdateChain = {
  set: vi.fn(),
  where: vi.fn().mockResolvedValue({ rowCount: 1 }),
}
mockDbUpdateChain.set.mockReturnValue(mockDbUpdateChain)

const mockDb = {
  select: vi.fn().mockReturnValue(mockDbSelectChain),
  insert: vi.fn().mockReturnValue(mockDbInsertChain),
  update: vi.fn().mockReturnValue(mockDbUpdateChain),
}

const mockAuditAppend = vi.fn().mockResolvedValue(undefined)

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(() => mockDb),
  DrizzleAuditStore: vi.fn().mockImplementation(() => ({ append: mockAuditAppend })),
  licenses: {},
  users: {},
}))

vi.mock('@revealui/db/schema', () => ({
  licenses: {},
  users: {},
}))

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return { ...actual }
})

// ─── Import under test (after mocks) ─────────────────────────────────────────

import webhooksApp from '../webhooks.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createApp() {
  const app = new Hono()
  app.route('/', webhooksApp)
  return app
}

function postStripe(eventJson: unknown, sig = 'valid-sig') {
  const body = JSON.stringify(eventJson)
  return new Request('http://localhost/stripe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': sig },
    body,
  })
}

function makeSubscriptionDeletedEvent(id: string) {
  return {
    id,
    type: 'customer.subscription.deleted',
    data: { object: { id: 'sub_test', customer: 'cus_test' } },
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /stripe webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Re-wire chains after clearAllMocks resets return values
    mockDbSelectChain.from.mockReturnValue(mockDbSelectChain)
    mockDbSelectChain.where.mockReturnValue(mockDbSelectChain)
    mockDbSelectChain.limit.mockResolvedValue([])
    mockDbInsertChain.values.mockResolvedValue(undefined)
    mockDbUpdateChain.set.mockReturnValue(mockDbUpdateChain)
    mockDbUpdateChain.where.mockResolvedValue({ rowCount: 1 })
    mockDb.select.mockReturnValue(mockDbSelectChain)
    mockDb.insert.mockReturnValue(mockDbInsertChain)
    mockDb.update.mockReturnValue(mockDbUpdateChain)
    mockAuditAppend.mockResolvedValue(undefined)

    process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_placeholder'
    process.env.REVEALUI_LICENSE_PRIVATE_KEY = 'fake-private-key'
  })

  describe('Request validation', () => {
    it('returns 400 when Stripe-Signature header is missing', async () => {
      const app = createApp()
      const res = await app.request(
        new Request('http://localhost/stripe', { method: 'POST', body: '{}' }),
      )
      expect(res.status).toBe(400)
      const body = (await res.json()) as Record<string, unknown>
      expect(body.error).toContain('Missing Stripe-Signature')
    })

    it('returns 400 when signature verification fails', async () => {
      mockConstructEvent.mockImplementationOnce(() => {
        throw new Error('No signatures found matching the expected signature')
      })

      const app = createApp()
      const res = await app.request(postStripe({}, 'bad-sig'))
      expect(res.status).toBe(400)
      const body = (await res.json()) as Record<string, unknown>
      expect(body.error as string).toContain('Webhook signature verification failed')
    })

    it('returns 200 for irrelevant event types', async () => {
      mockConstructEvent.mockReturnValueOnce({
        id: 'evt_irrelevant',
        type: 'payment_intent.created',
        data: { object: {} },
      })

      const app = createApp()
      const res = await app.request(postStripe({}))
      expect(res.status).toBe(200)
      const body = (await res.json()) as Record<string, unknown>
      expect(body.received).toBe(true)
      expect(body.duplicate).toBeUndefined()
    })
  })

  describe('Idempotency', () => {
    it('returns duplicate:true when the same event ID is sent twice', async () => {
      const event = makeSubscriptionDeletedEvent('evt_idempotent_test')
      mockConstructEvent.mockReturnValue(event)

      const app = createApp()

      // First request — should process normally
      const res1 = await app.request(postStripe(event))
      expect(res1.status).toBe(200)
      const body1 = (await res1.json()) as Record<string, unknown>
      expect(body1.duplicate).toBeUndefined()

      // Second request with the same event ID — should be deduplicated
      const res2 = await app.request(postStripe(event))
      expect(res2.status).toBe(200)
      const body2 = (await res2.json()) as Record<string, unknown>
      expect(body2.duplicate).toBe(true)

      // DB update should only have been called once (first request only)
      expect(mockDb.update).toHaveBeenCalledTimes(1)
    })
  })

  describe('customer.subscription.deleted', () => {
    it('revokes all licenses for the customer and returns 200', async () => {
      const event = makeSubscriptionDeletedEvent('evt_deleted_unique_1')
      mockConstructEvent.mockReturnValueOnce(event)

      const app = createApp()
      const res = await app.request(postStripe(event))
      expect(res.status).toBe(200)
      const body = (await res.json()) as Record<string, unknown>
      expect(body.received).toBe(true)

      // Verify DB update was called to revoke licenses
      expect(mockDb.update).toHaveBeenCalledOnce()
      const setCall = mockDbUpdateChain.set.mock.calls[0]?.[0] as Record<string, unknown>
      expect(setCall.status).toBe('revoked')
    })

    it('does not write audit log when auditLog feature is disabled', async () => {
      const event = makeSubscriptionDeletedEvent('evt_deleted_no_audit_1')
      mockConstructEvent.mockReturnValueOnce(event)

      const app = createApp()
      await app.request(postStripe(event))

      expect(mockAuditAppend).not.toHaveBeenCalled()
    })

    it('writes audit log when auditLog feature is enabled', async () => {
      const { isFeatureEnabled } = await import('@revealui/core/features')
      vi.mocked(isFeatureEnabled).mockReturnValue(true)

      const event = makeSubscriptionDeletedEvent('evt_deleted_audit_1')
      mockConstructEvent.mockReturnValueOnce(event)

      const app = createApp()
      await app.request(postStripe(event))

      expect(mockAuditAppend).toHaveBeenCalledOnce()
      const entry = mockAuditAppend.mock.calls[0]?.[0] as Record<string, unknown>
      expect(entry.eventType).toBe('license.revoked')
      expect(entry.severity).toBe('warn')
      expect(entry.agentId).toBe('system:stripe-webhook')
    })
  })

  describe('customer.subscription.updated', () => {
    it('marks license as expired when subscription is past_due', async () => {
      const event = {
        id: 'evt_updated_pastdue_unique_1',
        type: 'customer.subscription.updated',
        data: { object: { id: 'sub_test', customer: 'cus_test', status: 'past_due' } },
      }
      mockConstructEvent.mockReturnValueOnce(event)

      const app = createApp()
      const res = await app.request(postStripe(event))
      expect(res.status).toBe(200)

      expect(mockDb.update).toHaveBeenCalledOnce()
      const setCall = mockDbUpdateChain.set.mock.calls[0]?.[0] as Record<string, unknown>
      expect(setCall.status).toBe('expired')
    })

    it('marks license as expired when subscription is unpaid', async () => {
      const event = {
        id: 'evt_updated_unpaid_unique_1',
        type: 'customer.subscription.updated',
        data: { object: { id: 'sub_test', customer: 'cus_test', status: 'unpaid' } },
      }
      mockConstructEvent.mockReturnValueOnce(event)

      const app = createApp()
      const res = await app.request(postStripe(event))
      expect(res.status).toBe(200)

      const setCall = mockDbUpdateChain.set.mock.calls[0]?.[0] as Record<string, unknown>
      expect(setCall.status).toBe('expired')
    })

    it('reactivates license when subscription becomes active', async () => {
      const event = {
        id: 'evt_updated_active_unique_1',
        type: 'customer.subscription.updated',
        data: { object: { id: 'sub_test', customer: 'cus_test', status: 'active' } },
      }
      mockConstructEvent.mockReturnValueOnce(event)

      const app = createApp()
      const res = await app.request(postStripe(event))
      expect(res.status).toBe(200)

      expect(mockDb.update).toHaveBeenCalledOnce()
      const setCall = mockDbUpdateChain.set.mock.calls[0]?.[0] as Record<string, unknown>
      expect(setCall.status).toBe('active')
    })

    it('writes license.expired audit entry when subscription goes past_due and auditLog enabled', async () => {
      const { isFeatureEnabled } = await import('@revealui/core/features')
      vi.mocked(isFeatureEnabled).mockReturnValue(true)

      const event = {
        id: 'evt_updated_pastdue_audit_unique_1',
        type: 'customer.subscription.updated',
        data: { object: { id: 'sub_test', customer: 'cus_test', status: 'past_due' } },
      }
      mockConstructEvent.mockReturnValueOnce(event)

      const app = createApp()
      await app.request(postStripe(event))

      expect(mockAuditAppend).toHaveBeenCalledOnce()
      const entry = mockAuditAppend.mock.calls[0]?.[0] as Record<string, unknown>
      expect(entry.eventType).toBe('license.expired')
    })
  })

  describe('checkout.session.completed', () => {
    it('skips non-subscription checkout sessions', async () => {
      const event = {
        id: 'evt_checkout_payment_unique_1',
        type: 'checkout.session.completed',
        data: {
          object: { mode: 'payment', subscription: null, customer: 'cus_test', metadata: {} },
        },
      }
      mockConstructEvent.mockReturnValueOnce(event)

      const app = createApp()
      const res = await app.request(postStripe(event))
      expect(res.status).toBe(200)
      expect(mockDb.insert).not.toHaveBeenCalled()
    })

    it('logs error and skips when no user can be resolved', async () => {
      // No userId in metadata and no user found in DB
      mockDbSelectChain.limit.mockResolvedValueOnce([])

      const event = {
        id: 'evt_checkout_nouser_unique_1',
        type: 'checkout.session.completed',
        data: {
          object: {
            mode: 'subscription',
            subscription: 'sub_test',
            customer: 'cus_test',
            metadata: { tier: 'pro' }, // no revealui_user_id
          },
        },
      }
      mockConstructEvent.mockReturnValueOnce(event)

      const { logger } = await import('@revealui/core/observability/logger')
      const app = createApp()
      const res = await app.request(postStripe(event))

      expect(res.status).toBe(200)
      expect(mockDb.insert).not.toHaveBeenCalled()
      expect(vi.mocked(logger).error).toHaveBeenCalledWith(
        expect.stringContaining('Cannot resolve user'),
        expect.anything(),
        expect.anything(),
      )
    })

    it('creates license when userId is provided in metadata', async () => {
      const { generateLicenseKey } = await import('@revealui/core/license')

      const event = {
        id: 'evt_checkout_success_unique_1',
        type: 'checkout.session.completed',
        data: {
          object: {
            mode: 'subscription',
            subscription: 'sub_test',
            customer: 'cus_test',
            metadata: { tier: 'pro', revealui_user_id: 'user_abc' },
          },
        },
      }
      mockConstructEvent.mockReturnValueOnce(event)

      const app = createApp()
      const res = await app.request(postStripe(event))

      expect(res.status).toBe(200)
      expect(generateLicenseKey).toHaveBeenCalledOnce()
      expect(mockDb.insert).toHaveBeenCalledOnce()
      const insertValues = mockDbInsertChain.values.mock.calls[0]?.[0] as Record<string, unknown>
      expect(insertValues.status).toBe('active')
      expect(insertValues.tier).toBe('pro')
      expect(insertValues.userId).toBe('user_abc')
    })
  })
})
