import { describe, expect, it } from 'vitest';

const servicesModule = await import('@revealui/services').catch(() => null);
const describeIfServices = servicesModule ? describe : describe.skip;

describeIfServices('Services Integration in admin Context', () => {
  // `describe.skip` still runs this callback to collect the (skipped) tests, so
  // this destructure executes even when @revealui/services is absent (it's an
  // optional peer dep — unlinked in OSS/CI). Fall back to an empty object so we
  // skip cleanly instead of throwing on a null destructure; the `it` bodies
  // below only run when servicesModule is non-null (suite not skipped).
  const { createPaymentIntent, protectedStripe } =
    servicesModule ?? ({} as NonNullable<typeof servicesModule>);

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
