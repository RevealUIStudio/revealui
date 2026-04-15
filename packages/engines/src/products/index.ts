/**
 * Products primitive — product catalog, orders, and pricing tiers.
 *
 * Re-exports from @revealui/db and @revealui/contracts.
 */

// ── Contracts: pricing tiers & limits ───────────────────────────────────────
// ── Contracts: RevealCoin ───────────────────────────────────────────────────
export {
  CREDIT_BUNDLES,
  type CreditBundle,
  formatRvuiAmount,
  getRvuiMintAddress,
  getTierColor,
  getTierLabel,
  getTiersFromCurrent,
  type LicenseTierId,
  PERPETUAL_TIERS,
  type PerpetualTier,
  parseRvuiAmount,
  RVUI_ALLOCATIONS,
  RVUI_DISCOUNT_RATES,
  RVUI_MINT_ADDRESSES,
  RVUI_TOKEN_CONFIG,
  type RvuiAllocation,
  type RvuiDiscountRate,
  type RvuiTokenConfig,
  type SolanaNetwork,
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
