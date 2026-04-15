/**
 * Payments primitive — Stripe integration, subscriptions, usage metering, and licenses.
 *
 * Re-exports from @revealui/services, @revealui/db, and @revealui/core.
 */

// ── Services: Stripe ────────────────────────────────────────────────────────
export {
  checkServicesLicense,
  getStripe,
  protectedStripe,
  createPaymentIntent,
} from '@revealui/services';

// ── Services: Supabase ──────────────────────────────────────────────────────
export {
  createServerClient,
  createBrowserClient,
  createServerClientFromRequest,
} from '@revealui/services';

// ── Services: RevealCoin payments ───────────────────────────────────────────
export {
  getRvuiBalance,
  verifyRvuiPayment,
  configureRevealCoin,
  getRevealCoinConfig,
  configurePriceOracle,
  fetchRvuiPrice,
  startPriceOracle,
  stopPriceOracle,
  rvuiToUsd,
  usdToRvui,
  configureSafeguards,
  validatePayment,
} from '@revealui/services';

// ── DB: billing tables ──────────────────────────────────────────────────────
export {
  accounts,
  accountMemberships,
  accountSubscriptions,
  accountEntitlements,
  usageMeters,
  licenses,
} from '@revealui/db';

// ── Core: license & feature gates ───────────────────────────────────────────
export {
  isLicensed,
  isFeatureEnabled,
  getCurrentTier,
  getRequiredTier,
  getFeatures,
  getFeaturesForTier,
  initializeLicense,
  validateLicenseKey,
  generateLicenseKey,
  getMaxSites,
  getMaxUsers,
  type LicensePayload,
  type LicenseTier,
} from '@revealui/core';
