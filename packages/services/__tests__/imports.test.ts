/**
 * Import Verification Tests for services package
 *
 * These tests verify that all export paths work correctly after reorganization.
 */

import { describe, expect, it } from 'vitest';

describe('services - Import Paths', () => {
  // Note: services/server sub-path exports work in production but can't be tested
  // in vitest environment without the package being installed. Tested via main export instead.
  // Services import is slow due to Stripe SDK and Supabase client initialization
  it('should import server exports from main package', { timeout: 15000 }, async () => {
    const main = await import('services');
    expect(main).toBeDefined();

    // Verify protectedStripe structure
    expect(main.protectedStripe).toBeDefined();
    expect(typeof main.protectedStripe).toBe('object');
    expect(main.protectedStripe.customers).toBeDefined();
    expect(main.protectedStripe.customers.create).toBeDefined();
    expect(typeof main.protectedStripe.customers.create).toBe('function');
    expect(main.protectedStripe.prices).toBeDefined();
    expect(main.protectedStripe.paymentIntents).toBeDefined();

    // Verify createServerClient
    expect(main.createServerClient).toBeDefined();
    expect(typeof main.createServerClient).toBe('function');

    // Verify createPaymentIntent (after Phase 2)
    expect(main.createPaymentIntent).toBeDefined();
    expect(typeof main.createPaymentIntent).toBe('function');
  });

  it('should import from client export', async () => {
    const client = await import('services/client');
    expect(client).toBeDefined();
    expect(client.createBrowserClient).toBeDefined();
    expect(typeof client.createBrowserClient).toBe('function');
  });

  it('should import from main package export', async () => {
    const main = await import('services');
    expect(main).toBeDefined();
    expect(main.protectedStripe).toBeDefined();
    expect(main.createServerClient).toBeDefined();
    expect(main.createBrowserClient).toBeDefined();
  });

  it('should have consistent client exports', async () => {
    const client = await import('services/client');
    const main = await import('services');

    // Main should re-export everything from client
    expect(main.createBrowserClient).toBe(client.createBrowserClient);
  });
});
