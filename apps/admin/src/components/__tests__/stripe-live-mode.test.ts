import { describe, expect, it } from 'vitest';
import { isStripeTestMode, readNextPublicIsLive } from '../stripe-live-mode';

describe('readNextPublicIsLive', () => {
  it('treats an exact true as live', () => {
    expect(readNextPublicIsLive('true')).toBe('live');
    expect(readNextPublicIsLive('  true  ')).toBe('live');
  });

  it('treats an exact false as test', () => {
    expect(readNextPublicIsLive('false')).toBe('test');
    expect(readNextPublicIsLive(' false ')).toBe('test');
  });

  it('treats empty and unrecognized values as unset', () => {
    expect(readNextPublicIsLive(undefined)).toBe('unset');
    expect(readNextPublicIsLive('')).toBe('unset');
    expect(readNextPublicIsLive('yes')).toBe('unset');
    expect(readNextPublicIsLive('TRUE')).toBe('unset');
  });
});

describe('isStripeTestMode', () => {
  it('warns when the flag is unset and the publishable key is missing', () => {
    expect(isStripeTestMode({})).toBe(true);
  });

  it('warns when the flag is unset and the key is a test key', () => {
    expect(isStripeTestMode({ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_example' })).toBe(true);
  });

  it('stays quiet when the flag is unset and the key is live', () => {
    expect(isStripeTestMode({ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_example' })).toBe(false);
  });

  it('reads NEXT_PUBLIC_IS_LIVE=false as test mode even with a live key', () => {
    expect(
      isStripeTestMode({
        NEXT_PUBLIC_IS_LIVE: 'false',
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_example',
      }),
    ).toBe(true);
  });

  it('reads NEXT_PUBLIC_IS_LIVE=true as live when the key is live', () => {
    expect(
      isStripeTestMode({
        NEXT_PUBLIC_IS_LIVE: 'true',
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_example',
      }),
    ).toBe(false);
  });

  it('keeps the banner when a test key disagrees with a live flag', () => {
    expect(
      isStripeTestMode({
        NEXT_PUBLIC_IS_LIVE: 'true',
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_example',
      }),
    ).toBe(true);
  });

  it('keeps the banner when the live flag is set but the publishable key is missing', () => {
    expect(isStripeTestMode({ NEXT_PUBLIC_IS_LIVE: 'true' })).toBe(true);
  });
});
