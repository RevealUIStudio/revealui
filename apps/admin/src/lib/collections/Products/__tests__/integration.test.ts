/**
 * Product Integration Tests
 *
 * Tests the complete product lifecycle including:
 * - Product creation with validation
 * - Publishing workflow
 * - Enrichment pipeline
 * - Relationship population
 * - Multi-currency scenarios
 * - Error recovery
 */

import type { RevealDocument } from '@revealui/core';
import type { Product } from '@revealui/core/types/admin';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockRequest } from '@/__tests__/helpers/mockRevealUI';
import { beforeProductChange } from '@/lib/collections/Products/hooks/beforeChange';
import {
  type EnrichedProduct,
  enrichProduct,
} from '@/lib/collections/Products/hooks/enrichProduct';

// =============================================================================
// Mocks
// =============================================================================

const mockReq = createMockRequest();

const mockStripeRetrieve = vi.fn();
const mockStripePricesList = vi.fn();

vi.mock('@revealui/services', () => ({
  protectedStripe: {
    products: {
      retrieve: (...args: unknown[]) => mockStripeRetrieve(...args),
    },
    prices: {
      list: (...args: unknown[]) => mockStripePricesList(...args),
    },
  },
}));

// =============================================================================
// Test Data
// =============================================================================

const validStripeProduct = {
  id: 'prod_1234567890123456',
  object: 'product' as const,
  active: true,
  name: 'Test Product',
  description: 'Test product description',
  metadata: {},
  images: [],
  default_price: 'price_1234567890123456',
};

const validPriceList = {
  object: 'list' as const,
  data: [
    {
      id: 'price_1234567890123456',
      object: 'price' as const,
      active: true,
      currency: 'usd',
      unit_amount: 1000,
      type: 'one_time' as const,
    },
  ],
  has_more: false,
};

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

// =============================================================================
// Tests
// =============================================================================

