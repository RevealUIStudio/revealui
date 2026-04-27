import { describe, expect, it } from 'vitest';

const servicesModule = await import('@revealui/services').catch(() => null);
const describeIfServices = servicesModule ? describe : describe.skip;

describeIfServices('Services Integration in admin Context', () => {
  const { createPaymentIntent, protectedStripe } = servicesModule!;

  it('should import protectedStripe from services', () => {
    expect(protectedStripe).toBeDefined();
    expect(typeof protectedStripe).toBe('object');
    expect(protectedStripe.customers).toBeDefined();
  });

  it('should import createPaymentIntent from services', () => {
    expect(createPaymentIntent).toBeDefined();
    expect(typeof createPaymentIntent).toBe('function');
  });

  it('should have consistent exports', () => {
    expect(servicesModule?.protectedStripe).toBeDefined();
    expect(servicesModule?.createPaymentIntent).toBeDefined();
  });

  it('should have correct types for all exports', () => {
    expect(typeof protectedStripe.customers.create).toBe('function');
    expect(typeof protectedStripe.prices.list).toBe('function');
    expect(typeof protectedStripe.paymentIntents.create).toBe('function');
  });
});
