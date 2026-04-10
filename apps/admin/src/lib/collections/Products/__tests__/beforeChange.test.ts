/**
 * Products beforeChange Hook Tests
 *
 * Tests validation logic for Stripe product integration including:
 * - Stripe Product ID format validation
 * - Stripe product data fetching and validation
 * - Price list fetching and validation
 * - Business rule enforcement
 * - Error handling
 * - skipSync flag behavior
 */

import type { Product } from '@revealui/core/types/admin';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockRequest } from '@/__tests__/helpers/mockRevealUI';
import { beforeProductChange } from '@/lib/collections/Products/hooks/beforeChange';

// =============================================================================
// Mocks
// =============================================================================

const mockReq = createMockRequest();

// Mock Stripe module
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

describe('Products beforeChange Hook', () => {
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
  // Stripe Product ID Format Validation
  // ===========================================================================

  describe('Stripe Product ID Validation', () => {
    it('should accept valid Stripe product ID format', async () => {
      const product = createMockProduct({
        stripeProductID: 'prod_1234567890123456',
      });

      mockStripeRetrieve.mockResolvedValueOnce(validStripeProduct);
      mockStripePricesList.mockResolvedValueOnce(validPriceList);

      const result = await beforeProductChange({
        req: mockReq,
        data: product,
        operation: 'create',
      });

      expect(result).toBeDefined();
      expect(result.stripeProductID).toBe('prod_1234567890123456');
    });

    it('should reject invalid Stripe product ID format', async () => {
      const product = createMockProduct({
        stripeProductID: 'invalid_id',
      });

      await expect(
        beforeProductChange({
          req: mockReq,
          data: product,
          operation: 'create',
        }),
      ).rejects.toThrow('Invalid Stripe Product ID');
    });

    it('should reject Stripe product ID with wrong prefix', async () => {
      const product = createMockProduct({
        stripeProductID: 'price_1234567890123456',
      });

      await expect(
        beforeProductChange({
          req: mockReq,
          data: product,
          operation: 'create',
        }),
      ).rejects.toThrow('Invalid Stripe Product ID');
    });

    it('should reject Stripe product ID that is too short', async () => {
      const product = createMockProduct({
        stripeProductID: 'prod_123',
      });

      await expect(
        beforeProductChange({
          req: mockReq,
          data: product,
          operation: 'create',
        }),
      ).rejects.toThrow('Invalid Stripe Product ID');
    });
  });

  // ===========================================================================
  // Stripe Product Data Validation
  // ===========================================================================

  describe('Stripe Product Data Validation', () => {
    it('should fetch and validate Stripe product data', async () => {
      const productId = generateUniqueProductId('fetch');
      const product = createMockProduct({ stripeProductID: productId });

      mockStripeRetrieve.mockResolvedValueOnce({ ...validStripeProduct, id: productId });
      mockStripePricesList.mockResolvedValueOnce(validPriceList);

      const result = await beforeProductChange({
        req: mockReq,
        data: product,
        operation: 'create',
      });

      expect(mockStripeRetrieve).toHaveBeenCalledWith(productId);
      expect(result).toBeDefined();
    });

    it('should throw error if Stripe product not found', async () => {
      const productId = generateUniqueProductId('notfound');
      const product = createMockProduct({ stripeProductID: productId });

      mockStripeRetrieve.mockRejectedValueOnce(new Error('Product not found'));

      await expect(
        beforeProductChange({
          req: mockReq,
          data: product,
          operation: 'create',
        }),
      ).rejects.toThrow('Failed to validate Stripe product');
    });

    it('should throw error if Stripe product data is invalid', async () => {
      const productId = generateUniqueProductId('invalid');
      const product = createMockProduct({ stripeProductID: productId });

      mockStripeRetrieve.mockResolvedValueOnce({
        id: productId,
        object: 'invalid',
        // Missing required fields
      });

      await expect(
        beforeProductChange({
          req: mockReq,
          data: product,
          operation: 'create',
        }),
      ).rejects.toThrow('Invalid product data from Stripe');
    });
  });

  // ===========================================================================
  // Price List Validation
  // ===========================================================================

  describe('Price List Validation', () => {
    it('should fetch and store price list', async () => {
      const productId = generateUniqueProductId('fetchlist');
      const product = createMockProduct({ stripeProductID: productId });

      mockStripeRetrieve.mockResolvedValueOnce({ ...validStripeProduct, id: productId });
      mockStripePricesList.mockResolvedValueOnce(validPriceList);

      const result = await beforeProductChange({
        req: mockReq,
        data: product,
        operation: 'create',
      });

      expect(mockStripePricesList).toHaveBeenCalledWith({
        product: productId,
        limit: 100,
      });
      expect(result.priceJSON).toBe(JSON.stringify(validPriceList));
    });

    it('should handle price list fetch failure gracefully', async () => {
      const productId = generateUniqueProductId('pricelistfail');
      const product = createMockProduct({ stripeProductID: productId });

      mockStripeRetrieve.mockResolvedValueOnce({ ...validStripeProduct, id: productId });
      mockStripePricesList.mockRejectedValueOnce(new Error('Price list error'));

      const result = await beforeProductChange({
        req: mockReq,
        data: product,
        operation: 'create',
      });

      // Should not throw, just log error
      expect(result).toBeDefined();
      expect(mockReq.revealui?.logger?.error).toHaveBeenCalled();
    });

    it('should handle invalid price list structure gracefully', async () => {
      const productId = generateUniqueProductId('invalidlist');
      const product = createMockProduct({ stripeProductID: productId });

      mockStripeRetrieve.mockResolvedValueOnce({ ...validStripeProduct, id: productId });
      mockStripePricesList.mockResolvedValueOnce({
        object: 'invalid',
        // Missing required fields
      });

      const result = await beforeProductChange({
        req: mockReq,
        data: product,
        operation: 'create',
      });

      // Should not throw, just log error (products can exist without prices)
      expect(result).toBeDefined();
      expect(mockReq.revealui?.logger?.error).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Business Rules
  // ===========================================================================

  describe('Business Rules', () => {
    it('should allow draft products without Stripe product ID', async () => {
      const product = createMockProduct({
        stripeProductID: null,
        _status: 'draft',
      });

      const result = await beforeProductChange({
        req: mockReq,
        data: product,
        operation: 'create',
      });

      expect(result).toBeDefined();
      expect(result.stripeProductID).toBeNull();
    });

    it('should reject published products without Stripe product ID', async () => {
      const product = createMockProduct({
        stripeProductID: null,
        _status: 'published',
      });

      await expect(
        beforeProductChange({
          req: mockReq,
          data: product,
          operation: 'update',
        }),
      ).rejects.toThrow('Published products must have a valid Stripe Product ID');
    });

    it('should reject published products with inactive Stripe product', async () => {
      const productId = generateUniqueProductId('inactive');
      const product = createMockProduct({
        _status: 'published',
        stripeProductID: productId,
      });

      mockStripeRetrieve.mockResolvedValueOnce({
        ...validStripeProduct,
        id: productId,
        active: false,
      });
      mockStripePricesList.mockResolvedValueOnce(validPriceList);

      await expect(
        beforeProductChange({
          req: mockReq,
          data: product,
          operation: 'update',
        }),
      ).rejects.toThrow('Cannot publish product: Stripe product is not active');
    });

    it('should allow published products with active Stripe product', async () => {
      const product = createMockProduct({
        _status: 'published',
      });

      mockStripeRetrieve.mockResolvedValueOnce(validStripeProduct);
      mockStripePricesList.mockResolvedValueOnce(validPriceList);

      const result = await beforeProductChange({
        req: mockReq,
        data: product,
        operation: 'update',
      });

      expect(result).toBeDefined();
      expect(result._status).toBe('published');
    });
  });

  // ===========================================================================
  // skipSync Flag
  // ===========================================================================

  describe('skipSync Flag', () => {
    it('should skip validation when skipSync is true', async () => {
      const product = createMockProduct({
        skipSync: true,
      });

      const result = await beforeProductChange({
        req: mockReq,
        data: product,
        operation: 'update',
      });

      expect(result).toBeDefined();
      expect(result.skipSync).toBe(false); // Reset to false
      expect(mockStripeRetrieve).not.toHaveBeenCalled();
      expect(mockStripePricesList).not.toHaveBeenCalled();
    });

    it('should reset skipSync to false after skipping', async () => {
      const product = createMockProduct({
        skipSync: true,
      });

      const result = await beforeProductChange({
        req: mockReq,
        data: product,
        operation: 'update',
      });

      expect(result.skipSync).toBe(false);
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe('Error Handling', () => {
    it('should handle Stripe API errors gracefully', async () => {
      const productId = generateUniqueProductId('apierror');
      const product = createMockProduct({ stripeProductID: productId });

      mockStripeRetrieve.mockRejectedValueOnce(new Error('Stripe API Error'));

      await expect(
        beforeProductChange({
          req: mockReq,
          data: product,
          operation: 'create',
        }),
      ).rejects.toThrow('Failed to validate Stripe product');

      expect(mockReq.revealui?.logger?.error).toHaveBeenCalled();
    });

    it('should handle network errors', async () => {
      const productId = generateUniqueProductId('neterror');
      const product = createMockProduct({ stripeProductID: productId });

      mockStripeRetrieve.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        beforeProductChange({
          req: mockReq,
          data: product,
          operation: 'create',
        }),
      ).rejects.toThrow();
    });

    it('should provide descriptive error messages', async () => {
      const product = createMockProduct({
        stripeProductID: 'invalid_format',
      });

      try {
        await beforeProductChange({
          req: mockReq,
          data: product,
          operation: 'create',
        });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Invalid Stripe Product ID');
      }
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('Edge Cases', () => {
    it('should handle products with no categories', async () => {
      const product = createMockProduct({
        categories: null,
      });

      mockStripeRetrieve.mockResolvedValueOnce(validStripeProduct);
      mockStripePricesList.mockResolvedValueOnce(validPriceList);

      const result = await beforeProductChange({
        req: mockReq,
        data: product,
        operation: 'create',
      });

      expect(result).toBeDefined();
      expect(result.categories).toBeNull();
    });

    it('should handle products with no related products', async () => {
      const product = createMockProduct({
        relatedProducts: null,
      });

      mockStripeRetrieve.mockResolvedValueOnce(validStripeProduct);
      mockStripePricesList.mockResolvedValueOnce(validPriceList);

      const result = await beforeProductChange({
        req: mockReq,
        data: product,
        operation: 'create',
      });

      expect(result).toBeDefined();
      expect(result.relatedProducts).toBeNull();
    });

    it('should handle empty price list', async () => {
      const productId = generateUniqueProductId('emptylist');
      const product = createMockProduct({ stripeProductID: productId });

      mockStripeRetrieve.mockResolvedValueOnce({ ...validStripeProduct, id: productId });
      mockStripePricesList.mockResolvedValueOnce({
        object: 'list',
        data: [],
        has_more: false,
      });

      const result = await beforeProductChange({
        req: mockReq,
        data: product,
        operation: 'create',
      });

      expect(result).toBeDefined();
      expect(result.priceJSON).toContain('"data":[]');
    });

    it('should handle price list with multiple currencies', async () => {
      const productId = generateUniqueProductId('multicur');
      const product = createMockProduct({ stripeProductID: productId });

      mockStripeRetrieve.mockResolvedValueOnce({ ...validStripeProduct, id: productId });
      mockStripePricesList.mockResolvedValueOnce({
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
      });

      const result = await beforeProductChange({
        req: mockReq,
        data: product,
        operation: 'create',
      });

      expect(result).toBeDefined();
      const priceJSON = JSON.parse(result.priceJSON || '{}');
      expect(priceJSON.data).toHaveLength(2);
    });

    it('should handle products with recurring prices', async () => {
      const productId = generateUniqueProductId('recurring');
      const product = createMockProduct({ stripeProductID: productId });

      mockStripeRetrieve.mockResolvedValueOnce({ ...validStripeProduct, id: productId });
      mockStripePricesList.mockResolvedValueOnce({
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
      });

      const result = await beforeProductChange({
        req: mockReq,
        data: product,
        operation: 'create',
      });

      expect(result).toBeDefined();
      const priceJSON = JSON.parse(result.priceJSON || '{}');
      expect(priceJSON.data[0].type).toBe('recurring');
    });
  });
});
