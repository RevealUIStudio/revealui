'use client';

/**
 * TestModeBanner
 *
 * Shows a warning above billing CTAs when this environment's Stripe publishable
 * key is test mode (`pk_test_*`) or missing. Studio production runs live mode;
 * this banner is for local, preview, and any deploy still on test keys so users
 * do not assume cards will be charged.
 *
 * Detection: client-side `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` prefix.
 * Server-side enforcement of the test/live invariant lives in
 * `apps/server/src/lib/validate-startup.ts` (matched against
 * `STRIPE_LIVE_MODE`).
 */
export function TestModeBanner({ className = '' }: { className?: string }) {
  const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
  const isTestMode = pk === '' || pk.startsWith('pk_test_');
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
        surface is on test keys (local, preview, or a non-live deploy). Trial flows, checkout
        sessions, and webhooks run end-to-end against the Stripe test environment.
      </p>
    </div>
  );
}
