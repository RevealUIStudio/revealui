/**
 * Integration test for the money-boundary mode guard wired into getStripe().
 * Verifies the client factory refuses to construct a Stripe client when the
 * resolved secret key contradicts STRIPE_LIVE_MODE — the exact split state that
 * previously booted clean on Vercel and detonated as a cryptic
 * StripeInvalidRequestError at checkout.
 *
 * @revealui/config is mocked empty so the key resolves from process.env, and
 * the Stripe SDK is mocked so a coherent key never touches the network.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/config', () => ({ default: {} }));
vi.mock('stripe', () => {
  // Constructable default (a bare vi.fn returns a fresh object under `new`)
  // carrying the static API_VERSION that getStripe reads.
  const StripeMock = Object.assign(vi.fn(), { API_VERSION: '2026-04-22' });
  return { default: StripeMock };
});

const ORIGINAL_ENV = { ...process.env };

describe('getStripe money-boundary mode guard', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('throws on a live key with STRIPE_LIVE_MODE unset', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_live_realmoney';
    process.env.STRIPE_LIVE_MODE = undefined;
    const { getStripe } = await import('../src/stripe/stripeClient.js');
    expect(() => getStripe()).toThrow(/MODE MISMATCH/);
  });

  it('throws on a test key with STRIPE_LIVE_MODE=true', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc';
    process.env.STRIPE_LIVE_MODE = 'true';
    const { getStripe } = await import('../src/stripe/stripeClient.js');
    expect(() => getStripe()).toThrow(/MODE MISMATCH/);
  });

  it('constructs the client when key + mode agree (test mode)', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc';
    process.env.STRIPE_LIVE_MODE = undefined;
    const { getStripe } = await import('../src/stripe/stripeClient.js');
    expect(() => getStripe()).not.toThrow();
  });
});
