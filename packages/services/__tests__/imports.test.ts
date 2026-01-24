/**
 * Import Verification Tests for services package
 *
 * These tests verify that all export paths work correctly after reorganization.
 */

import { describe, expect, it } from 'vitest'

describe('services - Import Paths', () => {
  it('should import from core export', async () => {
    const core = await import('services/server')
    expect(core).toBeDefined()

    // Verify protectedStripe structure
    expect(core.protectedStripe).toBeDefined()
    expect(typeof core.protectedStripe).toBe('object')
    expect(core.protectedStripe.customers).toBeDefined()
    expect(core.protectedStripe.customers.create).toBeDefined()
    expect(typeof core.protectedStripe.customers.create).toBe('function')
    expect(core.protectedStripe.prices).toBeDefined()
    expect(core.protectedStripe.paymentIntents).toBeDefined()

    // Verify createServerClient
    expect(core.createServerClient).toBeDefined()
    expect(typeof core.createServerClient).toBe('function')

    // Verify createPaymentIntent (after Phase 2)
    expect(core.createPaymentIntent).toBeDefined()
    expect(typeof core.createPaymentIntent).toBe('function')
  })

  it('should import from client export', async () => {
    const client = await import('services/client')
    expect(client).toBeDefined()
    expect(client.createBrowserClient).toBeDefined()
    expect(typeof client.createBrowserClient).toBe('function')
  })

  it('should import from main package export', async () => {
    const main = await import('services')
    expect(main).toBeDefined()
    expect(main.protectedStripe).toBeDefined()
    expect(main.createServerClient).toBeDefined()
    expect(main.createBrowserClient).toBeDefined()
  })

  it('should have consistent exports between core and main', async () => {
    const core = await import('services/server')
    const main = await import('services')

    // Main should re-export everything from core
    expect(main.protectedStripe).toBe(core.protectedStripe)
    expect(main.createServerClient).toBe(core.createServerClient)
  })

  it('should have consistent exports between client and main', async () => {
    const client = await import('services/client')
    const main = await import('services')

    // Main should re-export everything from client
    expect(main.createBrowserClient).toBe(client.createBrowserClient)
  })
})
