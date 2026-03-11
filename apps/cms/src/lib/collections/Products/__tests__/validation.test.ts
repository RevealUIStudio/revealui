/**
 * Product Contract Validation Tests
 *
 * Tests Zod schema validation for Product entity including:
 * - Stripe Product ID format validation
 * - Stripe product data validation
 * - Price list validation
 * - Business rule validation
 * - Type guards
 * - Utility functions
 */

import {
  CreateProductInputSchema,
  formatPriceRange,
  getAvailablePrices,
  getDefaultPriceId,
  getPriceCount,
  getPriceRange,
  hasProductImages,
  hasProductPrices,
  hasStripeProduct,
  isPublishedProduct,
  ProductSchema,
  type StripePriceList,
  StripePriceListSchema,
  StripeProductDataSchema,
  StripeProductIDSchema,
  UpdateProductInputSchema,
} from '@revealui/contracts/entities';
import { describe, expect, it } from 'vitest';

// =============================================================================
// Test Data
// =============================================================================

const validProduct = {
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
};

const validPriceList: StripePriceList = {
  object: 'list',
  data: [
    {
      id: 'price_1234567890123456',
      object: 'price',
      active: true,
      currency: 'usd',
      unit_amount: 1000,
      type: 'one_time',
    },
  ],
  has_more: false,
};

// =============================================================================
// Tests
// =============================================================================

