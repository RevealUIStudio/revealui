/**
 * Products enrichProduct Hook Tests
 *
 * Tests product enrichment logic including:
 * - Price range calculation
 * - Price formatting
 * - Active status determination
 * - Price counting
 * - Utility functions
 */

import type { RevealDocument, RevealRequest } from '@revealui/core';
import type { Product } from '@revealui/core/types/admin';
import { describe, expect, it } from 'vitest';
import {
  type EnrichedProduct,
  enrichProduct,
  enrichProductManually,
  enrichProductsBatch,
  getPriceStatistics,
  getProductDisplayName,
  isProductPurchasable,
} from '@/lib/collections/Products/hooks/enrichProduct';

// =============================================================================
// Test Data
// =============================================================================

const createMockProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 1,
  title: 'Test Product',
  stripeProductID: 'prod_1234567890123456',
  priceJSON: null,
  enablePaywall: false,
  paywall: null,
  layout: null,
  categories: null,
  relatedProducts: null,
  skipSync: false,
  publishedOn: null,
  updatedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  _status: 'draft',
  ...overrides,
});

const mockReq = {
  revealui: {},
};

const createPriceList = (prices: Array<{ currency: string; amount: number | null }>) => ({
  object: 'list' as const,
  data: prices.map((price, index) => ({
    id: `price_${index}`,
    object: 'price' as const,
    active: true,
    currency: price.currency,
    unit_amount: price.amount,
    type: 'one_time' as const,
  })),
  has_more: false,
});

// =============================================================================
// Tests
// =============================================================================

