/**
 * Boot-time required-env lists — a PURE leaf module (no imports).
 *
 * Extracted from validate-startup.ts (GAP-259 P0-5) so lightweight coverage
 * tests (scripts/sync/__tests__/prod-required-coverage.test.ts) can read these
 * lists without dragging validate-startup's heavy runtime chain
 * (@revealui/db/client, drizzle-orm, @revealui/config, @revealui/core).
 * validate-startup.ts remains the sole runtime consumer.
 */

// Required-always env vars expressed as alias groups: each group is satisfied
// when AT LEAST ONE of its names is set. This handles the Postgres connection
// string having two equally-valid names in the codebase: `POSTGRES_URL` is the
// historical Vercel-default name (used by validateStartup since the api app
// was scaffolded), while `DATABASE_URL` is the name read by drizzle-orm's
// rate-limit middleware path and several @neondatabase/serverless integrations.
// Either is acceptable as long as ONE of them is set; the runtime resolves the
// connection string from whichever is present. Treating them as aliases also
// papers over the Vercel `vercel pull` quirk where Sensitive-marked vars
// (POSTGRES_URL became sensitive on 2026-05-01) are excluded from the pulled
// `.env.production.local` even though they're available at runtime — see the
// 2026-05-01 deploy.yml validate-prod-env failure.
export const REQUIRED_ALWAYS_GROUPS: ReadonlyArray<readonly string[]> = [
  ['POSTGRES_URL', 'DATABASE_URL'],
  ['NODE_ENV'],
] as const;

export const REQUIRED_IN_PRODUCTION_HOSTED = [
  'REVEALUI_SECRET',
  'REVEALUI_KEK',
  'REVEALUI_PUBLIC_SERVER_URL',
  'NEXT_PUBLIC_SERVER_URL',
  'SENTRY_DSN',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'REVEALUI_LICENSE_PRIVATE_KEY',
  'REVEALUI_CRON_SECRET',
  'CORS_ORIGIN',
  // Alert destination for unreconciled Stripe webhooks and other ops-critical
  // signals. Without it, ops email falls back to a hard-coded default; making
  // this required forces an explicit decision per environment.
  'REVEALUI_ALERT_EMAIL',
  // Sentry DSN for error capture. The Sentry init in apps/server/src/index.ts
  // is guarded by `if (process.env.SENTRY_DSN)`, so a missing value silently
  // drops all Sentry coverage with no boot-time failure. Making this required
  // ensures we never boot a hosted production deployment without Sentry wired —
  // the checkout-route HTTPException capture and sendCronFailureAlert Sentry
  // path both depend on it. GAP-S1 / Phase 1 audit J-P0-1.
  'SENTRY_DSN',
  // Billing portal configuration ID controls which plans customers can switch
  // to and which cancellation flows are offered. Without it the portal falls
  // back to Stripe's default (all plans visible, no flow customisation).
  // Required here so we never flip live-mode without the portal wired. (#827)
  'REVEALUI_BILLING_PORTAL_CONFIG_ID',
  // Transactional email transport (Gmail API with domain-wide delegation — see
  // packages/services/src/email/index.ts → getEmailProvider). Without BOTH of
  // these, getEmailProvider() falls back to a no-op that drops every send, so
  // receipt / license-activation / refund emails (and, in the admin app, signup
  // verification) silently never arrive while the deploy boots clean with no
  // signal. Require them so a hosted deploy with broken email transport fails
  // loudly at boot instead of silently degrading. EMAIL_FROM is intentionally
  // not required — it has a safe default (noreply@revealui.com).
  'GOOGLE_SERVICE_ACCOUNT_EMAIL',
  'GOOGLE_PRIVATE_KEY',
] as const;