describe('Product Integration Tests', () => {
  // Helper to generate unique product IDs to avoid cache collisions
  let testCounter = 0;
  const generateUniqueProductId = (prefix = 'test') => {
    testCounter++;
    return `prod_${prefix}${testCounter.toString().padStart(12, '0')}`;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations to ensure clean state
    mockStripeRetrieve.mockReset();
    mockStripePricesList.mockReset();
    // Set default mock returns
    mockStripeRetrieve.mockResolvedValue(validStripeProduct);
    mockStripePricesList.mockResolvedValue(validPriceList);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Create and Publish Workflow
  // ===========================================================================

  describe('Create and Publish Workflow', () => {
    it('should create draft product without Stripe product', async () => {
      const product = createMockProduct({
        stripeProductID: null,
        _status: 'draft',
      });

      const validated = await beforeProductChange({
        req: mockReq,
        data: product,
        operation: 'create',
      });

      expect(validated).toBeDefined();
      expect(validated.stripeProductID).toBeNull();
      expect(mockStripeRetrieve).not.toHaveBeenCalled();
    });

    it('should validate and fetch data when Stripe product is added', async () => {
      const product = createMockProduct();

      mockStripeRetrieve.mockResolvedValueOnce(validStripeProduct);
      mockStripePricesList.mockResolvedValueOnce(validPriceList);

      const validated = await beforeProductChange({
        req: mockReq,
        data: product,
        operation: 'update',
      });

      expect(validated).toBeDefined();
      expect(validated.priceJSON).toBeDefined();
      expect(mockStripeRetrieve).toHaveBeenCalledWith('prod_1234567890123456');
      expect(mockStripePricesList).toHaveBeenCalled();
    });

    it('should enrich product after validation', async () => {
      const product = createMockProduct();

      mockStripeRetrieve.mockResolvedValueOnce(validStripeProduct);
      mockStripePricesList.mockResolvedValueOnce(validPriceList);

      const validated = await beforeProductChange({
        req: mockReq,
        data: product,
        operation: 'update',
      });

      const enriched = (await enrichProduct({
        doc: validated as unknown as RevealDocument,
        req: mockReq,
        findMany: false,
        context: undefined,
        query: undefined,
      })) as unknown as EnrichedProduct;

      expect(enriched.formattedPriceRange).toBe('$10.00');
      expect(enriched.priceCount).toBe(1);
      expect(enriched.isActive).toBe(true);
    });

    it('should complete full create → validate → enrich → publish flow', async () => {
      // Step 1: Create draft
      const draftProduct = createMockProduct({
        stripeProductID: null,
        _status: 'draft',
      });

      const draft = await beforeProductChange({
        req: mockReq,
        data: draftProduct,
        operation: 'create',
      });

      expect(draft._status).toBe('draft');
      expect(draft.stripeProductID).toBeNull();

      // Step 2: Add Stripe product
      mockStripeRetrieve.mockResolvedValueOnce(validStripeProduct);
      mockStripePricesList.mockResolvedValueOnce(validPriceList);

      const withStripe = await beforeProductChange({
        req: mockReq,
        data: {
          ...draft,
          stripeProductID: 'prod_1234567890123456',
        },
        operation: 'update',
      });

      expect(withStripe.stripeProductID).toBe('prod_1234567890123456');
      expect(withStripe.priceJSON).toBeDefined();

      // Step 3: Publish
      mockStripeRetrieve.mockResolvedValueOnce(validStripeProduct);
      mockStripePricesList.mockResolvedValueOnce(validPriceList);

      const published = await beforeProductChange({
        req: mockReq,
        data: {
          ...withStripe,
          _status: 'published',
        },
        operation: 'update',
      });

      expect(published._status).toBe('published');

      // Step 4: Enrich
      const enriched = (await enrichProduct({
        doc: published as unknown as RevealDocument,
        req: mockReq,
        findMany: false,
        context: undefined,
        query: undefined,
      })) as unknown as EnrichedProduct;

      expect(enriched.isActive).toBe(true);
      expect(enriched.formattedPriceRange).toBeDefined();
    });
  });

  // ===========================================================================
  // Multi-Currency Scenarios
  // ===========================================================================

  describe('Multi-Currency Scenarios', () => {
    it('should handle products with multiple currencies', async () => {
      const productId = generateUniqueProductId('multicurrency');
      const multiCurrencyPrices = {
        object: 'list' as const,
        data: [
          {
            id: 'price_usd',
            object: 'price' as const,
            active: true,
            currency: 'usd',
            unit_amount: 1000,
            type: 'one_time' as const,
          },
          {
            id: 'price_eur',
            object: 'price' as const,
            active: true,
            currency: 'eur',
            unit_amount: 900,
            type: 'one_time' as const,
          },
          {
            id: 'price_gbp',
            object: 'price' as const,
            active: true,
            currency: 'gbp',
            unit_amount: 800,
            type: 'one_time' as const,
          },
        ],
        has_more: false,
      };

      const product = createMockProduct({ stripeProductID: productId });

      mockStripeRetrieve.mockResolvedValueOnce({ ...validStripeProduct, id: productId });
      mockStripePricesList.mockResolvedValueOnce(multiCurrencyPrices);

      const validated = await beforeProductChange({
        req: mockReq,
        data: product,
        operation: 'create',
      });

      const enriched = (await enrichProduct({
        doc: validated as unknown as RevealDocument,
        req: mockReq,
        findMany: false,
        context: undefined,
        query: undefined,
      })) as unknown as EnrichedProduct;

      expect(enriched.priceCount).toBe(3);
      expect(enriched.priceRange?.currency).toBe('usd'); // First currency
    });

    it('should format prices from first currency in list', async () => {
      const productId = generateUniqueProductId('firstcur');
      const multiCurrencyPrices = {
        object: 'list' as const,
        data: [
          {
            id: 'price_usd',
            object: 'price' as const,
            active: true,
            currency: 'usd',
            unit_amount: 1999,
            type: 'one_time' as const,
          },
          {
            id: 'price_eur',
            object: 'price' as const,
            active: true,
            currency: 'eur',
            unit_amount: 1799,
            type: 'one_time' as const,
          },
        ],
        has_more: false,
      };

      const product = createMockProduct({ stripeProductID: productId });

      mockStripeRetrieve.mockResolvedValueOnce({ ...validStripeProduct, id: productId });
      mockStripePricesList.mockResolvedValueOnce(multiCurrencyPrices);

      const validated = await beforeProductChange({
        req: mockReq,
        data: product,
        operation: 'create',
      });

      const enriched = (await enrichProduct({
        doc: validated as unknown as RevealDocument,
        req: mockReq,
        findMany: false,
        context: undefined,
        query: undefined,
      })) as unknown as EnrichedProduct;

      expect(enriched.formattedPriceRange).toContain('19.99');
    });
  });

  // ===========================================================================
  // Recurring vs One-time Prices
  // ===========================================================================

  describe('Recurring vs One-time Prices', () => {
    it('should handle products with recurring prices', async () => {
      const recurringPrices = {
        object: 'list' as const,
        data: [
          {
            id: 'price_monthly',
            object: 'price' as const,
            active: true,
            currency: 'usd',
            unit_amount: 1000,
            type: 'recurring' as const,
            recurring: {
              interval: 'month' as const,
              interval_count: 1,
            },
          },
          {
            id: 'price_yearly',
            object: 'price' as const,
            active: true,
            currency: 'usd',
            unit_amount: 10000,
            type: 'recurring' as const,
            recurring: {
              interval: 'year' as const,
              interval_count: 1,
            },
          },
        ],
        has_more: false,
      };

      const productId = generateUniqueProductId('recurring');
      const product = createMockProduct({ stripeProductID: productId });

      mockStripeRetrieve.mockResolvedValueOnce({ ...validStripeProduct, id: productId });
      mockStripePricesList.mockResolvedValueOnce(recurringPrices);

      const validated = await beforeProductChange({
        req: mockReq,
        data: product,
        operation: 'create',
      });

      const enriched = (await enrichProduct({
        doc: validated as unknown as RevealDocument,
        req: mockReq,
        findMany: false,
        context: undefined,
        query: undefined,
      })) as unknown as EnrichedProduct;

      expect(enriched.priceCount).toBe(2);
      expect(enriched.formattedPriceRange).toBe('$10.00 - $100.00');
    });

    it('should handle mixed one-time and recurring prices', async () => {
      const productId2 = generateUniqueProductId('mixed');
      const mixedPrices = {
        object: 'list' as const,
        data: [
          {
            id: 'price_onetime',
            object: 'price' as const,
            active: true,
            currency: 'usd',
            unit_amount: 5000,
            type: 'one_time' as const,
          },
          {
            id: 'price_monthly',
            object: 'price' as const,
            active: true,
            currency: 'usd',
            unit_amount: 1000,
            type: 'recurring' as const,
            recurring: {
              interval: 'month' as const,
              interval_count: 1,
            },
          },
        ],
        has_more: false,
      };

      const product = createMockProduct({ stripeProductID: productId2 });

      mockStripeRetrieve.mockResolvedValueOnce({ ...validStripeProduct, id: productId2 });
      mockStripePricesList.mockResolvedValueOnce(mixedPrices);

      const validated = await beforeProductChange({
        req: mockReq,
        data: product,
        operation: 'create',
      });

      const enriched = (await enrichProduct({
        doc: validated as unknown as RevealDocument,
        req: mockReq,
        findMany: false,
        context: undefined,
        query: undefined,
      })) as unknown as EnrichedProduct;

      expect(enriched.priceCount).toBe(2);
      expect(enriched.priceRange?.min).toBe(1000);
      expect(enriched.priceRange?.max).toBe(5000);
    });
  });

  // ===========================================================================
  // Relationship Handling
  // ===========================================================================

  describe('Relationship Handling', () => {
    it('should preserve categories during validation', async () => {
      const product = createMockProduct({
        categories: [1, 2, 3],
      });

      mockStripeRetrieve.mockResolvedValueOnce(validStripeProduct);
      mockStripePricesList.mockResolvedValueOnce(validPriceList);

      const validated = await beforeProductChange({
        req: mockReq,
        data: product,
        operation: 'create',
      });

      expect(validated.categories).toEqual([1, 2, 3]);
    });

    it('should preserve related products during validation', async () => {
      const product = createMockProduct({
        relatedProducts: [10, 20],
      });

      mockStripeRetrieve.mockResolvedValueOnce(validStripeProduct);
      mockStripePricesList.mockResolvedValueOnce(validPriceList);

      const validated = await beforeProductChange({
        req: mockReq,
        data: product,
        operation: 'create',
      });

      expect(validated.relatedProducts).toEqual([10, 20]);
    });

    it('should handle populated relationships', async () => {
      const product = createMockProduct({
        categories: [
          { id: 1, name: 'Category 1' },
          { id: 2, name: 'Category 2' },
        ] as never,
      });

      mockStripeRetrieve.mockResolvedValueOnce(validStripeProduct);
      mockStripePricesList.mockResolvedValueOnce(validPriceList);

      const validated = await beforeProductChange({
        req: mockReq,
        data: product,
        operation: 'create',
      });

      expect(validated.categories).toHaveLength(2);
    });
  });

  // ===========================================================================
  // Paywall Scenarios
  // ===========================================================================

  describe('Paywall Scenarios', () => {
    it('should handle products with paywall enabled', async () => {
      const product = createMockProduct({
        enablePaywall: true,
      });

      mockStripeRetrieve.mockResolvedValueOnce(validStripeProduct);
      mockStripePricesList.mockResolvedValueOnce(validPriceList);

      const validated = await beforeProductChange({
        req: mockReq,
        data: product,
        operation: 'create',
      });

      const enriched = (await enrichProduct({
        doc: validated as unknown as RevealDocument,
        req: mockReq,
        findMany: false,
        context: undefined,
        query: undefined,
      })) as unknown as EnrichedProduct;

      expect(enriched.hasPaywall).toBe(true);
    });

    it('should handle products with paywall disabled', async () => {
      const product = createMockProduct({
        enablePaywall: false,
      });

      mockStripeRetrieve.mockResolvedValueOnce(validStripeProduct);
      mockStripePricesList.mockResolvedValueOnce(validPriceList);

      const validated = await beforeProductChange({
        req: mockReq,
        data: product,
        operation: 'create',
      });

      const enriched = (await enrichProduct({
        doc: validated as unknown as RevealDocument,
        req: mockReq,
        findMany: false,
        context: undefined,
        query: undefined,
      })) as unknown as EnrichedProduct;

      expect(enriched.hasPaywall).toBe(false);
    });
  });

  // ===========================================================================
  // Error Recovery
  // ===========================================================================

  describe('Error Recovery', () => {
    it('should handle Stripe product fetch failure', async () => {
      const productId = generateUniqueProductId('fetchfail');
      const product = createMockProduct({ stripeProductID: productId });

      mockStripeRetrieve.mockRejectedValueOnce(new Error('Stripe API error'));

      await expect(
        beforeProductChange({
          req: mockReq,
          data: product,
          operation: 'create',
        }),
      ).rejects.toThrow('Failed to validate Stripe product');
    });

    it('should handle price list fetch failure gracefully', async () => {
      const productId = generateUniqueProductId('listfail');
      const product = createMockProduct({ stripeProductID: productId });

      mockStripeRetrieve.mockResolvedValueOnce({ ...validStripeProduct, id: productId });
      mockStripePricesList.mockRejectedValueOnce(new Error('Price list error'));

      const validated = await beforeProductChange({
        req: mockReq,
        data: product,
        operation: 'create',
      });

      // Should not throw, product should still be created
      expect(validated).toBeDefined();
      expect(mockReq.revealui?.logger?.error).toHaveBeenCalled();
    });

    it('should enrich products even if priceJSON is missing', async () => {
      const product = createMockProduct({
        priceJSON: null,
      });

      const enriched = (await enrichProduct({
        doc: product as unknown as RevealDocument,
        req: mockReq,
        findMany: false,
        context: undefined,
        query: undefined,
      })) as unknown as EnrichedProduct;

      expect(enriched.priceCount).toBe(0);
      expect(enriched.formattedPriceRange).toBeNull();
      expect(enriched.isActive).toBe(true); // Still has Stripe product ID
    });

    it('should handle invalid priceJSON during enrichment', async () => {
      const product = createMockProduct({
        priceJSON: 'invalid json' as never,
      });

      const enriched = (await enrichProduct({
        doc: product as unknown as RevealDocument,
        req: mockReq,
        findMany: false,
        context: undefined,
        query: undefined,
      })) as unknown as EnrichedProduct;

      expect(enriched.priceCount).toBe(0);
      expect(enriched.hasPrices).toBe(false);
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('Edge Cases', () => {
    it('should handle products with no active prices', async () => {
      const productId = generateUniqueProductId('noactive');
      const inactivePrices = {
        object: 'list' as const,
        data: [
          {
            id: 'price_inactive',
            object: 'price' as const,
            active: false,
            currency: 'usd',
            unit_amount: 1000,
            type: 'one_time' as const,
          },
        ],
        has_more: false,
      };

      const product = createMockProduct({ stripeProductID: productId });

      mockStripeRetrieve.mockResolvedValueOnce({ ...validStripeProduct, id: productId });
      mockStripePricesList.mockResolvedValueOnce(inactivePrices);

      const validated = await beforeProductChange({
        req: mockReq,
        data: product,
        operation: 'create',
      });

      const enriched = (await enrichProduct({
        doc: validated as unknown as RevealDocument,
        req: mockReq,
        findMany: false,
        context: undefined,
        query: undefined,
      })) as unknown as EnrichedProduct;

      expect(enriched.priceCount).toBe(0);
      expect(enriched.formattedPriceRange).toBeNull();
    });

    it('should handle products with empty price list', async () => {
      const productId = generateUniqueProductId('emptylist');
      const emptyPrices = {
        object: 'list' as const,
        data: [],
        has_more: false,
      };

      const product = createMockProduct({ stripeProductID: productId });

      mockStripeRetrieve.mockResolvedValueOnce({ ...validStripeProduct, id: productId });
      mockStripePricesList.mockResolvedValueOnce(emptyPrices);

      const validated = await beforeProductChange({
        req: mockReq,
        data: product,
        operation: 'create',
      });

      const enriched = (await enrichProduct({
        doc: validated as unknown as RevealDocument,
        req: mockReq,
        findMany: false,
        context: undefined,
        query: undefined,
      })) as unknown as EnrichedProduct;

      expect(enriched.priceCount).toBe(0);
      expect(enriched.defaultPriceId).toBeNull();
    });

    it('should handle products with null unit_amount prices', async () => {
      const productId = generateUniqueProductId('nullamt');
      const nullAmountPrices = {
        object: 'list' as const,
        data: [
          {
            id: 'price_null',
            object: 'price' as const,
            active: true,
            currency: 'usd',
            unit_amount: null,
            type: 'one_time' as const,
          },
        ],
        has_more: false,
      };

      const product = createMockProduct({ stripeProductID: productId });

      mockStripeRetrieve.mockResolvedValueOnce({ ...validStripeProduct, id: productId });
      mockStripePricesList.mockResolvedValueOnce(nullAmountPrices);

      const validated = await beforeProductChange({
        req: mockReq,
        data: product,
        operation: 'create',
      });

      const enriched = (await enrichProduct({
        doc: validated as unknown as RevealDocument,
        req: mockReq,
        findMany: false,
        context: undefined,
        query: undefined,
      })) as unknown as EnrichedProduct;

      expect(enriched.priceRange).toBeNull();
      expect(enriched.formattedPriceRange).toBeNull();
    });

    it('should handle very large price lists', async () => {
      const productId = generateUniqueProductId('largelist');
      const largePriceList = {
        object: 'list' as const,
        data: Array.from({ length: 100 }, (_, i) => ({
          id: `price_${i}`,
          object: 'price' as const,
          active: true,
          currency: 'usd',
          unit_amount: 1000 + i * 100,
          type: 'one_time' as const,
        })),
        has_more: false,
      };

      const product = createMockProduct({ stripeProductID: productId });

      mockStripeRetrieve.mockResolvedValueOnce({ ...validStripeProduct, id: productId });
      mockStripePricesList.mockResolvedValueOnce(largePriceList);

      const validated = await beforeProductChange({
        req: mockReq,
        data: product,
        operation: 'create',
      });

      const enriched = (await enrichProduct({
        doc: validated as unknown as RevealDocument,
        req: mockReq,
        findMany: false,
        context: undefined,
        query: undefined,
      })) as unknown as EnrichedProduct;

      expect(enriched.priceCount).toBe(100);
      expect(enriched.priceRange?.min).toBe(1000);
      expect(enriched.priceRange?.max).toBe(10900);
    });
  });
});
