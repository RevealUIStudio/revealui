/**
 * Import Verification Tests for services package
 *
 * These tests verify that all export paths work correctly after reorganization.
 */

import { describe, expect, it } from 'vitest';

describe('services - Import Paths', () => {
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

    // Verify createPaymentIntent (after Phase 2)
    expect(main.createPaymentIntent).toBeDefined();
    expect(typeof main.createPaymentIntent).toBe('function');
  });

  it('should import from main package export', async () => {
    const main = await import('services');
    expect(main).toBeDefined();
    expect(main.protectedStripe).toBeDefined();
  });
});
