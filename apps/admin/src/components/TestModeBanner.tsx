'use client';

/**
 * TestModeBanner
 *
 * Shows a warning above billing CTAs when Stripe is running in test mode
 * (publishable key prefix `pk_test_*` OR no key configured). Live mode is
 * gated on the billing-readiness audit per the locked posture in
 * `revealui-jv` MASTER_PLAN; this banner makes the test-mode posture
 * explicit so users do not assume cards will be charged.
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
        No card will be charged. Live billing is gated on the internal billing-readiness audit; this
        surface uses Stripe test mode in production until that lands. Trial flows, checkout
        sessions, and webhooks all run end-to-end against the test environment.
      </p>
    </div>
  );
}
