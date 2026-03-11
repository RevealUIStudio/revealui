/**
 * Product Relationship Population Examples
 *
 * Demonstrates various strategies for populating product relationships:
 * 1. Automatic population with depth parameter
 * 2. Lazy loading relationships on-demand
 * 3. Batch loading multiple products
 * 4. Selective field population
 * 5. Deep population (nested relationships)
 * 6. AI-optimized context gathering
 * 7. API response enrichment
 *
 * @module collections/Products/examples/populate
 */

import type {
  Product,
  ProductWithCategories,
  ProductWithRelated,
} from '@revealui/contracts/entities';
import type { RevealUIInstance, RevealValue, RevealWhere } from '@revealui/core';

// =============================================================================
// Example 1: Automatic Population with Depth
// =============================================================================

/**
 * Get product with all relationships populated automatically
 *
 * Depth Controls:
 * - depth: 0 - No population (IDs only)
 * - depth: 1 - Populate direct relationships (categories, relatedProducts)
 * - depth: 2 - Populate nested relationships (relatedProducts.categories)
 *
 * @example
 * ```typescript
 * const product = await getProductWithRelationships(revealui, 1)
 * console.log(product.categories[0].name) // 'Electronics'
 * console.log(product.relatedProducts[0].title) // 'Related Product Title'
 * ```
 */
export async function getProductWithRelationships(
  revealui: RevealUIInstance,
  productId: string | number,
): Promise<Product | null> {
  return (await revealui.findByID({
    collection: 'products',
    id: productId,
    depth: 1, // Populate categories and relatedProducts
  })) as Product | null;
}

// =============================================================================
// Example 2: Lazy Loading Relationships
// =============================================================================

/**
 * Load product first, then populate relationships on-demand
 *
 * Use when:
 * - You don't always need relationships
 * - You want to control when relationships are fetched
 * - You need conditional loading based on product data
 *
 * @example
 * ```typescript
 * const product = await getProductLazy(revealui, 1)
 * if (product.enablePaywall) {
 *   const categories = await loadCategories(revealui, product)
 *   console.log(categories)
 * }
 * ```
 */
export async function getProductLazy(
  revealui: RevealUIInstance,
  productId: string | number,
): Promise<Product | null> {
  // Load product without relationships (depth: 0)
  return (await revealui.findByID({
    collection: 'products',
    id: productId,
    depth: 0,
  })) as Product | null;
}

/**
 * Load categories for a product on-demand
 */
export async function loadCategories(
  revealui: RevealUIInstance,
  product: Product,
): Promise<Array<{ id: number; name: string }>> {
  if (!product.categories || product.categories.length === 0) {
    return [];
  }

  const categoryIds = product.categories.filter((cat): cat is number => typeof cat === 'number');

  const categories = await Promise.all(
    categoryIds.map((id) =>
      revealui.findByID({
        collection: 'categories',
        id,
      }),
    ),
  );

  return categories.filter((cat): cat is { id: number; name: string } => cat !== null);
}

/**
 * Load related products for a product on-demand
 */
export async function loadRelatedProducts(
  revealui: RevealUIInstance,
  product: Product,
): Promise<Product[]> {
  if (!product.relatedProducts || product.relatedProducts.length === 0) {
    return [];
  }

  const productIds = product.relatedProducts.filter((p): p is number => typeof p === 'number');

  const products = await Promise.all(
    productIds.map((id) =>
      revealui.findByID({
        collection: 'products',
        id,
      }),
    ),
  );

  return products.filter((p) => p !== null) as unknown as Product[];
}

// =============================================================================
// Example 3: Batch Loading Multiple Products
// =============================================================================

/**
 * Load multiple products with relationships in a single batch
 *
 * Use when:
 * - Fetching product lists for display
 * - Building product catalogs
 * - Loading user's purchased products
 *
 * @example
 * ```typescript
 * const products = await getProductsBatch(revealui, {
 *   where: { _status: { equals: 'published' } },
 *   depth: 1
 * })
 * console.log(products.map(p => p.title))
 * ```
 */
export async function getProductsBatch(
  revealui: RevealUIInstance,
  options: {
    where?: Record<string, unknown>;
    depth?: number;
    limit?: number;
  } = {},
): Promise<{ docs: Product[]; totalDocs: number }> {
  const { where = {}, depth = 1, limit = 10 } = options;

  return (await revealui.find({
    collection: 'products',
    where: where as unknown as RevealWhere,
    depth,
    limit,
  })) as unknown as { docs: Product[]; totalDocs: number };
}

// =============================================================================
// Example 4: Selective Field Population
// =============================================================================

/**
 * Populate only specific fields to optimize performance
 *
 * Use when:
 * - You only need certain relationship data
 * - Optimizing API response size
 * - Building minimal product cards
 *
 * @example
 * ```typescript
 * const product = await getProductSelectivePopulate(revealui, 1)
 * // Only has id and title for related products
 * console.log(product.relatedProducts[0].title)
 * ```
 */
export async function getProductSelectivePopulate(
  revealui: RevealUIInstance,
  productId: string | number,
): Promise<Product | null> {
  // First, get product with depth: 0 (no population)
  const product = await revealui.findByID({
    collection: 'products',
    id: productId,
    depth: 0,
  });

  if (!product) return null;

  // Manually populate only needed fields
  if (product.relatedProducts && Array.isArray(product.relatedProducts)) {
    const relatedIds = product.relatedProducts.filter((p): p is number => typeof p === 'number');

    const relatedProducts = await Promise.all(
      relatedIds.map(async (id) => {
        const related = await revealui.findByID({
          collection: 'products',
          id,
          depth: 0,
        });
        // Return only needed fields
        return related
          ? {
              id: related.id,
              title: related.title,
              stripeProductID: related.stripeProductID,
            }
          : null;
      }),
    );

    // Type assertion to satisfy TypeScript
    product.relatedProducts = relatedProducts.filter(
      (p): p is { id: number; title: string; stripeProductID: string | null } => p !== null,
    ) as unknown as RevealValue;
  }

  return product as unknown as Product;
}

