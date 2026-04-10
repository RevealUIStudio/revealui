/**
 * Calculate Price Hook
 *
 * Enriches price documents with computed values from Stripe price data.
 * Runs in afterRead to add display-friendly fields to price objects.
 *
 * Computed fields added:
 * - displayAmount: Formatted price string (e.g., "$10.00")
 * - formattedPrice: Full price description with interval
 * - isActive: Whether the Stripe price is active
 * - currency: ISO currency code (uppercase)
 * - interval: Billing interval for recurring prices
 * - tierInfo: Tiered pricing details if applicable
 */

import {
  type Price as ContractsPrice,
  formatPriceAmount,
  getDisplayAmount,
  getIntervalDescription,
  hasStripePrice,
  hasTieredPricing,
  isRecurringPrice,
  type StripePriceData,
} from '@revealui/contracts/entities';
import type { RevealAfterReadHook } from '@revealui/core';
import type { Price } from '@revealui/core/types/admin';
import { asBridgedDoc, asDocument, toRevealDocument } from '@/lib/utils/type-guards';

const logs = false;

/**
 * Extended Price with computed fields
 */
export interface EnrichedPrice extends Price {
  // Computed display fields
  displayAmount?: string | null;
  formattedPrice?: string | null;
  isActive?: boolean;
  currency?: string;
  interval?: string | null;
  tierInfo?: {
    hasTiers: boolean;
    tierCount?: number;
    lowestTier?: string;
    highestTier?: string;
  } | null;
}

/**
 * Parse priceJSON safely
 */
function parsePriceJSON(priceJSON: string | null | undefined): StripePriceData | null {
  if (!priceJSON || typeof priceJSON !== 'string') return null;

  try {
    return JSON.parse(priceJSON) as StripePriceData;
  } catch (_error) {
    // Error is already logged by the caller if logs is enabled
    // No need to log here to avoid duplicate logging
    return null;
  }
}

/**
 * Calculate tier information for tiered pricing
 */
function calculateTierInfo(stripePriceData: StripePriceData): EnrichedPrice['tierInfo'] | null {
  if (!stripePriceData.tiers || stripePriceData.tiers.length === 0) {
    return null;
  }

  const tiers = stripePriceData.tiers;
  const firstTier = tiers[0];
  const lastTier = tiers[tiers.length - 1];

  // Get lowest price
  const lowestAmount = firstTier?.unit_amount || firstTier?.flat_amount;
  const lowestTier = lowestAmount
    ? formatPriceAmount(lowestAmount, stripePriceData.currency)
    : undefined;

  // Get highest price (if not "inf")
  const lastUpTo = lastTier?.up_to;
  const highestAmount =
    lastUpTo !== 'inf' && lastUpTo !== null ? lastTier?.unit_amount || lastTier?.flat_amount : null;
  const highestTier = highestAmount
    ? formatPriceAmount(highestAmount, stripePriceData.currency)
    : undefined;

  return {
    hasTiers: true,
    tierCount: tiers.length,
    lowestTier,
    highestTier,
  };
}

/**
 * Build formatted price description
 * @example "$10.00 / month"
 * @example "$50.00 (one-time)"
 * @example "$0.10 - $100.00 per unit (tiered)"
 */
function buildFormattedPrice(
  priceWithParsedJSON: ContractsPrice,
  stripePriceData: StripePriceData,
  tierInfo: EnrichedPrice['tierInfo'],
): string | null {
  // Handle tiered pricing
  if (tierInfo?.hasTiers) {
    const range =
      tierInfo.lowestTier && tierInfo.highestTier
        ? `${tierInfo.lowestTier} - ${tierInfo.highestTier}`
        : tierInfo.lowestTier || 'Variable';

    const interval = getIntervalDescription(priceWithParsedJSON);
    return interval ? `${range} / ${interval} (tiered)` : `${range} per unit (tiered)`;
  }

  // Handle standard pricing
  const displayAmount = getDisplayAmount(priceWithParsedJSON);
  if (!displayAmount) return null;

  // One-time payment
  if (stripePriceData.type === 'one_time') {
    return `${displayAmount} (one-time)`;
  }

  // Recurring payment
  const interval = getIntervalDescription(priceWithParsedJSON);
  if (interval) {
    // Add trial info if present
    const trialDays = stripePriceData.recurring?.trial_period_days;
    const trialInfo = trialDays ? ` (${trialDays}-day trial)` : '';
    return `${displayAmount} / ${interval}${trialInfo}`;
  }

  return displayAmount;
}

/**
 * Calculate and enrich price data
 */
export const calculatePrice: RevealAfterReadHook = async ({ doc, req }) => {
  const price = asDocument<Price>(doc);
  const revealui = req?.revealui;

  // Skip if no Stripe price configured
  // Price and ContractsPrice describe the same document shape from different type systems.
  if (!hasStripePrice(asBridgedDoc<ContractsPrice>(price))) {
    if (logs) {
      revealui?.logger?.info(`Price ${price.id} has no Stripe price, skipping calculations`);
    }
    return toRevealDocument(price);
  }

  // Parse Stripe price data
  const stripePriceData = parsePriceJSON(price.priceJSON as string | null);
  if (!stripePriceData) {
    if (logs) {
      revealui?.logger?.warn(`Price ${price.id} has invalid priceJSON`);
    }
    return toRevealDocument(price);
  }

  // Create a temporary Price object with parsed priceJSON for utility functions
  // The utility functions expect priceJSON to be an object, but admin type has it as string
  const priceWithParsedJSON = asBridgedDoc<ContractsPrice>({
    ...price,
    priceJSON: stripePriceData,
  });

  // Calculate tier information
  const tierInfo = hasTieredPricing(priceWithParsedJSON)
    ? calculateTierInfo(stripePriceData)
    : null;

  // Build enriched price object
  const enriched: EnrichedPrice = {
    ...price,
    // Display amount
    displayAmount: getDisplayAmount(priceWithParsedJSON),

    // Formatted price with interval
    formattedPrice: buildFormattedPrice(priceWithParsedJSON, stripePriceData, tierInfo),

    // Active status
    isActive: stripePriceData.active !== undefined ? stripePriceData.active : true,

    // Currency (uppercase)
    currency: stripePriceData.currency.toUpperCase(),

    // Interval for recurring prices
    interval: isRecurringPrice(priceWithParsedJSON)
      ? getIntervalDescription(priceWithParsedJSON)
      : null,

    // Tier information
    tierInfo,
  };

  if (logs) {
    revealui?.logger?.info(
      `Enriched price ${price.id}: ${enriched.formattedPrice} (active: ${enriched.isActive})`,
    );
  }

  return toRevealDocument(enriched);
};
