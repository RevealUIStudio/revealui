/**
 * Products primitive — product catalog, orders, and pricing tiers.
 *
 * Re-exports from @revealui/db and @revealui/contracts.
 */

// ── DB: product & order tables ──────────────────────────────────────────────
export { products, orders } from '@revealui/db';

// ── DB: table types ─────────────────────────────────────────────────────────
export type {
  TableRow,
  TableInsert,
  TableUpdate,
} from '@revealui/db';

// ── Contracts: pricing tiers & limits ───────────────────────────────────────
export {
  SUBSCRIPTION_TIERS,
  PERPETUAL_TIERS,
  CREDIT_BUNDLES,
  TIER_LIMITS,
  TIER_LABELS,
  TIER_COLORS,
  getTierLabel,
  getTierColor,
  getTiersFromCurrent,
  type LicenseTierId,
  type PerpetualTier,
  type SubscriptionTier,
  type TierLimits,
  type CreditBundle,
} from '@revealui/contracts';

// ── Contracts: RevealCoin ───────────────────────────────────────────────────
export {
  formatRvuiAmount,
  getRvuiMintAddress,
  parseRvuiAmount,
  RVUI_MINT_ADDRESSES,
  RVUI_TOKEN_CONFIG,
  RVUI_ALLOCATIONS,
  RVUI_DISCOUNT_RATES,
  type RvuiAllocation,
  type RvuiDiscountRate,
  type RvuiTokenConfig,
  type SolanaNetwork,
} from '@revealui/contracts';
