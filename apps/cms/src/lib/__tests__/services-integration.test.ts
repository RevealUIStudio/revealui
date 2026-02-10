import { createPaymentIntent, createServerClient, protectedStripe } from '@revealui/services'
import { describe, expect, it } from 'vitest'

describe('Services Integration in CMS Context', () => {
  it('should import protectedStripe from services', () => {
    expect(protectedStripe).toBeDefined()
    expect(typeof protectedStripe).toBe('object')
    expect(protectedStripe.customers).toBeDefined()
  })

  it('should import createServerClient from services/server', () => {
    expect(createServerClient).toBeDefined()
    expect(typeof createServerClient).toBe('function')
  })

  it('should import createPaymentIntent from services/server', () => {
    expect(createPaymentIntent).toBeDefined()
    expect(typeof createPaymentIntent).toBe('function')
  })

  it('should have consistent exports between import paths', async () => {
    // Use dynamic imports for ESM compatibility
    const main = await import('@revealui/services')

    expect(main.protectedStripe).toBeDefined()
    expect(main.createServerClient).toBeDefined()
    expect(main.createPaymentIntent).toBeDefined()
  })

  it('should have correct types for all exports', () => {
    // Type checking happens at compile time, but we can verify structure
    expect(typeof protectedStripe.customers.create).toBe('function')
    expect(typeof protectedStripe.prices.list).toBe('function')
    expect(typeof protectedStripe.paymentIntents.create).toBe('function')
  })
})
