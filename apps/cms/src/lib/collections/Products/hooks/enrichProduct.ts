'use server'

import {
  formatPriceRange,
  getAvailablePrices,
  getDefaultPriceId,
  getPriceCount,
  getPriceRange,
  hasProductPrices,
  hasStripeProduct,
} from '@revealui/contracts/entities'
import type { RevealAfterReadHook } from '@revealui/core'
import type { Product } from '@revealui/core/types/cms'

/**
 * Product Enrichment Hook (afterRead)
 *
 * Enriches product documents with computed display fields for easier
 * consumption by frontend components and API clients.
 *
 * Added Fields:
 * - priceRange: { min, max, currency } - Numeric price range
 * - formattedPriceRange: string - Formatted price range for display
 * - priceCount: number - Number of available prices
 * - defaultPriceId: string - Default Stripe price ID
 * - isActive: boolean - Whether product has valid Stripe product
 * - hasPaywall: boolean - Whether paywall is enabled
 * - hasPrices: boolean - Whether product has associated prices
 *
 * Use Cases:
 * - Product cards/lists (display formatted price range)
 * - Product detail pages (show all price options)
 * - API responses (provide computed metadata)
 * - AI context (structured product data)
 *
 * Performance:
 * - All computations happen in-memory (no additional API calls)
 * - Parses priceJSON only once
 * - Type-safe with runtime validation
 *
 * @example
 * ```typescript
 * // In collection config:
 * hooks: {
 *   afterRead: [enrichProduct]
 * }
 *
 * // Result:
 * const product = await revealui.findByID({ collection: 'products', id: 1 })
 * console.log(product.formattedPriceRange) // "$9.99 - $99.99"
 * console.log(product.priceCount) // 3
 * console.log(product.isActive) // true
 * ```
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Product with enrichment fields
 */
export interface EnrichedProduct extends Product {
  /** Numeric price range */
  priceRange?: {
    min: number | null
    max: number | null
    currency: string | null
  } | null

  /** Formatted price range string (e.g., "$9.99 - $99.99") */
  formattedPriceRange?: string | null

  /** Number of available prices */
  priceCount?: number

  /** Default Stripe price ID */
  defaultPriceId?: string | null

  /** Whether product has valid Stripe product */
  isActive?: boolean

  /** Whether paywall is enabled */
  hasPaywall?: boolean

  /** Whether product has associated prices */
  hasPrices?: boolean
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parse priceJSON string safely
 */
function parsePriceJSON(priceJSON: string | null | undefined): unknown {
  if (!priceJSON) return null

  try {
    return JSON.parse(priceJSON)
  } catch {
    return null
  }
}

// =============================================================================
// Main Hook
// =============================================================================

/**
 * Enrich product with computed display fields
 */
export const enrichProduct: RevealAfterReadHook = async ({ doc }) => {
  const product = doc as Product

  // Only enrich if product has Stripe product
  if (!hasStripeProduct(product)) {
    return {
      ...product,
      priceRange: null,
      formattedPriceRange: null,
      priceCount: 0,
      defaultPriceId: null,
      isActive: false,
      hasPaywall: product.enablePaywall,
      hasPrices: false,
    }
  }

  // Parse priceJSON if it's a string
  let workingProduct = product
  if (typeof product.priceJSON === 'string') {
    const parsed = parsePriceJSON(product.priceJSON)
    workingProduct = {
      ...product,
      priceJSON: parsed,
    } as Product
  }

  // Calculate enrichment fields using utility functions
  const priceRange = getPriceRange(workingProduct)
  const formattedPriceRange = formatPriceRange(workingProduct)
  const priceCount = getPriceCount(workingProduct)
  const defaultPriceId = getDefaultPriceId(workingProduct)
  const hasPrices = hasProductPrices(workingProduct)

  // Return enriched product
  return {
    ...product,
    priceRange,
    formattedPriceRange,
    priceCount,
    defaultPriceId,
    isActive: true,
    hasPaywall: product.enablePaywall,
    hasPrices,
  } satisfies EnrichedProduct
}

// =============================================================================
// Utility Exports
// =============================================================================

/**
 * Manually enrich a product (useful for testing or custom logic)
 */
export async function enrichProductManually(product: Product): Promise<EnrichedProduct> {
  const result = await enrichProduct({
    doc: product,
    req: {} as never, // Not used in enrichProduct
  })

  return result as EnrichedProduct
}

/**
 * Enrich multiple products in batch
 */
export async function enrichProductsBatch(products: Product[]): Promise<EnrichedProduct[]> {
  return Promise.all(
    products.map(async (product) => {
      const result = await enrichProduct({
        doc: product,
        req: {} as never,
      })
      return result as EnrichedProduct
    }),
  )
}

/**
 * Extract price statistics from enriched product
 */
export function getPriceStatistics(product: EnrichedProduct): {
  hasValidPricing: boolean
  minPrice: number | null
  maxPrice: number | null
  currency: string | null
  totalPrices: number
  formattedRange: string | null
} {
  return {
    hasValidPricing: product.isActive && product.hasPrices,
    minPrice: product.priceRange?.min || null,
    maxPrice: product.priceRange?.max || null,
    currency: product.priceRange?.currency || null,
    totalPrices: product.priceCount || 0,
    formattedRange: product.formattedPriceRange || null,
  }
}

/**
 * Check if product is ready for purchase
 */
export function isProductPurchasable(product: EnrichedProduct): boolean {
  return (
    product.isActive === true &&
    product.hasPrices === true &&
    product._status === 'published' &&
    (product.priceCount || 0) > 0
  )
}

/**
 * Get product display name with price
 */
export function getProductDisplayName(product: EnrichedProduct): string {
  const title = product.title
  const priceRange = product.formattedPriceRange

  if (priceRange) {
    return `${title} (${priceRange})`
  }

  return title
}
