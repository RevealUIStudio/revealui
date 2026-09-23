'use client';

import { isStripeTestMode } from './stripe-live-mode';

/**
 * TestModeBanner
 *
 * Shows a warning above billing CTAs when this environment is not on Stripe
 * live mode. Studio production runs live mode; this banner is for local,
 * preview, and any deploy still in test mode so users do not assume cards
 * will be charged.
 *
 * Detection: client-side `NEXT_PUBLIC_IS_LIVE` (`true` / `false`), with the
 * `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` prefix as the fallback when the flag
 * is unset. A `pk_test_` key always shows the banner. Server-side enforcement
 * of the test/live invariant lives in `apps/server/src/lib/validate-startup.ts`
 * (matched against `STRIPE_LIVE_MODE`).
 */
export function TestModeBanner({ className = '' }: { className?: string }) {
  const isTestMode = isStripeTestMode({
    NEXT_PUBLIC_IS_LIVE: process.env.NEXT_PUBLIC_IS_LIVE,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  });
  if (!isTestMode) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-100 ${className}`}
    >
      <p className="font-medium">Stripe is in test mode</p>
      <p className="mt-1 text-xs leading-relaxed">
        No card will be charged in this environment. Studio production uses Stripe live mode; this
        surface is in test mode (local, preview, or a non-live deploy). Trial flows, checkout
        sessions, and webhooks run end-to-end against the Stripe test environment.
      </p>
    </div>
  );
}
