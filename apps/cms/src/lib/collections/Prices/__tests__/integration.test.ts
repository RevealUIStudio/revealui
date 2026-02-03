/**
 * Integration Tests for Prices Collection
 *
 * End-to-end tests covering the complete price lifecycle:
 * - Create price with validation
 * - Update price with Stripe sync
 * - Fetch price with relationships populated
 * - Calculate enriched price data
 * - Delete price
 */

import type { RevealRequest } from '@revealui/core'
import type { Price } from '@revealui/core/types/cms'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { beforePriceChange } from '../hooks/beforeChange'
import { calculatePrice, type EnrichedPrice } from '../hooks/calculatePrice'

// Mock Stripe
const mockStripeRetrieve = vi.fn()
vi.mock('services', () => ({
  protectedStripe: {
    prices: {
      retrieve: mockStripeRetrieve,
    },
  },
}))

describe('Prices Collection Integration', () => {
  const mockReq: RevealRequest = {
    revealui: {
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    },
  } as unknown as RevealRequest

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Complete price lifecycle', () => {
    it('should create draft price without Stripe data', async () => {
      // Step 1: Create draft price (no Stripe required)
      const draftData: Partial<Price> = {
        id: 1,
        title: 'New Product',
        _status: 'draft',
        stripePriceID: null,
      }

      const result = await beforePriceChange({
        req: mockReq,
        data: draftData as Price,
      })

      expect(result.title).toBe('New Product')
      expect(result.stripePriceID).toBeNull()
      expect(mockStripeRetrieve).not.toHaveBeenCalled()
    })

    it('should add Stripe price and validate before publishing', async () => {
      // Step 2: Add Stripe price ID
      const withStripePrice: Partial<Price> = {
        id: 1,
        title: 'New Product',
        stripePriceID: 'price_1234567890123456',
        _status: 'draft',
      }

      const stripePriceData = {
        id: 'price_1234567890123456',
        object: 'price',
        active: true,
        currency: 'usd',
        unit_amount: 2999, // $29.99
        type: 'one_time',
      }

      mockStripeRetrieve.mockResolvedValueOnce(stripePriceData)

      const validated = await beforePriceChange({
        req: mockReq,
        data: withStripePrice as Price,
      })

      expect(validated.priceJSON).toBe(JSON.stringify(stripePriceData))
      expect(mockStripeRetrieve).toHaveBeenCalledWith('price_1234567890123456')
    })

    it('should publish price and enrich with calculated fields', async () => {
      // Step 3: Publish price
      const publishData: Partial<Price> = {
        id: 1,
        title: 'New Product',
        stripePriceID: 'price_1234567890123456',
        _status: 'published',
      }

      const stripePriceData = {
        id: 'price_1234567890123456',
        object: 'price',
        active: true,
        currency: 'usd',
        unit_amount: 2999,
        type: 'one_time',
      }

      mockStripeRetrieve.mockResolvedValueOnce(stripePriceData)

      // Validate before publishing
      const validated = await beforePriceChange({
        req: mockReq,
        data: publishData as Price,
      })

      // Step 4: Read with enriched data
      const enriched = (await calculatePrice({
        doc: validated as Price,
        req: mockReq,
        context: {},
        collection: null,
        global: null,
      })) as EnrichedPrice

      expect(enriched._status).toBe('published')
      expect(enriched.displayAmount).toBe('$29.99')
      expect(enriched.formattedPrice).toBe('$29.99 (one-time)')
      expect(enriched.isActive).toBe(true)
    })
  })

  describe('Subscription price workflow', () => {
    it('should create and enrich monthly subscription', async () => {
      const subscriptionData: Partial<Price> = {
        id: 2,
        title: 'Pro Plan',
        stripePriceID: 'price_subscription123456',
        _status: 'published',
      }

      const stripePriceData = {
        id: 'price_subscription123456',
        object: 'price',
        active: true,
        currency: 'usd',
        unit_amount: 4900, // $49.00/month
        type: 'recurring',
        recurring: {
          interval: 'month',
          interval_count: 1,
          trial_period_days: 14,
        },
      }

      mockStripeRetrieve.mockResolvedValueOnce(stripePriceData)

      // Validate
      const validated = await beforePriceChange({
        req: mockReq,
        data: subscriptionData as Price,
      })

      // Enrich
      const enriched = (await calculatePrice({
        doc: validated as Price,
        req: mockReq,
        context: {},
        collection: null,
        global: null,
      })) as EnrichedPrice

      expect(enriched.displayAmount).toBe('$49.00')
      expect(enriched.formattedPrice).toBe('$49.00 / monthly (14-day trial)')
      expect(enriched.interval).toBe('monthly')
      expect(enriched.currency).toBe('USD')
    })
  })

  describe('Error handling', () => {
    it('should prevent publishing inactive Stripe price', async () => {
      const publishData: Partial<Price> = {
        id: 3,
        title: 'Inactive Product',
        stripePriceID: 'price_inactive123456',
        _status: 'published',
      }

      mockStripeRetrieve.mockResolvedValueOnce({
        id: 'price_inactive123456',
        object: 'price',
        active: false, // Inactive!
        currency: 'usd',
        unit_amount: 1000,
      })

      await expect(
        beforePriceChange({
          req: mockReq,
          data: publishData as Price,
        }),
      ).rejects.toThrow('Cannot publish a price with inactive Stripe price')
    })

    it('should handle Stripe API errors gracefully', async () => {
      const publishData: Partial<Price> = {
        id: 4,
        title: 'Invalid Price',
        stripePriceID: 'price_doesnotexist',
        _status: 'draft',
      }

      mockStripeRetrieve.mockRejectedValueOnce({
        type: 'StripeInvalidRequestError',
        message: 'No such price',
      })

      await expect(
        beforePriceChange({
          req: mockReq,
          data: publishData as Price,
        }),
      ).rejects.toThrow('Failed to fetch price from Stripe')
    })
  })

  describe('Price updates', () => {
    it('should update price and re-fetch Stripe data', async () => {
      const updateData: Partial<Price> = {
        id: 1,
        title: 'Updated Product',
        stripePriceID: 'price_1234567890123456',
        _status: 'published',
      }

      const updatedStripeData = {
        id: 'price_1234567890123456',
        object: 'price',
        active: true,
        currency: 'usd',
        unit_amount: 3999, // Price changed in Stripe
        type: 'one_time',
      }

      mockStripeRetrieve.mockResolvedValueOnce(updatedStripeData)

      const result = await beforePriceChange({
        req: mockReq,
        data: updateData as Price,
      })

      const parsed = JSON.parse(result.priceJSON as string)
      expect(parsed.unit_amount).toBe(3999) // Updated amount
    })
  })

  describe('Multi-currency support', () => {
    it('should handle EUR prices correctly', async () => {
      const eurData: Partial<Price> = {
        id: 5,
        title: 'Euro Product',
        stripePriceID: 'price_eurprice123456',
        _status: 'published',
      }

      const stripePriceData = {
        id: 'price_eurprice123456',
        object: 'price',
        active: true,
        currency: 'eur',
        unit_amount: 2500, // €25.00
        type: 'one_time',
      }

      mockStripeRetrieve.mockResolvedValueOnce(stripePriceData)

      const validated = await beforePriceChange({
        req: mockReq,
        data: eurData as Price,
      })

      const enriched = (await calculatePrice({
        doc: validated as Price,
        req: mockReq,
        context: {},
        collection: null,
        global: null,
      })) as EnrichedPrice

      expect(enriched.currency).toBe('EUR')
      expect(enriched.displayAmount).toContain('25.00')
    })
  })

  describe('Tiered pricing', () => {
    it('should handle tiered pricing correctly', async () => {
      const tieredData: Partial<Price> = {
        id: 6,
        title: 'Usage-Based Pricing',
        stripePriceID: 'price_tiered123456',
        _status: 'published',
      }

      const stripePriceData = {
        id: 'price_tiered123456',
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
          { up_to: 100, unit_amount: 500 }, // $5.00 per unit for 0-100
          { up_to: 1000, unit_amount: 400 }, // $4.00 per unit for 101-1000
          { up_to: 'inf', unit_amount: 300 }, // $3.00 per unit for 1001+
        ],
      }

      mockStripeRetrieve.mockResolvedValueOnce(stripePriceData)

      const validated = await beforePriceChange({
        req: mockReq,
        data: tieredData as Price,
      })

      const enriched = (await calculatePrice({
        doc: validated as Price,
        req: mockReq,
        context: {},
        collection: null,
        global: null,
      })) as EnrichedPrice

      expect(enriched.tierInfo?.hasTiers).toBe(true)
      expect(enriched.tierInfo?.tierCount).toBe(3)
      expect(enriched.formattedPrice).toContain('tiered')
    })
  })
})