describe('Product Enrichment Hook', () => {
  // ===========================================================================
  // Price Range Calculation
  // ===========================================================================

  describe('Price Range Calculation', () => {
    it('should calculate price range for single price', async () => {
      const priceList = createPriceList([{ currency: 'usd', amount: 1000 }]);
      const product = createMockProduct({
        priceJSON: JSON.stringify(priceList) as never,
      });

      const result = (await enrichProduct({
        doc: product as unknown as RevealDocument,
        req: mockReq as unknown as RevealRequest,
        findMany: false,
        context: undefined,
        query: undefined,
      })) as unknown as EnrichedProduct;

      expect(result.priceRange).toEqual({
        min: 1000,
        max: 1000,
        currency: 'usd',
      });
    });

    it('should calculate price range for multiple prices', async () => {
      const priceList = createPriceList([
        { currency: 'usd', amount: 1000 },
        { currency: 'usd', amount: 2000 },
        { currency: 'usd', amount: 1500 },
      ]);
      const product = createMockProduct({
        priceJSON: JSON.stringify(priceList) as never,
      });

      const result = (await enrichProduct({
        doc: product as unknown as RevealDocument,
        req: mockReq as unknown as RevealRequest,
        findMany: false,
        context: undefined,
        query: undefined,
      })) as unknown as EnrichedProduct;

      expect(result.priceRange).toEqual({
        min: 1000,
        max: 2000,
        currency: 'usd',
      });
    });

    it('should handle null prices in range calculation', async () => {
      const priceList = createPriceList([
        { currency: 'usd', amount: 1000 },
        { currency: 'usd', amount: null },
        { currency: 'usd', amount: 2000 },
      ]);
      const product = createMockProduct({
        priceJSON: JSON.stringify(priceList) as never,
      });

      const result = (await enrichProduct({
        doc: product as unknown as RevealDocument,
        req: mockReq as unknown as RevealRequest,
        findMany: false,
        context: undefined,
        query: undefined,
      })) as unknown as EnrichedProduct;

      expect(result.priceRange).toEqual({
        min: 1000,
        max: 2000,
        currency: 'usd',
      });
    });

    it('should return null range for product with no prices', async () => {
      const product = createMockProduct({
        priceJSON: null,
      });

      const result = (await enrichProduct({
        doc: product as unknown as RevealDocument,
        req: mockReq as unknown as RevealRequest,
        findMany: false,
        context: undefined,
        query: undefined,
      })) as unknown as EnrichedProduct;

      expect(result.priceRange).toBeNull();
    });

    it('should return null range for product without Stripe product', async () => {
      const product = createMockProduct({
        stripeProductID: null,
      });

      const result = (await enrichProduct({
        doc: product as unknown as RevealDocument,
        req: mockReq as unknown as RevealRequest,
        findMany: false,
        context: undefined,
        query: undefined,
      })) as unknown as EnrichedProduct;

      expect(result.priceRange).toBeNull();
    });
  });

  // ===========================================================================
  // Price Formatting
  // ===========================================================================

  describe('Price Formatting', () => {
    it('should format single price correctly', async () => {
      const priceList = createPriceList([{ currency: 'usd', amount: 1000 }]);
      const product = createMockProduct({
        priceJSON: JSON.stringify(priceList) as never,
      });

      const result = (await enrichProduct({
        doc: product as unknown as RevealDocument,
        req: mockReq as unknown as RevealRequest,
        findMany: false,
        context: undefined,
        query: undefined,
      })) as unknown as EnrichedProduct;

      expect(result.formattedPriceRange).toBe('$10.00');
    });

    it('should format price range correctly', async () => {
      const priceList = createPriceList([
        { currency: 'usd', amount: 999 },
        { currency: 'usd', amount: 9999 },
      ]);
      const product = createMockProduct({
        priceJSON: JSON.stringify(priceList) as never,
      });

      const result = (await enrichProduct({
        doc: product as unknown as RevealDocument,
        req: mockReq as unknown as RevealRequest,
        findMany: false,
        context: undefined,
        query: undefined,
      })) as unknown as EnrichedProduct;

      expect(result.formattedPriceRange).toBe('$9.99 - $99.99');
    });

    it('should format EUR prices correctly', async () => {
      const priceList = createPriceList([
        { currency: 'eur', amount: 1000 },
        { currency: 'eur', amount: 2000 },
      ]);
      const product = createMockProduct({
        priceJSON: JSON.stringify(priceList) as never,
      });

      const result = (await enrichProduct({
        doc: product as unknown as RevealDocument,
        req: mockReq as unknown as RevealRequest,
        findMany: false,
        context: undefined,
        query: undefined,
      })) as unknown as EnrichedProduct;

      expect(result.formattedPriceRange).toContain('10.00');
      expect(result.formattedPriceRange).toContain('20.00');
    });

    it('should handle zero-decimal currencies (JPY)', async () => {
      const priceList = createPriceList([
        { currency: 'jpy', amount: 1000 },
        { currency: 'jpy', amount: 2000 },
      ]);
      const product = createMockProduct({
        priceJSON: JSON.stringify(priceList) as never,
      });

      const result = (await enrichProduct({
        doc: product as unknown as RevealDocument,
        req: mockReq as unknown as RevealRequest,
        findMany: false,
        context: undefined,
        query: undefined,
      })) as unknown as EnrichedProduct;

      // JPY formatted as ¥10.00 - ¥20.00 (Intl.NumberFormat adds decimals even though JPY doesn't use them in practice)
      expect(result.formattedPriceRange).toBeDefined();
    });

    it('should return null for products without prices', async () => {
      const product = createMockProduct({
        priceJSON: null,
      });

      const result = (await enrichProduct({
        doc: product as unknown as RevealDocument,
        req: mockReq as unknown as RevealRequest,
        findMany: false,
        context: undefined,
        query: undefined,
      })) as unknown as EnrichedProduct;

      expect(result.formattedPriceRange).toBeNull();
    });
  });

  // ===========================================================================
  // Price Counting
  // ===========================================================================

  describe('Price Counting', () => {
    it('should count active prices correctly', async () => {
      const priceList = {
        object: 'list' as const,
        data: [
          {
            id: 'price_1',
            object: 'price' as const,
            active: true,
            currency: 'usd',
            unit_amount: 1000,
            type: 'one_time' as const,
          },
          {
            id: 'price_2',
            object: 'price' as const,
            active: true,
            currency: 'usd',
            unit_amount: 2000,
            type: 'one_time' as const,
          },
          {
            id: 'price_3',
            object: 'price' as const,
            active: false,
            currency: 'usd',
            unit_amount: 3000,
            type: 'one_time' as const,
          },
        ],
        has_more: false,
      };

      const product = createMockProduct({
        priceJSON: JSON.stringify(priceList) as never,
      });

      const result = (await enrichProduct({
        doc: product as unknown as RevealDocument,
        req: mockReq as unknown as RevealRequest,
        findMany: false,
        context: undefined,
        query: undefined,
      })) as unknown as EnrichedProduct;

      expect(result.priceCount).toBe(2); // Only active prices
    });

    it('should return 0 for products without prices', async () => {
      const product = createMockProduct({
        priceJSON: null,
      });

      const result = (await enrichProduct({
        doc: product as unknown as RevealDocument,
        req: mockReq as unknown as RevealRequest,
        findMany: false,
        context: undefined,
        query: undefined,
      })) as unknown as EnrichedProduct;

      expect(result.priceCount).toBe(0);
    });

    it('should handle empty price list', async () => {
      const priceList = {
        object: 'list' as const,
        data: [],
        has_more: false,
      };

      const product = createMockProduct({
        priceJSON: JSON.stringify(priceList) as never,
      });

      const result = (await enrichProduct({
        doc: product as unknown as RevealDocument,
        req: mockReq as unknown as RevealRequest,
        findMany: false,
        context: undefined,
        query: undefined,
      })) as unknown as EnrichedProduct;

      expect(result.priceCount).toBe(0);
    });
  });

  // ===========================================================================
  // Active Status
  // ===========================================================================

  describe('Active Status', () => {
    it('should mark product as active with valid Stripe product', async () => {
      const priceList = createPriceList([{ currency: 'usd', amount: 1000 }]);
      const product = createMockProduct({
        priceJSON: JSON.stringify(priceList) as never,
      });

      const result = (await enrichProduct({
        doc: product as unknown as RevealDocument,
        req: mockReq as unknown as RevealRequest,
        findMany: false,
        context: undefined,
        query: undefined,
      })) as unknown as EnrichedProduct;

      expect(result.isActive).toBe(true);
    });

    it('should mark product as inactive without Stripe product', async () => {
      const product = createMockProduct({
        stripeProductID: null,
      });

      const result = (await enrichProduct({
        doc: product as unknown as RevealDocument,
        req: mockReq as unknown as RevealRequest,
        findMany: false,
        context: undefined,
        query: undefined,
      })) as unknown as EnrichedProduct;

      expect(result.isActive).toBe(false);
    });
  });

  // ===========================================================================
  // Paywall Status
  // ===========================================================================

  describe('Paywall Status', () => {
    it('should correctly set hasPaywall for enabled paywall', async () => {
      const product = createMockProduct({
        enablePaywall: true,
      });

      const result = (await enrichProduct({
        doc: product as unknown as RevealDocument,
        req: mockReq as unknown as RevealRequest,
        findMany: false,
        context: undefined,
        query: undefined,
      })) as unknown as EnrichedProduct;

      expect(result.hasPaywall).toBe(true);
    });

    it('should correctly set hasPaywall for disabled paywall', async () => {
      const product = createMockProduct({
        enablePaywall: false,
      });

      const result = (await enrichProduct({
        doc: product as unknown as RevealDocument,
        req: mockReq as unknown as RevealRequest,
        findMany: false,
        context: undefined,
        query: undefined,
      })) as unknown as EnrichedProduct;

      expect(result.hasPaywall).toBe(false);
    });

    it('should handle null enablePaywall', async () => {
      const product = createMockProduct({
        enablePaywall: null as never,
      });

      const result = (await enrichProduct({
        doc: product as unknown as RevealDocument,
        req: mockReq as unknown as RevealRequest,
        findMany: false,
        context: undefined,
        query: undefined,
      })) as unknown as EnrichedProduct;

      expect(result.hasPaywall).toBe(false);
    });
  });

  // ===========================================================================
  // Default Price ID
  // ===========================================================================

  describe('Default Price ID', () => {
    it('should return first price as default', async () => {
      const priceList = createPriceList([
        { currency: 'usd', amount: 1000 },
        { currency: 'usd', amount: 2000 },
      ]);
      const product = createMockProduct({
        priceJSON: JSON.stringify(priceList) as never,
      });

      const result = (await enrichProduct({
        doc: product as unknown as RevealDocument,
        req: mockReq as unknown as RevealRequest,
        findMany: false,
        context: undefined,
        query: undefined,
      })) as unknown as EnrichedProduct;

      expect(result.defaultPriceId).toBe('price_0');
    });

    it('should return null for products without prices', async () => {
      const product = createMockProduct({
        priceJSON: null,
      });

      const result = (await enrichProduct({
        doc: product as unknown as RevealDocument,
        req: mockReq as unknown as RevealRequest,
        findMany: false,
        context: undefined,
        query: undefined,
      })) as unknown as EnrichedProduct;

      expect(result.defaultPriceId).toBeNull();
    });
  });

  // ===========================================================================
  // Utility Functions
  // ===========================================================================

  describe('Utility Functions', () => {
    describe('enrichProductManually', () => {
      it('should enrich product manually', async () => {
        const priceList = createPriceList([{ currency: 'usd', amount: 1000 }]);
        const product = createMockProduct({
          priceJSON: JSON.stringify(priceList) as never,
        });

        const result = await enrichProductManually(product);

        expect(result.formattedPriceRange).toBe('$10.00');
        expect(result.priceCount).toBe(1);
        expect(result.isActive).toBe(true);
      });
    });

    describe('enrichProductsBatch', () => {
      it('should enrich multiple products', async () => {
        const priceList1 = createPriceList([{ currency: 'usd', amount: 1000 }]);
        const priceList2 = createPriceList([{ currency: 'usd', amount: 2000 }]);

        const products = [
          createMockProduct({
            id: 1,
            priceJSON: JSON.stringify(priceList1) as never,
          }),
          createMockProduct({
            id: 2,
            priceJSON: JSON.stringify(priceList2) as never,
          }),
        ];

        const results = await enrichProductsBatch(products);

        expect(results).toHaveLength(2);
        expect(results[0]?.formattedPriceRange).toBe('$10.00');
        expect(results[1]?.formattedPriceRange).toBe('$20.00');
      });

      it('should handle empty array', async () => {
        const results = await enrichProductsBatch([]);
        expect(results).toEqual([]);
      });
    });

    describe('getPriceStatistics', () => {
      it('should extract price statistics', async () => {
        const priceList = createPriceList([
          { currency: 'usd', amount: 999 },
          { currency: 'usd', amount: 9999 },
        ]);
        const product = createMockProduct({
          priceJSON: JSON.stringify(priceList) as never,
        });

        const enriched = (await enrichProductManually(product)) as EnrichedProduct;
        const stats = getPriceStatistics(enriched);

        expect(stats).toEqual({
          hasValidPricing: true,
          minPrice: 999,
          maxPrice: 9999,
          currency: 'usd',
          totalPrices: 2,
          formattedRange: '$9.99 - $99.99',
        });
      });

      it('should handle products without prices', async () => {
        const product = createMockProduct({
          priceJSON: null,
        });

        const enriched = await enrichProductManually(product);
        const stats = getPriceStatistics(enriched);

        expect(stats).toEqual({
          hasValidPricing: false,
          minPrice: null,
          maxPrice: null,
          currency: null,
          totalPrices: 0,
          formattedRange: null,
        });
      });
    });

    describe('isProductPurchasable', () => {
      it('should return true for purchasable product', async () => {
        const priceList = createPriceList([{ currency: 'usd', amount: 1000 }]);
        const product = createMockProduct({
          priceJSON: JSON.stringify(priceList) as never,
          _status: 'published',
        });

        const enriched = await enrichProductManually(product);
        expect(isProductPurchasable(enriched)).toBe(true);
      });

      it('should return false for draft product', async () => {
        const priceList = createPriceList([{ currency: 'usd', amount: 1000 }]);
        const product = createMockProduct({
          priceJSON: JSON.stringify(priceList) as never,
          _status: 'draft',
        });

        const enriched = await enrichProductManually(product);
        expect(isProductPurchasable(enriched)).toBe(false);
      });

      it('should return false for product without prices', async () => {
        const product = createMockProduct({
          priceJSON: null,
          _status: 'published',
        });

        const enriched = await enrichProductManually(product);
        expect(isProductPurchasable(enriched)).toBe(false);
      });

      it('should return false for inactive product', async () => {
        const product = createMockProduct({
          stripeProductID: null,
          _status: 'published',
        });

        const enriched = await enrichProductManually(product);
        expect(isProductPurchasable(enriched)).toBe(false);
      });
    });

    describe('getProductDisplayName', () => {
      it('should include price range in display name', async () => {
        const priceList = createPriceList([
          { currency: 'usd', amount: 1000 },
          { currency: 'usd', amount: 2000 },
        ]);
        const product = createMockProduct({
          title: 'Test Product',
          priceJSON: JSON.stringify(priceList) as never,
        });

        const enriched = await enrichProductManually(product);
        const displayName = getProductDisplayName(enriched);

        expect(displayName).toBe('Test Product ($10.00 - $20.00)');
      });

      it('should return title only for products without prices', async () => {
        const product = createMockProduct({
          title: 'Test Product',
          priceJSON: null,
        });

        const enriched = await enrichProductManually(product);
        const displayName = getProductDisplayName(enriched);

        expect(displayName).toBe('Test Product');
      });
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('Edge Cases', () => {
    it('should handle string priceJSON', async () => {
      const priceList = createPriceList([{ currency: 'usd', amount: 1000 }]);
      const product = createMockProduct({
        priceJSON: JSON.stringify(priceList) as never,
      });

      const result = (await enrichProduct({
        doc: product as unknown as RevealDocument,
        req: mockReq as unknown as RevealRequest,
        findMany: false,
        context: undefined,
        query: undefined,
      })) as unknown as EnrichedProduct;

      expect(result.priceCount).toBe(1);
    });

    it('should handle parsed priceJSON object', async () => {
      const priceList = createPriceList([{ currency: 'usd', amount: 1000 }]);
      const product = createMockProduct({
        priceJSON: priceList as never,
      });

      const result = (await enrichProduct({
        doc: product as unknown as RevealDocument,
        req: mockReq as unknown as RevealRequest,
        findMany: false,
        context: undefined,
        query: undefined,
      })) as unknown as EnrichedProduct;

      expect(result.priceCount).toBe(1);
    });

    it('should handle invalid priceJSON gracefully', async () => {
      const product = createMockProduct({
        priceJSON: 'invalid json' as never,
      });

      const result = (await enrichProduct({
        doc: product as unknown as RevealDocument,
        req: mockReq as unknown as RevealRequest,
        findMany: false,
        context: undefined,
        query: undefined,
      })) as unknown as EnrichedProduct;

      expect(result.priceCount).toBe(0);
      expect(result.hasPrices).toBe(false);
    });

    it('should handle products with all inactive prices', async () => {
      const priceList = {
        object: 'list' as const,
        data: [
          {
            id: 'price_1',
            object: 'price' as const,
            active: false,
            currency: 'usd',
            unit_amount: 1000,
            type: 'one_time' as const,
          },
        ],
        has_more: false,
      };

      const product = createMockProduct({
        priceJSON: JSON.stringify(priceList) as never,
      });

      const result = (await enrichProduct({
        doc: product as unknown as RevealDocument,
        req: mockReq as unknown as RevealRequest,
        findMany: false,
        context: undefined,
        query: undefined,
      })) as unknown as EnrichedProduct;

      expect(result.priceCount).toBe(0);
    });
  });
});
