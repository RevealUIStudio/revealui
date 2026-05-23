/**
 * Products primitive — product catalog, orders, and pricing tiers.
 *
 * Re-exports from @revealui/db and @revealui/contracts.
 */

// ── Contracts: pricing tiers & limits ───────────────────────────────────────
export {
  CREDIT_BUNDLES,
  type CreditBundle,
  getTierColor,
  getTierLabel,
  getTiersFromCurrent,
  type LicenseTierId,
  PERPETUAL_TIERS,
  type PerpetualTier,
  SUBSCRIPTION_TIERS,
  type SubscriptionTier,
  TIER_COLORS,
  TIER_LABELS,
  TIER_LIMITS,
  type TierLimits,
} from '@revealui/contracts';
// ── DB: table types ─────────────────────────────────────────────────────────
export type {
  TableInsert,
  TableRow,
  TableUpdate,
} from '@revealui/db';
// ── DB: product & order tables ──────────────────────────────────────────────
export { orders, products } from '@revealui/db';
