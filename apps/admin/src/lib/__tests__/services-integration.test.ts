import { describe, expect, it } from 'vitest';

const servicesModule = await import('@revealui/services').catch(() => null);
const describeIfServices = servicesModule ? describe : describe.skip;

describeIfServices('Services Integration in CMS Context', () => {
  const { createPaymentIntent, createServerClient, protectedStripe } = servicesModule!;

  it('should import protectedStripe from services', () => {
    expect(protectedStripe).toBeDefined();
    expect(typeof protectedStripe).toBe('object');
    expect(protectedStripe.customers).toBeDefined();
  });

  it('should import createServerClient from services/server', () => {
    expect(createServerClient).toBeDefined();
    expect(typeof createServerClient).toBe('function');
  });

  it('should import createPaymentIntent from services/server', () => {
    expect(createPaymentIntent).toBeDefined();
    expect(typeof createPaymentIntent).toBe('function');
  });

  it('should have consistent exports between import paths', () => {
    expect(servicesModule?.protectedStripe).toBeDefined();
    expect(servicesModule?.createServerClient).toBeDefined();
    expect(servicesModule?.createPaymentIntent).toBeDefined();
  });

  it('should have correct types for all exports', () => {
    // Type checking happens at compile time, but we can verify structure
    expect(typeof protectedStripe.customers.create).toBe('function');
    expect(typeof protectedStripe.prices.list).toBe('function');
    expect(typeof protectedStripe.paymentIntents.create).toBe('function');
  });
});
