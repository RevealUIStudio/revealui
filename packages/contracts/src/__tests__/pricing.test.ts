import { describe, expect, it } from 'vitest'
import {
  CREDIT_BUNDLES,
  FEATURE_LABELS,
  getTierColor,
  getTierLabel,
  getTiersFromCurrent,
  type LicenseTierId,
  PERPETUAL_TIERS,
  SUBSCRIPTION_TIERS,
  TIER_COLORS,
  TIER_LABELS,
  TIER_LIMITS,
} from '../pricing.js'

// =============================================================================
// LicenseTierId coverage
// =============================================================================

describe('LicenseTierId', () => {
  const ALL_TIERS: LicenseTierId[] = ['free', 'pro', 'max', 'enterprise']

  it('TIER_LABELS has entries for all tiers', () => {
    for (const tier of ALL_TIERS) {
      expect(TIER_LABELS[tier]).toBeDefined()
      expect(typeof TIER_LABELS[tier]).toBe('string')
    }
  })

  it('TIER_COLORS has entries for all tiers', () => {
    for (const tier of ALL_TIERS) {
      expect(TIER_COLORS[tier]).toBeDefined()
      expect(TIER_COLORS[tier]).toContain('bg-')
    }
  })

  it('TIER_LIMITS has entries for all tiers', () => {
    for (const tier of ALL_TIERS) {
      const limits = TIER_LIMITS[tier]
      expect(limits).toBeDefined()
      expect(typeof limits.apiRequestsPerMinute).toBe('number')
    }
  })
})

// =============================================================================
// TIER_LIMITS
// =============================================================================

describe('TIER_LIMITS', () => {
  it('free tier has the most restrictive limits', () => {
    expect(TIER_LIMITS.free.sites).toBe(1)
    expect(TIER_LIMITS.free.users).toBe(3)
    expect(TIER_LIMITS.free.apiRequestsPerMinute).toBe(200)
  })

  it('enterprise tier has unlimited sites/users (null)', () => {
    expect(TIER_LIMITS.enterprise.sites).toBeNull()
    expect(TIER_LIMITS.enterprise.users).toBeNull()
    expect(TIER_LIMITS.enterprise.agentTasks).toBeNull()
  })

  it('tiers increase in limits monotonically', () => {
    const order: LicenseTierId[] = ['free', 'pro', 'max']
    for (let i = 0; i < order.length - 1; i++) {
      const current = TIER_LIMITS[order[i]]
      const next = TIER_LIMITS[order[i + 1]]
      expect(next.apiRequestsPerMinute).toBeGreaterThan(current.apiRequestsPerMinute)
      expect(next.sites!).toBeGreaterThan(current.sites!)
      expect(next.users!).toBeGreaterThan(current.users!)
    }
  })
})

// =============================================================================
// SUBSCRIPTION_TIERS
// =============================================================================

describe('SUBSCRIPTION_TIERS', () => {
  it('has 4 tiers', () => {
    expect(SUBSCRIPTION_TIERS).toHaveLength(4)
  })

  it('tier IDs match LicenseTierId values', () => {
    const ids = SUBSCRIPTION_TIERS.map((t) => t.id)
    expect(ids).toEqual(['free', 'pro', 'max', 'enterprise'])
  })

  it('every tier has required fields', () => {
    for (const tier of SUBSCRIPTION_TIERS) {
      expect(tier.name).toBeTruthy()
      expect(tier.price).toBeTruthy()
      expect(tier.description).toBeTruthy()
      expect(tier.features.length).toBeGreaterThan(0)
      expect(tier.cta).toBeTruthy()
      expect(tier.ctaHref).toBeTruthy()
    }
  })

  it('exactly one tier is highlighted (Pro)', () => {
    const highlighted = SUBSCRIPTION_TIERS.filter((t) => t.highlighted)
    expect(highlighted).toHaveLength(1)
    expect(highlighted[0].id).toBe('pro')
  })

  it('free tier has no period', () => {
    const free = SUBSCRIPTION_TIERS.find((t) => t.id === 'free')!
    expect(free.period).toBeUndefined()
  })

  it('paid tiers have /month period', () => {
    const paid = SUBSCRIPTION_TIERS.filter((t) => t.id !== 'free')
    for (const tier of paid) {
      expect(tier.period).toBe('/month')
    }
  })
})

// =============================================================================
// CREDIT_BUNDLES
// =============================================================================

describe('CREDIT_BUNDLES', () => {
  it('has 3 bundles', () => {
    expect(CREDIT_BUNDLES).toHaveLength(3)
  })

  it('exactly one bundle is highlighted', () => {
    const highlighted = CREDIT_BUNDLES.filter((b) => b.highlighted)
    expect(highlighted).toHaveLength(1)
  })

  it('every bundle has required fields', () => {
    for (const bundle of CREDIT_BUNDLES) {
      expect(bundle.name).toBeTruthy()
      expect(bundle.tasks).toBeTruthy()
      expect(bundle.price).toBeTruthy()
      expect(bundle.costPer).toBeTruthy()
    }
  })
})

// =============================================================================
// PERPETUAL_TIERS
// =============================================================================

describe('PERPETUAL_TIERS', () => {
  it('has 3 perpetual tiers', () => {
    expect(PERPETUAL_TIERS).toHaveLength(3)
  })

  it('every tier has required fields', () => {
    for (const tier of PERPETUAL_TIERS) {
      expect(tier.name).toBeTruthy()
      expect(tier.price).toBeTruthy()
      expect(tier.priceNote).toBe('one-time')
      expect(tier.features.length).toBeGreaterThan(0)
    }
  })
})

// =============================================================================
// FEATURE_LABELS
// =============================================================================

describe('FEATURE_LABELS', () => {
  it('has human-readable labels for all feature keys', () => {
    const keys = Object.keys(FEATURE_LABELS)
    expect(keys.length).toBeGreaterThan(10)
    for (const label of Object.values(FEATURE_LABELS)) {
      expect(typeof label).toBe('string')
      expect(label.length).toBeGreaterThan(2)
    }
  })
})

// =============================================================================
// Helper functions
// =============================================================================

describe('getTiersFromCurrent', () => {
  it('returns all paid tiers for free user', () => {
    const tiers = getTiersFromCurrent('free')
    expect(tiers).toHaveLength(3)
    expect(tiers.map((t) => t.id)).toEqual(['pro', 'max', 'enterprise'])
  })

  it('returns max + enterprise for pro user', () => {
    const tiers = getTiersFromCurrent('pro')
    expect(tiers).toHaveLength(2)
    expect(tiers.map((t) => t.id)).toEqual(['max', 'enterprise'])
  })

  it('returns enterprise only for max user', () => {
    const tiers = getTiersFromCurrent('max')
    expect(tiers).toHaveLength(1)
    expect(tiers[0].id).toBe('enterprise')
  })

  it('returns empty for enterprise user', () => {
    const tiers = getTiersFromCurrent('enterprise')
    expect(tiers).toHaveLength(0)
  })
})

describe('getTierLabel', () => {
  it('returns label for each tier', () => {
    expect(getTierLabel('free')).toBe('Free (OSS)')
    expect(getTierLabel('pro')).toBe('Pro')
    expect(getTierLabel('enterprise')).toContain('Enterprise')
  })
})

describe('getTierColor', () => {
  it('returns Tailwind classes for each tier', () => {
    expect(getTierColor('free')).toContain('bg-zinc')
    expect(getTierColor('pro')).toContain('bg-blue')
    expect(getTierColor('enterprise')).toContain('bg-purple')
  })
})
