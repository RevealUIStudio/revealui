/**
 * Price Collection - Populate API Examples
 *
 * This file demonstrates common patterns for populating relationships
 * in the Prices collection using RevealUI's Populate API.
 */

import type { PriceWithCategories, PriceWithRelated } from '@revealui/contracts/entities';
import type { RevealDocument, RevealUIInstance } from '@revealui/core';
import type { Price } from '@revealui/core/types/admin';

// =============================================================================
// Example 1: Fetch with Automatic Population
// =============================================================================

/**
 * Fetch a single price with all relationships populated
 */
export async function getPriceWithRelationships(
  revealui: RevealUIInstance,
  priceId: string | number,
): Promise<Price | null> {
  return (await revealui.findByID({
    collection: 'prices',
    id: priceId,
    depth: 1, // Populate categories and relatedPrices (1 level deep)
  })) as Price | null;
}

/**
 * Fetch all published prices with categories
 */
export async function getPublishedPricesWithCategories(
  revealui: RevealUIInstance,
): Promise<PriceWithCategories[]> {
  const result = await revealui.find({
    collection: 'prices',
    where: {
      _status: { equals: 'published' },
    },
    depth: 1, // Populate categories
    limit: 100,
  });

  return result.docs as PriceWithCategories[];
}

// =============================================================================
// Example 2: Manual Population (Lazy Loading)
// =============================================================================

/**
 * Fetch prices without relationships, then populate on demand
 * Useful for:
 * - Initial page load (fetch basic data)
 * - User interaction (populate when needed)
 * - Performance optimization (avoid over-fetching)
 */
export async function lazyPopulatePrices(revealui: RevealUIInstance) {
  // Step 1: Fetch basic price data (fast)
  const result = await revealui.find({
    collection: 'prices',
    where: { _status: { equals: 'published' } },
    depth: 0, // No population
  });

  // Example only  -  log removed for production

  // Step 2: Populate relationships when needed (e.g., user clicks "Show details")
  const firstPrice = result.docs[0];
  if (firstPrice) {
    // Fully hydrate the price  -  use the result in your application code
    await revealui.populate('prices', firstPrice, {
      depth: 1,
    });
  }

  return result.docs;
}

// =============================================================================
// Example 3: Batch Population for Performance
// =============================================================================

/**
 * Fetch multiple prices and populate all at once
 * More efficient than populating one at a time
 */
export async function batchPopulatePrices(
  revealui: RevealUIInstance,
  priceIds: (string | number)[],
): Promise<Price[]> {
  // Fetch all prices (unpopulated)
  const prices = await Promise.all(
    priceIds.map((id) =>
      revealui.findByID({
        collection: 'prices',
        id,
        depth: 0,
      }),
    ),
  );

  // Filter out nulls
  const validPrices = prices.filter((p) => p !== null);

  // Populate all at once (uses DataLoader batching internally)
  const populated = await revealui.populate('prices', validPrices as unknown as RevealDocument[], {
    depth: 1,
  });

  return (Array.isArray(populated) ? populated : [populated]) as unknown as Price[];
}

// =============================================================================
// Example 4: Selective Population
// =============================================================================

/**
 * Populate only specific relationships
 * Note: The populate parameter controls which fields to populate
 */
export async function getpricesWithCategoriesOnly(
  revealui: RevealUIInstance,
): Promise<PriceWithCategories[]> {
  const result = await revealui.find({
    collection: 'prices',
    depth: 1,
    populate: {
      categories: true, // Populate categories
      relatedPrices: false, // Skip related prices
    },
  });

  return result.docs as PriceWithCategories[];
}

// =============================================================================
// Example 5: Deep Population (Nested Relationships)
// =============================================================================

/**
 * Populate relationships 2 levels deep
 * Price -> relatedPrices -> their categories
 */
export async function getPriceWithDeepRelationships(
  revealui: RevealUIInstance,
  priceId: string | number,
): Promise<PriceWithRelated | null> {
  const price = await revealui.findByID({
    collection: 'prices',
    id: priceId,
    depth: 2, // Populate 2 levels deep
  });

  if (!price) return null;

  // Note: relatedPrices has maxDepth: 1, so it won't populate deeper
  // This prevents infinite loops and performance issues
  return price as PriceWithRelated;
}

// =============================================================================
// Example 6: AI Context Generation
// =============================================================================

/**
 * Generate rich context for AI with all related data
 * Perfect for feeding to LLMs or generating content
 */
export async function generatePriceContextForAI(
  revealui: RevealUIInstance,
  priceId: string | number,
): Promise<string> {
  // Fetch with full population
  const price = await revealui.findByID({
    collection: 'prices',
    id: priceId,
    depth: 2,
  });

  if (!price) {
    throw new Error(`Price ${priceId} not found`);
  }

  // Build context string
  const context = `
Price: ${price.title}
Stripe Price ID: ${price.stripePriceID || 'None'}
Status: ${price._status || 'draft'}
Published: ${price.publishedOn || 'Not published'}

${price.priceJSON ? `Price Data: ${JSON.stringify(JSON.parse(price.priceJSON as unknown as string), null, 2)}` : ''}

Categories: ${
    Array.isArray(price.categories)
      ? price.categories
          .map((cat) => (typeof cat === 'object' && cat !== null && 'name' in cat ? cat.name : cat))
          .join(', ')
      : 'None'
  }

Related Prices: ${
    Array.isArray(price.relatedPrices)
      ? price.relatedPrices
          .map((p) => (typeof p === 'object' && p !== null && 'title' in p ? p.title : p))
          .join(', ')
      : 'None'
  }
  `.trim();

  return context;
}

// =============================================================================
// Example 7: API Response Enrichment
// =============================================================================

/**
 * Enrich API responses with populated data
 * Common pattern for REST/GraphQL APIs
 */
export async function enrichPriceForAPI(
  revealui: RevealUIInstance,
  priceId: string | number,
): Promise<{
  id: number | string;
  title: string;
  stripePriceID: string | null;
  categories: Array<{ id: number; name: string }>;
  relatedPrices: Array<{ id: number; title: string }>;
}> {
  const price = await revealui.findByID({
    collection: 'prices',
    id: priceId,
    depth: 1,
  });

  if (!price) {
    throw new Error(`Price ${priceId} not found`);
  }

  // Transform to API shape
  return {
    id: price.id,
    title: price.title as string,
    stripePriceID: (price.stripePriceID as string | null) || null,
    categories:
      (price.categories as unknown as Array<{ id: number; name: string }>)?.map((cat) =>
        typeof cat === 'object' && cat !== null && 'id' in cat && 'name' in cat
          ? { id: cat.id as number, name: cat.name as string }
          : { id: cat as unknown as number, name: 'Unknown' },
      ) || [],
    relatedPrices:
      (price.relatedPrices as unknown as Array<{ id: number; title: string }>)?.map((p) =>
        typeof p === 'object' && p !== null && 'id' in p && 'title' in p
          ? { id: p.id as number, title: p.title as string }
          : { id: p as unknown as number, title: 'Unknown' },
      ) || [],
  };
}