// =============================================================================
// Example 5: Deep Population (Nested Relationships)
// =============================================================================

/**
 * Populate multiple levels of relationships
 *
 * Use when:
 * - Building comprehensive product pages
 * - Need full relationship tree
 * - Avoiding multiple round-trips
 *
 * Warning: Can be expensive for deeply nested data
 *
 * @example
 * ```typescript
 * const product = await getProductDeepPopulate(revealui, 1)
 * // relatedProducts[0].categories[0].name is accessible
 * console.log(product.relatedProducts[0].categories[0].name)
 * ```
 */
export async function getProductDeepPopulate(
  revealui: RevealUIInstance,
  productId: string | number,
): Promise<ProductWithRelated | null> {
  return (await revealui.findByID({
    collection: 'products',
    id: productId,
    depth: 2, // Populate nested relationships
  })) as ProductWithRelated | null;
}

// =============================================================================
// Example 6: AI Context Gathering
// =============================================================================

/**
 * Gather comprehensive product context for AI processing
 *
 * Use when:
 * - Providing context to AI for product recommendations
 * - Generating product descriptions
 * - Analyzing product relationships
 *
 * @example
 * ```typescript
 * const context = await getProductContextForAI(revealui, 1)
 * const prompt = `Based on this product: ${JSON.stringify(context)}, recommend similar products`
 * ```
 */
export async function getProductContextForAI(
  revealui: RevealUIInstance,
  productId: string | number,
): Promise<{
  product: Product;
  categoryNames: string[];
  relatedProductTitles: string[];
  priceCount: number;
  hasPaywall: boolean;
}> {
  const product = (await revealui.findByID({
    collection: 'products',
    id: productId,
    depth: 1,
  })) as ProductWithRelated | null;

  if (!product) {
    throw new Error(`Product ${productId} not found`);
  }

  // Extract category names
  const categoryNames =
    product.categories?.map((cat) => (typeof cat === 'object' ? cat.name : '')).filter(Boolean) ||
    [];

  // Extract related product titles
  const relatedProductTitles =
    product.relatedProducts?.map((p) => (typeof p === 'object' ? p.title : '')).filter(Boolean) ||
    [];

  // Parse price count
  let priceCount = 0;
  if (product.priceJSON) {
    try {
      const priceData =
        typeof product.priceJSON === 'string' ? JSON.parse(product.priceJSON) : product.priceJSON;
      priceCount = priceData?.data?.length || 0;
    } catch {
      priceCount = 0;
    }
  }

  return {
    product,
    categoryNames,
    relatedProductTitles,
    priceCount,
    hasPaywall: product.enablePaywall ?? false,
  };
}

// =============================================================================
// Example 7: API Response Enrichment
// =============================================================================

/**
 * Enrich product for API response with computed fields
 *
 * Use when:
 * - Building REST API endpoints
 * - Creating GraphQL resolvers
 * - Generating product feeds
 *
 * @example
 * ```typescript
 * const enriched = await enrichProductForAPI(revealui, 1)
 * console.log(enriched.meta.categoryCount) // 3
 * console.log(enriched.meta.hasRelatedProducts) // true
 * ```
 */
export async function enrichProductForAPI(
  revealui: RevealUIInstance,
  productId: string | number,
): Promise<
  ProductWithCategories & {
    meta: {
      categoryCount: number;
      relatedProductCount: number;
      hasRelatedProducts: boolean;
      hasStripeProduct: boolean;
      hasPrices: boolean;
      priceCount: number;
    };
  }
> {
  const product = (await revealui.findByID({
    collection: 'products',
    id: productId,
    depth: 1,
  })) as ProductWithCategories | null;

  if (!product) {
    throw new Error(`Product ${productId} not found`);
  }

  // Count prices
  let priceCount = 0;
  if (product.priceJSON) {
    try {
      const priceData =
        typeof product.priceJSON === 'string' ? JSON.parse(product.priceJSON) : product.priceJSON;
      priceCount = priceData?.data?.length || 0;
    } catch {
      priceCount = 0;
    }
  }

  return {
    ...product,
    meta: {
      categoryCount: product.categories?.length || 0,
      relatedProductCount: product.relatedProducts?.length || 0,
      hasRelatedProducts: (product.relatedProducts?.length || 0) > 0,
      hasStripeProduct: !!product.stripeProductID,
      hasPrices: priceCount > 0,
      priceCount,
    },
  };
}

// =============================================================================
// Usage in Collection Config
// =============================================================================

/**
 * Example: Use in afterRead hook to automatically populate relationships
 *
 * ```typescript
 * import type { RevealCollectionConfig } from '@revealui/core'
 *
 * export const Products: RevealCollectionConfig<Product> = {
 *   slug: 'products',
 *   hooks: {
 *     afterRead: [
 *       async ({ doc, req, context }) => {
 *         // Populate based on query depth parameter
 *         if (context?.depth && context.depth > 0) {
 *           const populated = await getProductWithRelationships(
 *             req.revealui,
 *             doc.id
 *           )
 *           return populated || doc
 *         }
 *         return doc
 *       }
 *     ]
 *   }
 * }
 * ```
 */
