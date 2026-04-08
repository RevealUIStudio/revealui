/**
 * beforeChange Hook Tests
 *
 * Tests for the beforePriceChange hook including:
 * - Stripe price ID validation
 * - Business rule enforcement
 * - Error handling
 * - Cache behavior
 * - skipSync logic
 */

import type { RevealRequest } from '@revealui/core';
import type { Price } from '@revealui/core/types/cms';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { beforePriceChange } from '../hooks/beforeChange';

// Mock Stripe - using vi.hoisted() to avoid hoisting errors
const { mockStripeRetrieve } = vi.hoisted(() => ({
  mockStripeRetrieve: vi.fn(),
}));

vi.mock('@revealui/services', () => ({
  protectedStripe: {
    prices: {
      retrieve: mockStripeRetrieve,
    },
  },
}));

describe('beforePriceChange Hook', () => {
  // Helper to generate unique price IDs to avoid cache collisions
  let testCounter = 0;
  const generateUniquePriceId = (prefix = 'test') => {
    testCounter++;
    return `price_${prefix}${testCounter.toString().padStart(12, '0')}`;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations to ensure clean state
    mockStripeRetrieve.mockReset();
  });

  const mockReq: RevealRequest = {
    revealui: {
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    },
  } as unknown as RevealRequest;

  describe('skipSync behavior', () => {
    it('should skip validation when skipSync is true', async () => {
      const data: Partial<Price> = {
        id: 1,
        title: 'Test Price',
        skipSync: true,
        stripePriceID: 'price_invalid',
      };

      const result = await beforePriceChange({
        req: mockReq,
        data: data as Price,
        operation: 'create',
      });

      expect(result.skipSync).toBe(false); // Reset to false
      expect(mockStripeRetrieve).not.toHaveBeenCalled();
    });
  });

  describe('Stripe Price ID validation', () => {
    it('should accept valid Stripe price ID format', async () => {
      const validPriceId = 'price_1MowQVLkdIwHu7ixraBm864M';
      const data: Partial<Price> = {
        id: 1,
        title: 'Test Price',
        stripePriceID: validPriceId,
        _status: 'draft',
      };

      mockStripeRetrieve.mockResolvedValueOnce({
        id: validPriceId,
        object: 'price',
        active: true,
        currency: 'usd',
        unit_amount: 1000,
        type: 'one_time',
      });

      const result = await beforePriceChange({
        req: mockReq,
        data: data as Price,
        operation: 'create',
      });

      expect(mockStripeRetrieve).toHaveBeenCalledWith(validPriceId);
      expect(result.priceJSON).toBeDefined();
    });

    it('should reject invalid Stripe price ID format', async () => {
      const data: Partial<Price> = {
        id: 1,
        title: 'Test Price',
        stripePriceID: 'invalid_format',
        _status: 'draft',
      };

      await expect(
        beforePriceChange({
          req: mockReq,
          data: data as Price,
          operation: 'create',
        }),
      ).rejects.toThrow('Invalid Stripe Price ID');

      expect(mockStripeRetrieve).not.toHaveBeenCalled();
    });

    it('should reject price ID without price_ prefix', async () => {
      const data: Partial<Price> = {
        id: 1,
        title: 'Test Price',
        stripePriceID: 'prod_1234567890',
        _status: 'draft',
      };

      await expect(
        beforePriceChange({
          req: mockReq,
          data: data as Price,
          operation: 'create',
        }),
      ).rejects.toThrow('Invalid Stripe Price ID');
    });
  });

  describe('Business rules', () => {
    it('should allow draft prices without stripePriceID', async () => {
      const data: Partial<Price> = {
        id: 1,
        title: 'Draft Price',
        _status: 'draft',
        stripePriceID: null,
      };

      const result = await beforePriceChange({
        req: mockReq,
        data: data as Price,
        operation: 'create',
      });

      expect(result.stripePriceID).toBeNull();
      expect(mockStripeRetrieve).not.toHaveBeenCalled();
    });

    it('should reject published prices without stripePriceID', async () => {
      const data: Partial<Price> = {
        id: 1,
        title: 'Published Price',
        _status: 'published',
        stripePriceID: null,
      };

      await expect(
        beforePriceChange({
          req: mockReq,
          data: data as Price,
          operation: 'create',
        }),
      ).rejects.toThrow('Published prices must have a valid Stripe Price ID');
    });

    it('should reject published prices with inactive Stripe price', async () => {
      const data: Partial<Price> = {
        id: 1,
        title: 'Test Price',
        stripePriceID: 'price_1234567890123456',
        _status: 'published',
      };

      mockStripeRetrieve.mockResolvedValueOnce({
        id: 'price_1234567890123456',
        object: 'price',
        active: false, // Inactive
        currency: 'usd',
        unit_amount: 1000,
      });

      await expect(
        beforePriceChange({
          req: mockReq,
          data: data as Price,
          operation: 'create',
        }),
      ).rejects.toThrow('Cannot publish a price with inactive Stripe price');
    });

    it('should reject published prices with negative amount', async () => {
      const uniquePriceId = `price_negativeamt${Date.now().toString().slice(-10)}`;
      const data: Partial<Price> = {
        id: 1,
        title: 'Test Price',
        stripePriceID: uniquePriceId,
        _status: 'published',
      };

      const mockPrice = {
        id: uniquePriceId,
        object: 'price' as const,
        active: true,
        currency: 'usd',
        unit_amount: -100, // Negative
      };

      mockStripeRetrieve.mockResolvedValueOnce(mockPrice);

      await expect(
        beforePriceChange({
          req: mockReq,
          data: data as Price,
          operation: 'create',
        }),
      ).rejects.toThrow('Failed to validate price with Stripe');
    });

    it('should reject published prices without unit_amount', async () => {
      const priceId = generateUniquePriceId('noamount');
      const data: Partial<Price> = {
        id: 1,
        title: 'Test Price',
        stripePriceID: priceId,
        _status: 'published',
      };

      mockStripeRetrieve.mockResolvedValueOnce({
        id: priceId,
        object: 'price',
        active: true,
        currency: 'usd',
        unit_amount: null, // No amount
      });

      await expect(
        beforePriceChange({
          req: mockReq,
          data: data as Price,
          operation: 'create',
        }),
      ).rejects.toThrow('Cannot publish a price without a unit amount');
    });
  });

  describe('Stripe API integration', () => {
    it('should fetch and store Stripe price data', async () => {
      const priceId = generateUniquePriceId('fetchstore');
      const data: Partial<Price> = {
        id: 1,
        title: 'Test Price',
        stripePriceID: priceId,
        _status: 'draft',
      };

      const stripePriceData = {
        id: priceId,
        object: 'price',
        active: true,
        currency: 'usd',
        unit_amount: 1000,
        type: 'one_time',
        metadata: { key: 'value' },
      };

      mockStripeRetrieve.mockResolvedValueOnce(stripePriceData);

      const result = await beforePriceChange({
        req: mockReq,
        data: data as Price,
        operation: 'create',
      });

      expect(result.priceJSON).toBe(JSON.stringify(stripePriceData));
      expect(mockStripeRetrieve).toHaveBeenCalledWith(priceId);
    });

    it('should handle Stripe API errors gracefully', async () => {
      const priceId = generateUniquePriceId('apierror');
      const data: Partial<Price> = {
        id: 1,
        title: 'Test Price',
        stripePriceID: priceId,
        _status: 'draft',
      };

      mockStripeRetrieve.mockRejectedValueOnce({
        type: 'StripeInvalidRequestError',
        message: `No such price: ${priceId}`,
      });

      await expect(
        beforePriceChange({
          req: mockReq,
          data: data as Price,
          operation: 'create',
        }),
      ).rejects.toThrow('Failed to fetch price from Stripe');
    });

    it('should handle network errors', async () => {
      const priceId = generateUniquePriceId('neterror');
      const data: Partial<Price> = {
        id: 1,
        title: 'Test Price',
        stripePriceID: priceId,
        _status: 'draft',
      };

      mockStripeRetrieve.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        beforePriceChange({
          req: mockReq,
          data: data as Price,
          operation: 'create',
        }),
      ).rejects.toThrow('Failed to validate price with Stripe');
    });
  });

  describe('Recurring prices', () => {
    it('should accept valid recurring price', async () => {
      const priceId = generateUniquePriceId('recurring');
      const data: Partial<Price> = {
        id: 1,
        title: 'Subscription',
        stripePriceID: priceId,
        _status: 'published',
      };

      mockStripeRetrieve.mockResolvedValueOnce({
        id: priceId,
        object: 'price',
        active: true,
        currency: 'usd',
        unit_amount: 1000,
        type: 'recurring',
        recurring: {
          interval: 'month',
          interval_count: 1,
        },
      });

      const result = await beforePriceChange({
        req: mockReq,
        data: data as Price,
        operation: 'create',
      });

      const priceData = JSON.parse(result.priceJSON as string);
      expect(priceData.type).toBe('recurring');
      expect(priceData.recurring.interval).toBe('month');
    });
  });

  describe('Price ID mismatch', () => {
    it('should reject when Stripe returns different price ID', async () => {
      const priceId = generateUniquePriceId('mismatch');
      const data: Partial<Price> = {
        id: 1,
        title: 'Test Price',
        stripePriceID: priceId,
        _status: 'draft',
      };

      mockStripeRetrieve.mockResolvedValueOnce({
        id: generateUniquePriceId('different'), // Mismatch
        object: 'price',
        active: true,
        currency: 'usd',
        unit_amount: 1000,
      });

      await expect(
        beforePriceChange({
          req: mockReq,
          data: data as Price,
          operation: 'create',
        }),
      ).rejects.toThrow('Stripe price ID mismatch');
    });
  });

  describe('Edge cases', () => {
    it('should handle zero amount prices', async () => {
      const data: Partial<Price> = {
        id: 1,
        title: 'Free Price',
        stripePriceID: 'price_1234567890123456',
        _status: 'draft',
      };

      mockStripeRetrieve.mockResolvedValueOnce({
        id: 'price_1234567890123456',
        object: 'price',
        active: true,
        currency: 'usd',
        unit_amount: 0, // Free
      });

      const result = await beforePriceChange({
        req: mockReq,
        data: data as Price,
        operation: 'create',
      });

      expect(result.priceJSON).toBeDefined();
    });

    it('should handle very long price IDs', async () => {
      const longPriceId = `price_${'a'.repeat(90)}`; // 96 chars total
      const data: Partial<Price> = {
        id: 1,
        title: 'Test Price',
        stripePriceID: longPriceId,
        _status: 'draft',
      };

      mockStripeRetrieve.mockResolvedValueOnce({
        id: longPriceId,
        object: 'price',
        active: true,
        currency: 'usd',
        unit_amount: 1000,
      });

      const result = await beforePriceChange({
        req: mockReq,
        data: data as Price,
        operation: 'create',
      });

      expect(result.priceJSON).toBeDefined();
    });
  });
});
