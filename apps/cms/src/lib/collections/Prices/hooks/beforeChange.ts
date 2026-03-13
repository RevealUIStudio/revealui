import {
  type StripePriceData,
  StripePriceDataSchema,
  StripePriceIDSchema,
} from '@revealui/contracts/entities';
import type { RevealBeforeChangeHook } from '@revealui/core';
import type { Price } from '@revealui/core/types/cms';
import { LRUCache } from '@revealui/core/utils/cache';

const logs = false;

type StripePriceService = {
  prices: {
    retrieve(priceId: string): Promise<unknown>;
  };
};

// Shared cache instance for Stripe API responses
// 5 minute TTL, max 100 entries to prevent memory leaks
const cache = new LRUCache<string, StripePriceData>({
  maxSize: 100,
  ttlMs: 5 * 60 * 1000, // 5 minutes
});

// Retrieve a single Stripe price by price ID with caching
async function cachedRetrievePrice(
  stripe: StripePriceService,
  priceId: string,
): Promise<StripePriceData> {
  return cache.fetch(`price_${priceId}`, async () => {
    const price = await stripe.prices.retrieve(priceId);
    // Validate the Stripe response matches expected structure
    const validatedPrice = StripePriceDataSchema.parse(price);
    return validatedPrice;
  });
}

/**
 * Validates stripePriceID format before making API calls
 */
function validateStripePriceID(priceId: string | null | undefined): {
  valid: boolean;
  error?: string;
} {
  if (!priceId) {
    return { valid: false, error: 'Stripe Price ID is required' };
  }

  const result = StripePriceIDSchema.safeParse(priceId);
  if (!result.success) {
    const errorMessage = result.error.issues[0]?.message || 'Invalid Stripe Price ID format';
    return { valid: false, error: errorMessage };
  }

  return { valid: true };
}

/**
 * Validates business rules for price data
 */
function validatePriceBusinessRules(
  data: Price,
  stripePrice: StripePriceData,
): { valid: boolean; error?: string } {
  // Business rule: published prices must have valid Stripe price
  if (data._status === 'published') {
    if (!stripePrice.active) {
      return {
        valid: false,
        error: 'Cannot publish a price with inactive Stripe price',
      };
    }

    // Check if price has tiered pricing
    const hasTiers = stripePrice.tiers && stripePrice.tiers.length > 0;

    // For tiered pricing, unit_amount can be null
    // For standard pricing, unit_amount is required
    if (stripePrice.unit_amount === null && !hasTiers) {
      return {
        valid: false,
        error: 'Cannot publish a price without a unit amount',
      };
    }

    // Validate unit_amount if present (not null)
    if (stripePrice.unit_amount !== null && stripePrice.unit_amount < 0) {
      return {
        valid: false,
        error: 'Price amount must be positive',
      };
    }
  }

  // Verify price ID matches
  if (stripePrice.id !== data.stripePriceID) {
    return {
      valid: false,
      error: 'Stripe price ID mismatch',
    };
  }

  return { valid: true };
}

export const beforePriceChange: RevealBeforeChangeHook<Price> = async ({ req, data }) => {
  const revealui = req?.revealui;
  const newDoc: Price = {
    ...data,
    skipSync: false, // Set back to 'false' so that all changes continue to sync to Stripe
  };

  // Dynamic import — @revealui/services is an optional Pro dependency
  const services = await import('@revealui/services').catch(() => null);
  if (!services) {
    // Allow drafts without Stripe, but block published prices
    if (data.stripePriceID || data._status === 'published') {
      throw new Error('Stripe features require @revealui/services (Pro)');
    }
    return newDoc;
  }

  // Skip sync if explicitly requested
  if (data.skipSync) {
    if (logs) revealui?.logger?.info(`Skipping price 'beforeChange' hook`);
    return newDoc;
  }

  // Allow draft prices without Stripe price configured
  if (!data.stripePriceID) {
    if (data._status === 'published') {
      revealui?.logger?.error(
        'Cannot publish price without Stripe Price ID configured. Please add a valid Stripe price.',
      );
      throw new Error('Published prices must have a valid Stripe Price ID');
    }

    if (logs) {
      revealui?.logger?.info(
        `No Stripe price assigned to this document, skipping price 'beforeChange' hook`,
      );
    }
    return newDoc;
  }

  // Validate Stripe Price ID format
  const idValidation = validateStripePriceID(data.stripePriceID);
  if (!idValidation.valid) {
    revealui?.logger?.error(`Invalid Stripe Price ID: ${idValidation.error}`);
    throw new Error(`Invalid Stripe Price ID: ${idValidation.error}`);
  }

  try {
    // Fetch and validate the price from Stripe
    const stripePrice = await cachedRetrievePrice(services.protectedStripe, data.stripePriceID);

    if (logs) {
      revealui?.logger?.info(
        `Found price from Stripe: ${stripePrice.id} (${stripePrice.currency} ${stripePrice.unit_amount ? stripePrice.unit_amount / 100 : 'N/A'})`,
      );
    }

    // Validate business rules
    const businessValidation = validatePriceBusinessRules(newDoc, stripePrice);
    if (!businessValidation.valid) {
      revealui?.logger?.error(`Price validation failed: ${businessValidation.error}`);
      throw new Error(`Price validation failed: ${businessValidation.error}`);
    }

    // Store the validated price object as JSON
    newDoc.priceJSON = JSON.stringify(stripePrice);
  } catch (error) {
    // Check if it's a validation error (already logged)
    if (error instanceof Error && error.message.startsWith('Price validation failed')) {
      throw error;
    }

    // Check if it's a Stripe API error
    const isStripeError = error && typeof error === 'object' && 'type' in error;

    if (isStripeError) {
      const stripeErrorMessage = 'message' in error ? String(error.message) : 'Unknown error';
      revealui?.logger?.error(
        `Stripe API error for price ${data.stripePriceID}: ${stripeErrorMessage}`,
      );
      throw new Error(
        `Failed to fetch price from Stripe: ${stripeErrorMessage}. Please verify the price ID is correct.`,
      );
    }

    // Generic error
    revealui?.logger?.error(`Error fetching price from Stripe: ${error}`);
    throw new Error(
      `Failed to validate price with Stripe: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }

  return newDoc;
};
