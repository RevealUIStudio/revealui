/**
 * Payments primitive — Stripe integration, subscriptions, usage metering, and licenses.
 *
 * Re-exports from @revealui/services, @revealui/db, and @revealui/core.
 */

// ── Core: license & feature gates ───────────────────────────────────────────
export {
  generateLicenseKey,
  getCurrentTier,
  getFeatures,
  getFeaturesForTier,
  getMaxSites,
  getMaxUsers,
  getRequiredTier,
  initializeLicense,
  isFeatureEnabled,
  isLicensed,
  type LicensePayload,
  type LicenseTier,
  validateLicenseKey,
} from '@revealui/core';
// ── DB: billing tables ──────────────────────────────────────────────────────
export {
  accountEntitlements,
  accountMemberships,
  accountSubscriptions,
  accounts,
  licenses,
  usageMeters,
} from '@revealui/db';
// ── Services: Stripe payments ────────────────────────────────────────────────
export { createPaymentIntent, getStripe, protectedStripe } from '@revealui/services';
