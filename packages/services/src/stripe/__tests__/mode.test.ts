import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getConfiguredStripeMode } from '../mode.js';

describe('getConfiguredStripeMode', () => {
  const original = {
    key: process.env.STRIPE_SECRET_KEY,
    liveMode: process.env.STRIPE_LIVE_MODE,
  };

  beforeEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_LIVE_MODE;
  });

  afterEach(() => {
    if (original.key === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = original.key;
    if (original.liveMode === undefined) delete process.env.STRIPE_LIVE_MODE;
    else process.env.STRIPE_LIVE_MODE = original.liveMode;
  });

  it('derives "live" from a live secret key, regardless of STRIPE_LIVE_MODE', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_live_abc123';
    expect(getConfiguredStripeMode()).toBe('live');
  });

  it('derives "test" from a test secret key', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc123';
    expect(getConfiguredStripeMode()).toBe('test');
  });

  it('classifies restricted keys (rk_live_) as live', () => {
    process.env.STRIPE_SECRET_KEY = 'rk_live_abc123';
    expect(getConfiguredStripeMode()).toBe('live');
  });

  it('falls back to STRIPE_LIVE_MODE=true when the key is unclassifiable', () => {
    process.env.STRIPE_SECRET_KEY = 'placeholder';
    process.env.STRIPE_LIVE_MODE = 'true';
    expect(getConfiguredStripeMode()).toBe('live');
  });

  it('falls back to "test" for an unclassifiable key when STRIPE_LIVE_MODE is unset', () => {
    process.env.STRIPE_SECRET_KEY = 'placeholder';
    expect(getConfiguredStripeMode()).toBe('test');
  });

  it('defaults to "test" when no key is present and STRIPE_LIVE_MODE is unset', () => {
    expect(getConfiguredStripeMode()).toBe('test');
  });

  it('honors STRIPE_LIVE_MODE=true when no key is present', () => {
    process.env.STRIPE_LIVE_MODE = 'true';
    expect(getConfiguredStripeMode()).toBe('live');
  });
});
