import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock Stripe before imports
vi.mock('stripe', () => {
  return {
    default: class MockStripe {
      products = {
        list: vi.fn(),
      }
    },
  }
})

// Mock circuit breaker to pass through
vi.mock('@revealui/core/error-handling', () => ({
  CircuitBreaker: class {
    async execute<T>(fn: () => Promise<T>): Promise<T> {
      return fn()
    }
  },
  CircuitBreakerOpenError: class extends Error {},
}))

// Mock logger
vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import app from '../pricing.js'

describe('GET /api/pricing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('returns pricing response with fallback when Stripe is not configured', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', '')
    const res = await app.request('/')
    expect(res.status).toBe(200)
    const data = await res.json()

    expect(data.subscriptions).toHaveLength(4)
    expect(data.credits).toHaveLength(3)
    expect(data.perpetual).toHaveLength(3)

    // Fallback prices should be populated
    const pro = data.subscriptions.find((t: { id: string }) => t.id === 'pro')
    expect(pro.price).toBe('$49')
    expect(pro.period).toBe('/month')
  })

  it('returns structural data from contracts', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', '')
    const res = await app.request('/')
    const data = await res.json()

    const free = data.subscriptions.find((t: { id: string }) => t.id === 'free')
    expect(free.name).toBe('Free (OSS)')
    expect(free.features.length).toBeGreaterThan(0)
    expect(free.cta).toBe('Get Started')
  })

  it('sets cache headers', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', '')
    const res = await app.request('/')
    expect(res.headers.get('Cache-Control')).toBe(
      'public, s-maxage=3600, stale-while-revalidate=86400',
    )
  })

  it('returns all credit bundles with fallback prices', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', '')
    const res = await app.request('/')
    const data = await res.json()

    const standard = data.credits.find((b: { name: string }) => b.name === 'Standard')
    expect(standard.price).toBe('$50')
    expect(standard.costPer).toBe('$0.00083/task')
    expect(standard.tasks).toBe('60,000')
  })

  it('returns all perpetual tiers with fallback prices', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', '')
    const res = await app.request('/')
    const data = await res.json()

    const proPerpetual = data.perpetual.find((t: { name: string }) => t.name === 'Pro Perpetual')
    expect(proPerpetual.price).toBe('$299')
    expect(proPerpetual.renewal).toBe('$99/yr for continued support')
  })

  it('response matches expected shape', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', '')
    const res = await app.request('/')
    const data = await res.json()

    // Verify shape
    expect(data).toHaveProperty('subscriptions')
    expect(data).toHaveProperty('credits')
    expect(data).toHaveProperty('perpetual')

    // Verify subscription tier shape
    for (const tier of data.subscriptions) {
      expect(tier).toHaveProperty('id')
      expect(tier).toHaveProperty('name')
      expect(tier).toHaveProperty('description')
      expect(tier).toHaveProperty('features')
      expect(tier).toHaveProperty('cta')
      expect(tier).toHaveProperty('ctaHref')
      expect(tier).toHaveProperty('highlighted')
    }
  })
})
