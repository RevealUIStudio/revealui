/**
 * Client-side Stripe test/live gate for the admin test-mode banner.
 *
 * `NEXT_PUBLIC_IS_LIVE` is the public Stripe live-mode flag (vault path
 * `revealui/prod/public/is-live`). The exact string `true` means this deploy
 * is live; `false` means test mode. Any other value, including empty, is
 * unset and the publishable-key prefix decides.
 *
 * A `pk_test_` key always reports test mode, even when the flag says live, so
 * a mis-set flag cannot hide test-mode checkout. A missing publishable key
 * also reports test mode.
 */

export const STRIPE_TEST_PUBLISHABLE_PREFIX = 'pk_test_';
export const NEXT_PUBLIC_IS_LIVE_ON = 'true';
export const NEXT_PUBLIC_IS_LIVE_OFF = 'false';

export type NextPublicIsLive = 'live' | 'test' | 'unset';

export interface StripeClientModeEnv {
  NEXT_PUBLIC_IS_LIVE?: string | undefined;
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?: string | undefined;
}

export function readNextPublicIsLive(raw: string | undefined): NextPublicIsLive {
  const value = (raw ?? '').trim();
  if (value === NEXT_PUBLIC_IS_LIVE_ON) return 'live';
  if (value === NEXT_PUBLIC_IS_LIVE_OFF) return 'test';
  return 'unset';
}

export function isStripeTestMode(env: StripeClientModeEnv): boolean {
  const publishableKey = (env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '').trim();
  if (publishableKey.startsWith(STRIPE_TEST_PUBLISHABLE_PREFIX)) return true;

  const flag = readNextPublicIsLive(env.NEXT_PUBLIC_IS_LIVE);
  if (flag === 'test') return true;
  return publishableKey.length === 0;
}
