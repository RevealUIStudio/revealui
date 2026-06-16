// Stripe live/test mode classification, single source of truth.
//
// The implementation moved to @revealui/config (an always-bundled, MIT,
// zero-runtime-dep package) so the server's serverless cold-start path and
// boot validator can import the same rules WITHOUT pulling in this optional
// Pro package. This file remains as the canonical @revealui/services/stripe/mode
// entry point and re-exports the relocated module, so the Pro Stripe client
// factory (stripeClient.ts) and any external consumer keep their import site.
export * from '@revealui/config/stripe-mode';
