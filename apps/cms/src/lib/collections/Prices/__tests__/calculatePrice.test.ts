/**
 * calculatePrice Hook Tests
 *
 * Tests for the calculatePrice afterRead hook including:
 * - Display amount formatting
 * - Formatted price with intervals
 * - Currency handling
 * - Tiered pricing calculations
 * - Active status detection
 * - Edge cases
 */

import type { RevealDocument, RevealRequest } from '@revealui/core';
import type { Price } from '@revealui/core/types/cms';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { calculatePrice, type EnrichedPrice } from '../hooks/calculatePrice';

describe('calculatePrice Hook', () => {
  const mockReq: RevealRequest = {
    revealui: {
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    },
  } as unknown as RevealRequest;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic price formatting', () => {
    it('should format one-time price correctly', async () => {
      const doc: Partial<Price> = {
        id: 1,
        title: 'One-time Product',
        stripePriceID: 'price_1234567890123456',
        priceJSON: JSON.stringify({
          id: 'price_1234567890123456',
          object: 'price',
          active: true,
          currency: 'usd',
          unit_amount: 5000, // $50.00
          type: 'one_time',
        }),
      };

      const result = (await calculatePrice({
        doc: doc as unknown as RevealDocument,
        req: mockReq,
        context: {},
        findMany: false,
        query: undefined,
      })) as unknown as EnrichedPrice;

      expect(result.displayAmount).toBe('$50.00');
      expect(result.formattedPrice).toBe('$50.00 (one-time)');
      expect(result.currency).toBe('USD');
      expect(result.isActive).toBe(true);
      expect(result.interval).toBeNull();
    });

    it('should format monthly recurring price', async () => {
      const doc: Partial<Price> = {
        id: 1,
        title: 'Monthly Subscription',
        stripePriceID: 'price_1234567890123456',
        priceJSON: JSON.stringify({
          id: 'price_1234567890123456',
          object: 'price',
          active: true,
          currency: 'usd',
          unit_amount: 1000, // $10.00
          type: 'recurring',
          recurring: {
            interval: 'month',
            interval_count: 1,
          },
        }),
      };

      const result = (await calculatePrice({
        doc: doc as unknown as RevealDocument,
        req: mockReq,
        context: {},
        findMany: false,
        query: undefined,
      })) as unknown as EnrichedPrice;

      expect(result.displayAmount).toBe('$10.00');
      expect(result.formattedPrice).toBe('$10.00 / monthly');
      expect(result.interval).toBe('monthly');
    });

    it('should format yearly recurring price', async () => {
      const doc: Partial<Price> = {
        id: 1,
        title: 'Annual Subscription',
        stripePriceID: 'price_1234567890123456',
        priceJSON: JSON.stringify({
          id: 'price_1234567890123456',
          object: 'price',
          active: true,
          currency: 'usd',
          unit_amount: 12000, // $120.00
          type: 'recurring',
          recurring: {
            interval: 'year',
            interval_count: 1,
          },
        }),
      };

      const result = (await calculatePrice({
        doc: doc as unknown as RevealDocument,
        req: mockReq,
        context: {},
        findMany: false,
        query: undefined,
      })) as unknown as EnrichedPrice;

      expect(result.displayAmount).toBe('$120.00');
      expect(result.formattedPrice).toBe('$120.00 / yearly');
      expect(result.interval).toBe('yearly');
    });

    it('should format custom interval (every 3 months)', async () => {
      const doc: Partial<Price> = {
        id: 1,
        title: 'Quarterly Subscription',
        stripePriceID: 'price_1234567890123456',
        priceJSON: JSON.stringify({
          id: 'price_1234567890123456',
          object: 'price',
          active: true,
          currency: 'usd',
          unit_amount: 3000,
          type: 'recurring',
          recurring: {
            interval: 'month',
            interval_count: 3,
          },
        }),
      };

      const result = (await calculatePrice({
        doc: doc as unknown as RevealDocument,
        req: mockReq,
        context: {},
        findMany: false,
        query: undefined,
      })) as unknown as EnrichedPrice;

      expect(result.interval).toBe('every 3 months');
      expect(result.formattedPrice).toBe('$30.00 / every 3 months');
    });
  });

  describe('Trial periods', () => {
    it('should include trial period in formatted price', async () => {
      const doc: Partial<Price> = {
        id: 1,
        title: 'Trial Subscription',
        stripePriceID: 'price_1234567890123456',
        priceJSON: JSON.stringify({
          id: 'price_1234567890123456',
          object: 'price',
          active: true,
          currency: 'usd',
          unit_amount: 1000,
          type: 'recurring',
          recurring: {
            interval: 'month',
            interval_count: 1,
            trial_period_days: 7,
          },
        }),
      };

      const result = (await calculatePrice({
        doc: doc as unknown as RevealDocument,
        req: mockReq,
        context: {},
        findMany: false,
        query: undefined,
      })) as unknown as EnrichedPrice;

      expect(result.formattedPrice).toBe('$10.00 / monthly (7-day trial)');
    });

    it('should handle 30-day trial', async () => {
      const doc: Partial<Price> = {
        id: 1,
        title: 'Trial Subscription',
        stripePriceID: 'price_1234567890123456',
        priceJSON: JSON.stringify({
          id: 'price_1234567890123456',
          object: 'price',
          active: true,
          currency: 'usd',
          unit_amount: 2000,
          type: 'recurring',
          recurring: {
            interval: 'month',
            interval_count: 1,
            trial_period_days: 30,
          },
        }),
      };

      const result = (await calculatePrice({
        doc: doc as unknown as RevealDocument,
        req: mockReq,
        context: {},
        findMany: false,
        query: undefined,
      })) as unknown as EnrichedPrice;

      expect(result.formattedPrice).toBe('$20.00 / monthly (30-day trial)');
    });
  });

  describe('Currency handling', () => {
    it('should format EUR currency correctly', async () => {
      const doc: Partial<Price> = {
        id: 1,
        title: 'Euro Price',
        stripePriceID: 'price_1234567890123456',
        priceJSON: JSON.stringify({
          id: 'price_1234567890123456',
          object: 'price',
          active: true,
          currency: 'eur',
          unit_amount: 1000,
          type: 'one_time',
        }),
      };

      const result = (await calculatePrice({
        doc: doc as unknown as RevealDocument,
        req: mockReq,
        context: {},
        findMany: false,
        query: undefined,
      })) as unknown as EnrichedPrice;

      expect(result.currency).toBe('EUR');
      expect(result.displayAmount).toContain('10.00');
    });

    it('should format GBP currency correctly', async () => {
      const doc: Partial<Price> = {
        id: 1,
        title: 'Pound Price',
        stripePriceID: 'price_1234567890123456',
        priceJSON: JSON.stringify({
          id: 'price_1234567890123456',
          object: 'price',
          active: true,
          currency: 'gbp',
          unit_amount: 2500,
          type: 'one_time',
        }),
      };

      const result = (await calculatePrice({
        doc: doc as unknown as RevealDocument,
        req: mockReq,
        context: {},
        findMany: false,
        query: undefined,
      })) as unknown as EnrichedPrice;

      expect(result.currency).toBe('GBP');
      expect(result.displayAmount).toContain('25.00');
    });
  });

  describe('Tiered pricing', () => {
    it('should calculate tier info with range', async () => {
      const doc: Partial<Price> = {
        id: 1,
        title: 'Tiered Price',
        stripePriceID: 'price_1234567890123456',
        priceJSON: JSON.stringify({
          id: 'price_1234567890123456',
          object: 'price',
          active: true,
          currency: 'usd',
          unit_amount: null,
          type: 'recurring',
          recurring: {
            interval: 'month',
            interval_count: 1,
          },
          tiers: [
            { up_to: 10, unit_amount: 1000 }, // $10.00 per unit for first 10
            { up_to: 100, unit_amount: 500 }, // $5.00 per unit for 11-100
            { up_to: 'inf', unit_amount: 100 }, // $1.00 per unit for 101+
          ],
        }),
      };

      const result = (await calculatePrice({
        doc: doc as unknown as RevealDocument,
        req: mockReq,
        context: {},
        findMany: false,
        query: undefined,
      })) as unknown as EnrichedPrice;

      expect(result.tierInfo?.hasTiers).toBe(true);
      expect(result.tierInfo?.tierCount).toBe(3);
      expect(result.tierInfo?.lowestTier).toBe('$10.00');
      expect(result.tierInfo?.highestTier).toBeUndefined(); // Last tier is "inf"
      expect(result.formattedPrice).toContain('$10.00');
      expect(result.formattedPrice).toContain('tiered');
    });

    it('should handle flat amount tiers', async () => {
      const doc: Partial<Price> = {
        id: 1,
        title: 'Flat Tier Price',
        stripePriceID: 'price_1234567890123456',
        priceJSON: JSON.stringify({
          id: 'price_1234567890123456',
          object: 'price',
          active: true,
          currency: 'usd',
          unit_amount: null,
          type: 'one_time',
          tiers: [
            { up_to: 10, flat_amount: 5000 }, // $50.00 flat for 0-10
            { up_to: 'inf', unit_amount: 100 }, // $1.00 per unit after
          ],
        }),
      };

      const result = (await calculatePrice({
        doc: doc as unknown as RevealDocument,
        req: mockReq,
        context: {},
        findMany: false,
        query: undefined,
      })) as unknown as EnrichedPrice;

      expect(result.tierInfo?.hasTiers).toBe(true);
      expect(result.tierInfo?.lowestTier).toBe('$50.00');
    });
  });

  describe('Active status', () => {
    it('should detect inactive prices', async () => {
      const doc: Partial<Price> = {
        id: 1,
        title: 'Inactive Price',
        stripePriceID: 'price_1234567890123456',
        priceJSON: JSON.stringify({
          id: 'price_1234567890123456',
          object: 'price',
          active: false,
          currency: 'usd',
          unit_amount: 1000,
        }),
      };

      const result = (await calculatePrice({
        doc: doc as unknown as RevealDocument,
        req: mockReq,
        context: {},
        findMany: false,
        query: undefined,
      })) as unknown as EnrichedPrice;

      expect(result.isActive).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle prices without Stripe data', async () => {
      const doc: Partial<Price> = {
        id: 1,
        title: 'Draft Price',
        stripePriceID: null,
      };

      const result = await calculatePrice({
        doc: doc as unknown as RevealDocument,
        req: mockReq,
        context: {},
        findMany: false,
        query: undefined,
      });

      expect(result).toEqual(doc);
      expect((result as unknown as EnrichedPrice).displayAmount).toBeUndefined();
    });

    it('should handle invalid JSON in priceJSON', async () => {
      const doc: Partial<Price> = {
        id: 1,
        title: 'Invalid Price',
        stripePriceID: 'price_1234567890123456',
        priceJSON: 'invalid json{',
      };

      const result = await calculatePrice({
        doc: doc as unknown as RevealDocument,
        req: mockReq,
        context: {},
        findMany: false,
        query: undefined,
      });

      expect(result).toEqual(doc);
    });

    it('should handle free (zero amount) prices', async () => {
      const doc: Partial<Price> = {
        id: 1,
        title: 'Free Price',
        stripePriceID: 'price_1234567890123456',
        priceJSON: JSON.stringify({
          id: 'price_1234567890123456',
          object: 'price',
          active: true,
          currency: 'usd',
          unit_amount: 0,
          type: 'one_time',
        }),
      };

      const result = (await calculatePrice({
        doc: doc as unknown as RevealDocument,
        req: mockReq,
        context: {},
        findMany: false,
        query: undefined,
      })) as unknown as EnrichedPrice;

      expect(result.displayAmount).toBe('$0.00');
      expect(result.formattedPrice).toBe('$0.00 (one-time)');
    });

    it('should handle large amounts correctly', async () => {
      const doc: Partial<Price> = {
        id: 1,
        title: 'Expensive Price',
        stripePriceID: 'price_1234567890123456',
        priceJSON: JSON.stringify({
          id: 'price_1234567890123456',
          object: 'price',
          active: true,
          currency: 'usd',
          unit_amount: 999999999, // $9,999,999.99
          type: 'one_time',
        }),
      };

      const result = (await calculatePrice({
        doc: doc as unknown as RevealDocument,
        req: mockReq,
        context: {},
        findMany: false,
        query: undefined,
      })) as unknown as EnrichedPrice;

      expect(result.displayAmount).toContain('9,999,999.99');
    });
  });
});
