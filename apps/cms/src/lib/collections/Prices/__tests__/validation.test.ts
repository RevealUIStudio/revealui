/**
 * Price Contract Validation Tests
 *
 * Tests for the Price contract schema validation including:
 * - Stripe Price ID format validation
 * - Business rule enforcement
 * - Type guards
 * - Formatting utilities
 */

import {
  formatPriceAmount,
  getDisplayAmount,
  getIntervalDescription,
  hasStripePrice,
  hasTieredPricing,
  isOneTimePrice,
  isPublishedPrice,
  isRecurringPrice,
  type Price,
  PriceSchema,
  StripePriceDataSchema,
  StripePriceIDSchema,
} from '@revealui/contracts/entities';
import { describe, expect, it } from 'vitest';

describe('Price Contract Validation', () => {
  describe('StripePriceIDSchema', () => {
    it('should accept valid Stripe price IDs', () => {
      const validIds = [
        'price_1234567890123456',
        'price_abcdefghijklmnop',
        'price_1MowQVLkdIwHu7ixraBm864M',
        'price_ABC123xyz',
      ];

      for (const id of validIds) {
        expect(() => StripePriceIDSchema.parse(id)).not.toThrow();
      }
    });

    it('should reject invalid formats', () => {
      const invalidIds = [
        'prod_1234567890123456', // Wrong prefix
        'price_', // Too short
        'price', // No underscore
        'invalid', // Wrong format
        'price_abc!@#', // Invalid characters (if strict)
        '', // Empty string
      ];

      for (const id of invalidIds) {
        expect(() => StripePriceIDSchema.parse(id)).toThrow();
      }
    });
  });

  describe('StripePriceDataSchema', () => {
    it('should validate complete one-time price', () => {
      const priceData = {
        id: 'price_1234567890123456',
        object: 'price' as const,
        active: true,
        currency: 'usd',
        unit_amount: 1000,
        type: 'one_time' as const,
      };

      expect(() => StripePriceDataSchema.parse(priceData)).not.toThrow();
    });

    it('should validate recurring price with interval', () => {
      const priceData = {
        id: 'price_1234567890123456',
        object: 'price' as const,
        active: true,
        currency: 'usd',
        unit_amount: 1000,
        type: 'recurring' as const,
        recurring: {
          interval: 'month' as const,
          interval_count: 1,
        },
      };

      expect(() => StripePriceDataSchema.parse(priceData)).not.toThrow();
    });

    it('should validate tiered pricing', () => {
      const priceData = {
        id: 'price_1234567890123456',
        object: 'price' as const,
        active: true,
        currency: 'usd',
        unit_amount: null,
        tiers: [
          { up_to: 10, unit_amount: 1000 },
          { up_to: 'inf' as const, unit_amount: 500 },
        ],
      };

      expect(() => StripePriceDataSchema.parse(priceData)).not.toThrow();
    });

    it('should reject invalid currency codes', () => {
      const priceData = {
        id: 'price_1234567890123456',
        object: 'price' as const,
        currency: 'invalid', // Not 3 chars
        unit_amount: 1000,
      };

      expect(() => StripePriceDataSchema.parse(priceData)).toThrow();
    });

    it('should reject negative amounts', () => {
      const priceData = {
        id: 'price_1234567890123456',
        object: 'price' as const,
        currency: 'usd',
        unit_amount: -100, // Negative
      };

      expect(() => StripePriceDataSchema.parse(priceData)).toThrow();
    });
  });

  describe('PriceSchema business rules', () => {
    it('should enforce published prices have stripePriceID', () => {
      const invalidPrice = {
        id: 1,
        title: 'Test Price',
        _status: 'published',
        stripePriceID: null, // Required for published
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      expect(() => PriceSchema.parse(invalidPrice)).toThrow(
        'Published prices must have a valid Stripe Price ID',
      );
    });

    it('should allow draft prices without stripePriceID', () => {
      const validPrice = {
        id: 1,
        title: 'Draft Price',
        _status: 'draft',
        stripePriceID: null,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      expect(() => PriceSchema.parse(validPrice)).not.toThrow();
    });

    it('should validate priceJSON matches stripePriceID', () => {
      const invalidPrice = {
        id: 1,
        title: 'Test Price',
        stripePriceID: 'price_1234567890123456',
        priceJSON: JSON.stringify({
          id: 'price_DIFFERENT', // Mismatch
          object: 'price' as const,
          currency: 'usd',
          unit_amount: 1000,
        }),
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      expect(() => PriceSchema.parse(invalidPrice)).toThrow(
        'Price JSON must match the configured Stripe Price ID',
      );
    });
  });

  describe('Type guards', () => {
    describe('hasStripePrice', () => {
      it('should return true for prices with valid Stripe data', () => {
        const price = {
          id: 1,
          title: 'Test',
          stripePriceID: 'price_1234567890123456',
          priceJSON: {
            id: 'price_1234567890123456',
            object: 'price',
            currency: 'usd',
            unit_amount: 1000,
          },
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        } as Price;

        expect(hasStripePrice(price)).toBe(true);
      });

      it('should return false for prices without stripePriceID', () => {
        const price = {
          id: 1,
          title: 'Test',
          stripePriceID: null,
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        } as Price;

        expect(hasStripePrice(price)).toBe(false);
      });
    });

    describe('isPublishedPrice', () => {
      it('should return true for published prices with Stripe data', () => {
        const price = {
          id: 1,
          title: 'Test',
          _status: 'published',
          stripePriceID: 'price_1234567890123456',
          priceJSON: {
            id: 'price_1234567890123456',
            object: 'price',
            currency: 'usd',
            unit_amount: 1000,
          },
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        } as Price;

        expect(isPublishedPrice(price)).toBe(true);
      });

      it('should return false for draft prices', () => {
        const price = {
          id: 1,
          title: 'Test',
          _status: 'draft',
          stripePriceID: 'price_1234567890123456',
          priceJSON: {
            id: 'price_1234567890123456',
            object: 'price',
            currency: 'usd',
            unit_amount: 1000,
          },
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        } as Price;

        expect(isPublishedPrice(price)).toBe(false);
      });
    });

    describe('isRecurringPrice', () => {
      it('should return true for recurring prices', () => {
        const price = {
          id: 1,
          title: 'Test',
          stripePriceID: 'price_1234567890123456',
          priceJSON: {
            id: 'price_1234567890123456',
            object: 'price',
            currency: 'usd',
            unit_amount: 1000,
            type: 'recurring',
          },
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        } as Price;

        expect(isRecurringPrice(price)).toBe(true);
      });

      it('should return false for one-time prices', () => {
        const price = {
          id: 1,
          title: 'Test',
          stripePriceID: 'price_1234567890123456',
          priceJSON: {
            id: 'price_1234567890123456',
            object: 'price',
            currency: 'usd',
            unit_amount: 1000,
            type: 'one_time',
          },
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        } as Price;

        expect(isRecurringPrice(price)).toBe(false);
      });
    });

    describe('isOneTimePrice', () => {
      it('should return true for one-time prices', () => {
        const price = {
          id: 1,
          title: 'Test',
          stripePriceID: 'price_1234567890123456',
          priceJSON: {
            id: 'price_1234567890123456',
            object: 'price',
            currency: 'usd',
            unit_amount: 1000,
            type: 'one_time',
          },
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        } as Price;

        expect(isOneTimePrice(price)).toBe(true);
      });
    });

    describe('hasTieredPricing', () => {
      it('should return true for tiered prices', () => {
        const price = {
          id: 1,
          title: 'Test',
          stripePriceID: 'price_1234567890123456',
          priceJSON: {
            id: 'price_1234567890123456',
            object: 'price',
            currency: 'usd',
            unit_amount: null,
            tiers: [{ up_to: 10, unit_amount: 1000 }],
          },
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        } as Price;

        expect(hasTieredPricing(price)).toBe(true);
      });

      it('should return false for standard prices', () => {
        const price = {
          id: 1,
          title: 'Test',
          stripePriceID: 'price_1234567890123456',
          priceJSON: {
            id: 'price_1234567890123456',
            object: 'price',
            currency: 'usd',
            unit_amount: 1000,
          },
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        } as Price;

        expect(hasTieredPricing(price)).toBe(false);
      });
    });
  });

  describe('Formatting utilities', () => {
    describe('formatPriceAmount', () => {
      it('should format USD correctly', () => {
        expect(formatPriceAmount(1000, 'usd')).toBe('$10.00');
        expect(formatPriceAmount(5000, 'usd')).toBe('$50.00');
        expect(formatPriceAmount(99, 'usd')).toBe('$0.99');
      });

      it('should format EUR correctly', () => {
        const formatted = formatPriceAmount(1000, 'eur');
        expect(formatted).toContain('10.00');
      });

      it('should handle zero amounts', () => {
        expect(formatPriceAmount(0, 'usd')).toBe('$0.00');
      });

      it('should handle large amounts', () => {
        const formatted = formatPriceAmount(1234567890, 'usd');
        expect(formatted).toContain('12,345,678.90');
      });
    });

    describe('getDisplayAmount', () => {
      it('should return formatted amount for valid price', () => {
        const price = {
          id: 1,
          title: 'Test',
          stripePriceID: 'price_1234567890123456',
          priceJSON: {
            id: 'price_1234567890123456',
            object: 'price',
            currency: 'usd',
            unit_amount: 1000,
          },
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        } as Price;

        expect(getDisplayAmount(price)).toBe('$10.00');
      });

      it('should return null for prices without Stripe data', () => {
        const price = {
          id: 1,
          title: 'Test',
          stripePriceID: null,
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        } as Price;

        expect(getDisplayAmount(price)).toBeNull();
      });
    });

    describe('getIntervalDescription', () => {
      it('should return interval for monthly prices', () => {
        const price = {
          id: 1,
          title: 'Test',
          stripePriceID: 'price_1234567890123456',
          priceJSON: {
            id: 'price_1234567890123456',
            object: 'price',
            currency: 'usd',
            unit_amount: 1000,
            type: 'recurring',
            recurring: {
              interval: 'month',
              interval_count: 1,
            },
          },
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        } as Price;

        expect(getIntervalDescription(price)).toBe('monthly');
      });

      it('should return null for one-time prices', () => {
        const price = {
          id: 1,
          title: 'Test',
          stripePriceID: 'price_1234567890123456',
          priceJSON: {
            id: 'price_1234567890123456',
            object: 'price',
            currency: 'usd',
            unit_amount: 1000,
            type: 'one_time',
          },
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        } as Price;

        expect(getIntervalDescription(price)).toBeNull();
      });

      it('should handle custom intervals', () => {
        const price = {
          id: 1,
          title: 'Test',
          stripePriceID: 'price_1234567890123456',
          priceJSON: {
            id: 'price_1234567890123456',
            object: 'price',
            currency: 'usd',
            unit_amount: 1000,
            type: 'recurring',
            recurring: {
              interval: 'month',
              interval_count: 3,
            },
          },
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        } as Price;

        expect(getIntervalDescription(price)).toBe('every 3 months');
      });
    });
  });
});
