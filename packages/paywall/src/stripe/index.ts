/**
 * @revealui/paywall/stripe
 *
 * Extracted billing helpers (GAP-177). Hosts inject Drizzle + a circuit-broken
 * Stripe client. This OSS package does **not** re-export `protectedStripe` /
 * `getStripe` from `@revealui/services` (Pro). Import those from
 * `@revealui/services/stripe`.
 *
 * @packageDocumentation
 */

export {
  ensureStripeCustomer,
  getHostedSubscriptionSnapshot,
  resolveCatalogPriceId,
  resolveHostedStripeCustomerId,
} from './db.js';
export {
  buildCheckoutMetadata,
  getEarlyAdopterConfig,
  getEarlyAdopterDiscount,
  getMeterEventTimestamp,
  resolveUsageQuota,
} from './pure.js';
export {
  createSubscriptionWithIncompleteIntent,
  issueRefund,
  reportAgentOverage,
} from './stripe-calls.js';
export {
  type BillingCatalogKind,
  type CheckoutMetadata,
  type EarlyAdopterConfig,
  type IncompleteSubscriptionIntent,
  type LicenseTier,
  type OverageRow,
  type PaidTier,
  PaywallBillingError,
  type PgPoolLike,
  type ProtectedStripe,
  type RefundResult,
  type RequestEntitlements,
  type StripeRefundReason,
  type SubscriptionSnapshot,
} from './types.js';
