// Single source of truth for classifying a Stripe API key by its environment
// (live vs test) and deciding whether a resolved key is coherent with the
// operator's STRIPE_LIVE_MODE intent.
//
// Canonical home: this module lives in @revealui/config (an always-bundled,
// MIT, zero-runtime-dep package) so the server's cold-start path and boot
// validator can import it WITHOUT pulling in the optional Pro package
// @revealui/services. @revealui/services/stripe/mode re-exports from here so
// the Pro Stripe client factory keeps its single import site.
//
// Two enforcement points consume this module:
//   1. The runtime Stripe client factory (stripeClient.getStripe) in
//      @revealui/services, the money boundary that runs on the Vercel
//      serverless API. It refuses to construct a client when the key
//      environment contradicts STRIPE_LIVE_MODE, turning a cryptic
//      mid-checkout StripeInvalidRequestError into a precise error.
//   2. The boot-time env validator (apps/server validate-startup), the
//      deploy/Fly/dev gate that fails the whole process on the same mismatch.
//
// Keeping the prefix rules here means the live/test contract can never drift
// between the sites. Pure module: zero imports, no side effects, safe to pull
// into the boot path and into the serverless cold-start path alike.

/** Environment a Stripe key targets, derived from its documented prefix. */
export type StripeKeyMode = 'live' | 'test' | 'unknown';

/**
 * Classify a Stripe SECRET key by environment. Stripe issues full secret keys
 * as `sk_live_…` / `sk_test_…` and restricted keys as `rk_live_…` / `rk_test_…`;
 * both are accepted. Anything else (empty, malformed, or a future prefix) is
 * `unknown` — callers decide whether `unknown` is tolerable in their context.
 */
export function classifyStripeSecretKey(key: string): StripeKeyMode {
  if (key.startsWith('sk_live_') || key.startsWith('rk_live_')) return 'live';
  if (key.startsWith('sk_test_') || key.startsWith('rk_test_')) return 'test';
  return 'unknown';
}

/** Classify a Stripe PUBLISHABLE key (`pk_live_…` / `pk_test_…`). */
export function classifyStripePublishableKey(key: string): StripeKeyMode {
  if (key.startsWith('pk_live_')) return 'live';
  if (key.startsWith('pk_test_')) return 'test';
  return 'unknown';
}

/**
 * Outcome of the runtime money-boundary coherence check. `ok: false` carries a
 * ready-to-throw `message` naming the exact mismatch and remedy.
 */
export interface StripeModeCoherence {
  ok: boolean;
  keyMode: StripeKeyMode;
  liveMode: boolean;
  message?: string;
}

/**
 * Decide whether a resolved secret key is coherent with STRIPE_LIVE_MODE for
 * the purpose of constructing a live Stripe client.
 *
 * - `liveMode=true` requires a live-environment key.
 * - `liveMode=false` requires a test-environment key.
 * - An `unknown` key environment is NOT treated as a mismatch here: the client
 *   factory historically accepted any non-empty key string, and we defer
 *   judgement on unclassifiable keys to Stripe rather than hard-blocking a key
 *   shape we don't recognise. The strict boot validator is the layer that
 *   rejects `unknown`.
 *
 * Returns `ok: true` for a matching environment or an unknown key; `ok: false`
 * with a `message` only on a confirmed live/test contradiction.
 */
export function checkStripeModeCoherence(key: string, liveMode: boolean): StripeModeCoherence {
  const keyMode = classifyStripeSecretKey(key);
  if (keyMode === 'unknown') {
    return { ok: true, keyMode, liveMode };
  }
  if (liveMode && keyMode === 'test') {
    return {
      ok: false,
      keyMode,
      liveMode,
      message:
        'STRIPE MODE MISMATCH: STRIPE_LIVE_MODE=true but STRIPE_SECRET_KEY is a test key ' +
        '(sk_test_/rk_test_). Refusing to construct the Stripe client in an incoherent money ' +
        'mode. Provide a live key (sk_live_…) or unset STRIPE_LIVE_MODE.',
    };
  }
  if (!liveMode && keyMode === 'live') {
    return {
      ok: false,
      keyMode,
      liveMode,
      message:
        'STRIPE MODE MISMATCH: STRIPE_SECRET_KEY is a live key (sk_live_/rk_live_) but ' +
        'STRIPE_LIVE_MODE is not "true". This exact split state surfaces downstream as a cryptic ' +
        'StripeInvalidRequestError at checkout. Either set STRIPE_LIVE_MODE=true (only after the ' +
        'billing-readiness audit) or use a test key (sk_test_…).',
    };
  }
  return { ok: true, keyMode, liveMode };
}

/**
 * Single runtime source of truth for which catalog mode (`'live'` or `'test'`)
 * the deployed Stripe key targets. Used everywhere we filter `billing_catalog`
 * rows so test-key deploys never hit live price IDs and vice versa.
 *
 * Resolution order:
 *   1. `STRIPE_SECRET_KEY` prefix — definitive when the key is present.
 *   2. `STRIPE_LIVE_MODE=true` fallback — for restricted-key shapes we can't
 *      classify or when the env var is missing.
 */
export function getConfiguredStripeMode(): 'live' | 'test' {
  const classified = classifyStripeSecretKey(process.env.STRIPE_SECRET_KEY ?? '');
  if (classified === 'live' || classified === 'test') return classified;
  return process.env.STRIPE_LIVE_MODE === 'true' ? 'live' : 'test';
}