describe('Product Contract Validation', () => {
  // ===========================================================================
  // Stripe Product ID Schema
  // ===========================================================================

  describe('StripeProductIDSchema', () => {
    it('should accept valid Stripe product ID', () => {
      const result = StripeProductIDSchema.safeParse('prod_1234567890123456');
      expect(result.success).toBe(true);
    });

    it('should accept long Stripe product IDs', () => {
      const longId = `prod_${'a'.repeat(90)}`;
      const result = StripeProductIDSchema.safeParse(longId);
      expect(result.success).toBe(true);
    });

    it('should reject product ID without prod_ prefix', () => {
      const result = StripeProductIDSchema.safeParse('1234567890123456');
      expect(result.success).toBe(false);
    });

    it('should reject product ID with wrong prefix', () => {
      const result = StripeProductIDSchema.safeParse('price_1234567890123456');
      expect(result.success).toBe(false);
    });

    it('should reject product ID that is too short', () => {
      const result = StripeProductIDSchema.safeParse('prod_123');
      expect(result.success).toBe(false);
    });

    it('should reject product ID that is too long', () => {
      const tooLong = `prod_${'a'.repeat(100)}`;
      const result = StripeProductIDSchema.safeParse(tooLong);
      expect(result.success).toBe(false);
    });

    it('should reject product ID with special characters', () => {
      const result = StripeProductIDSchema.safeParse('prod_123-456!789');
      expect(result.success).toBe(false);
    });

    it('should reject product ID with spaces', () => {
      const result = StripeProductIDSchema.safeParse('prod_123 456 789');
      expect(result.success).toBe(false);
    });
  });

  // ===========================================================================
  // Stripe Product Data Schema
  // ===========================================================================

  describe('StripeProductDataSchema', () => {
    it('should accept valid Stripe product data', () => {
      const data = {
        id: 'prod_1234567890123456',
        object: 'product',
        active: true,
        name: 'Test Product',
        description: 'Test description',
        metadata: { key: 'value' },
        images: ['https://example.com/image.png'],
        features: [{ name: 'Feature 1' }],
        default_price: 'price_1234567890123456',
        shippable: false,
        url: 'https://example.com/product',
      };

      const result = StripeProductDataSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should accept minimal Stripe product data', () => {
      const data = {
        id: 'prod_1234567890123456',
        object: 'product',
        active: true,
        name: 'Test Product',
      };

      const result = StripeProductDataSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject data with wrong object type', () => {
      const data = {
        id: 'prod_1234567890123456',
        object: 'price',
        active: true,
        name: 'Test Product',
      };

      const result = StripeProductDataSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject data missing required fields', () => {
      const data = {
        id: 'prod_1234567890123456',
        object: 'product',
        // Missing active and name
      };

      const result = StripeProductDataSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should accept null description', () => {
      const data = {
        id: 'prod_1234567890123456',
        object: 'product',
        active: true,
        name: 'Test Product',
        description: null,
      };

      const result = StripeProductDataSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should accept null default_price', () => {
      const data = {
        id: 'prod_1234567890123456',
        object: 'product',
        active: true,
        name: 'Test Product',
        default_price: null,
      };

      const result = StripeProductDataSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  // ===========================================================================
  // Stripe Price List Schema
  // ===========================================================================

  describe('StripePriceListSchema', () => {
    it('should accept valid price list', () => {
      const result = StripePriceListSchema.safeParse(validPriceList);
      expect(result.success).toBe(true);
    });

    it('should accept price list with recurring prices', () => {
      const priceList = {
        object: 'list',
        data: [
          {
            id: 'price_recurring',
            object: 'price',
            active: true,
            currency: 'usd',
            unit_amount: 1000,
            type: 'recurring',
            recurring: {
              interval: 'month',
              interval_count: 1,
            },
          },
        ],
        has_more: false,
      };

      const result = StripePriceListSchema.safeParse(priceList);
      expect(result.success).toBe(true);
    });

    it('should accept empty price list', () => {
      const priceList = {
        object: 'list',
        data: [],
        has_more: false,
      };

      const result = StripePriceListSchema.safeParse(priceList);
      expect(result.success).toBe(true);
    });

    it('should reject price list with wrong object type', () => {
      const priceList = {
        object: 'product',
        data: [],
        has_more: false,
      };

      const result = StripePriceListSchema.safeParse(priceList);
      expect(result.success).toBe(false);
    });

    it('should accept price list with multiple currencies', () => {
      const priceList = {
        object: 'list',
        data: [
          {
            id: 'price_usd',
            object: 'price',
            active: true,
            currency: 'usd',
            unit_amount: 1000,
            type: 'one_time',
          },
          {
            id: 'price_eur',
            object: 'price',
            active: true,
            currency: 'eur',
            unit_amount: 900,
            type: 'one_time',
          },
        ],
        has_more: false,
      };

      const result = StripePriceListSchema.safeParse(priceList);
      expect(result.success).toBe(true);
    });

    it('should reject price with invalid currency code', () => {
      const priceList = {
        object: 'list',
        data: [
          {
            id: 'price_invalid',
            object: 'price',
            active: true,
            currency: 'invalid',
            unit_amount: 1000,
            type: 'one_time',
          },
        ],
        has_more: false,
      };

      const result = StripePriceListSchema.safeParse(priceList);
      expect(result.success).toBe(false);
    });

    it('should reject price with negative amount', () => {
      const priceList = {
        object: 'list',
        data: [
          {
            id: 'price_negative',
            object: 'price',
            active: true,
            currency: 'usd',
            unit_amount: -1000,
            type: 'one_time',
          },
        ],
        has_more: false,
      };

      const result = StripePriceListSchema.safeParse(priceList);
      expect(result.success).toBe(false);
    });
  });

  // ===========================================================================
  // Product Schema
  // ===========================================================================

  describe('ProductSchema', () => {
    it('should accept valid product', () => {
      const result = ProductSchema.safeParse(validProduct);
      if (!result.success) {
        console.error('Validation errors:', JSON.stringify(result.error.issues, null, 2));
      }
      expect(result.success).toBe(true);
    });

    it('should accept product with populated categories', () => {
      const product = {
        ...validProduct,
        categories: [1, 2, 3],
      };

      const result = ProductSchema.safeParse(product);
      expect(result.success).toBe(true);
    });

    it('should accept product with populated relationships', () => {
      const product = {
        ...validProduct,
        categories: [{ id: 1, name: 'Category 1' }],
        relatedProducts: [{ id: 2, title: 'Related Product' }],
      };

      const result = ProductSchema.safeParse(product);
      expect(result.success).toBe(true);
    });

    it('should accept product with priceJSON string', () => {
      const product = {
        ...validProduct,
        priceJSON: JSON.stringify(validPriceList),
      };

      const result = ProductSchema.safeParse(product);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.priceJSON).toEqual(validPriceList);
      }
    });

    it('should transform priceJSON string to object', () => {
      const product = {
        ...validProduct,
        priceJSON: JSON.stringify(validPriceList),
      };

      const result = ProductSchema.safeParse(product);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.data.priceJSON).toBe('object');
      }
    });

    it('should handle invalid priceJSON gracefully', () => {
      const product = {
        ...validProduct,
        priceJSON: 'invalid json',
      };

      const result = ProductSchema.safeParse(product);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.priceJSON).toBeNull();
      }
    });

    it('should reject published product without Stripe product ID', () => {
      const product = {
        ...validProduct,
        stripeProductID: null,
        _status: 'published',
      };

      const result = ProductSchema.safeParse(product);
      expect(result.success).toBe(false);
    });

    it('should accept draft product without Stripe product ID', () => {
      const product = {
        ...validProduct,
        stripeProductID: null,
        _status: 'draft',
      };

      const result = ProductSchema.safeParse(product);
      expect(result.success).toBe(true);
    });
  });

  // ===========================================================================
  // Create/Update Input Schemas
  // ===========================================================================

  describe('CreateProductInputSchema', () => {
    it('should accept valid create input', () => {
      const input = {
        title: 'New Product',
        stripeProductID: 'prod_1234567890123456',
        enablePaywall: true,
        categories: [1, 2],
        relatedProducts: [3, 4],
        _status: 'draft',
      };

      const result = CreateProductInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept minimal create input', () => {
      const input = {
        title: 'New Product',
      };

      const result = CreateProductInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject create input without title', () => {
      const input = {
        stripeProductID: 'prod_1234567890123456',
      };

      const result = CreateProductInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject create input with invalid Stripe product ID', () => {
      const input = {
        title: 'New Product',
        stripeProductID: 'invalid_id',
      };

      const result = CreateProductInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('UpdateProductInputSchema', () => {
    it('should accept partial update input', () => {
      const input = {
        title: 'Updated Title',
      };

      const result = UpdateProductInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept empty update input', () => {
      const input = {};

      const result = UpdateProductInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept update with Stripe product ID', () => {
      const input = {
        stripeProductID: 'prod_1234567890123456',
      };

      const result = UpdateProductInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject update with invalid Stripe product ID', () => {
      const input = {
        stripeProductID: 'invalid_id',
      };

      const result = UpdateProductInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  // ===========================================================================
  // Type Guards
  // ===========================================================================

  describe('Type Guards', () => {
    describe('hasStripeProduct', () => {
      it('should return true for product with Stripe product ID', () => {
        const product = validProduct;
        expect(hasStripeProduct(product as never)).toBe(true);
      });

      it('should return false for product without Stripe product ID', () => {
        const product = { ...validProduct, stripeProductID: null };
        expect(hasStripeProduct(product as never)).toBe(false);
      });
    });

    describe('isPublishedProduct', () => {
      it('should return true for published product with Stripe product', () => {
        const product = {
          ...validProduct,
          _status: 'published',
        };
        expect(isPublishedProduct(product as never)).toBe(true);
      });

      it('should return false for published product without Stripe product', () => {
        const product = {
          ...validProduct,
          stripeProductID: null,
          _status: 'published',
        };
        expect(isPublishedProduct(product as never)).toBe(false);
      });

      it('should return false for draft product', () => {
        const product = {
          ...validProduct,
          _status: 'draft',
        };
        expect(isPublishedProduct(product as never)).toBe(false);
      });
    });

    describe('hasProductPrices', () => {
      it('should return true for product with valid priceJSON', () => {
        const product = {
          ...validProduct,
          priceJSON: validPriceList,
        };
        expect(hasProductPrices(product as never)).toBe(true);
      });

      it('should return false for product without priceJSON', () => {
        const product = {
          ...validProduct,
          priceJSON: null,
        };
        expect(hasProductPrices(product as never)).toBe(false);
      });
    });

    describe('hasProductImages', () => {
      it('should return false (placeholder implementation)', () => {
        const product = validProduct;
        expect(hasProductImages(product as never)).toBe(false);
      });
    });
  });

  // ===========================================================================
  // Utility Functions
  // ===========================================================================

  describe('Utility Functions', () => {
    describe('getAvailablePrices', () => {
      it('should return active prices', () => {
        const product = {
          ...validProduct,
          priceJSON: {
            object: 'list' as const,
            data: [
              {
                id: 'price_active',
                object: 'price' as const,
                active: true,
                currency: 'usd',
                unit_amount: 1000,
                type: 'one_time' as const,
              },
              {
                id: 'price_inactive',
                object: 'price' as const,
                active: false,
                currency: 'usd',
                unit_amount: 2000,
                type: 'one_time' as const,
              },
            ],
            has_more: false,
          },
        };

        const prices = getAvailablePrices(product as never);
        expect(prices).toHaveLength(1);
        expect(prices[0]?.id).toBe('price_active');
      });

      it('should return empty array for product without prices', () => {
        const product = {
          ...validProduct,
          priceJSON: null,
        };

        const prices = getAvailablePrices(product as never);
        expect(prices).toEqual([]);
      });
    });

    describe('getPriceCount', () => {
      it('should count active prices', () => {
        const product = {
          ...validProduct,
          priceJSON: {
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
            ],
            has_more: false,
          },
        };

        expect(getPriceCount(product as never)).toBe(2);
      });

      it('should return 0 for product without prices', () => {
        const product = {
          ...validProduct,
          priceJSON: null,
        };

        expect(getPriceCount(product as never)).toBe(0);
      });
    });

    describe('getPriceRange', () => {
      it('should calculate price range', () => {
        const product = {
          ...validProduct,
          priceJSON: {
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
            ],
            has_more: false,
          },
        };

        const range = getPriceRange(product as never);
        expect(range).toEqual({
          min: 1000,
          max: 2000,
          currency: 'usd',
        });
      });

      it('should return null for product without prices', () => {
        const product = {
          ...validProduct,
          priceJSON: null,
        };

        expect(getPriceRange(product as never)).toBeNull();
      });
    });

    describe('getDefaultPriceId', () => {
      it('should return first price ID', () => {
        const product = {
          ...validProduct,
          priceJSON: validPriceList,
        };

        expect(getDefaultPriceId(product as never)).toBe('price_1234567890123456');
      });

      it('should return null for product without prices', () => {
        const product = {
          ...validProduct,
          priceJSON: null,
        };

        expect(getDefaultPriceId(product as never)).toBeNull();
      });
    });

    describe('formatPriceRange', () => {
      it('should format single price', () => {
        const product = {
          ...validProduct,
          priceJSON: {
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
            ],
            has_more: false,
          },
        };

        expect(formatPriceRange(product as never)).toBe('$10.00');
      });

      it('should format price range', () => {
        const product = {
          ...validProduct,
          priceJSON: {
            object: 'list' as const,
            data: [
              {
                id: 'price_1',
                object: 'price' as const,
                active: true,
                currency: 'usd',
                unit_amount: 999,
                type: 'one_time' as const,
              },
              {
                id: 'price_2',
                object: 'price' as const,
                active: true,
                currency: 'usd',
                unit_amount: 9999,
                type: 'one_time' as const,
              },
            ],
            has_more: false,
          },
        };

        expect(formatPriceRange(product as never)).toBe('$9.99 - $99.99');
      });

      it('should return null for product without prices', () => {
        const product = {
          ...validProduct,
          priceJSON: null,
        };

        expect(formatPriceRange(product as never)).toBeNull();
      });
    });
  });
});
