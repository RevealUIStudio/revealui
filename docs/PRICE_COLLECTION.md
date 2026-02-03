# Price Collection - Complete Guide

**Status:** ✅ Production Ready
**Version:** 1.0.0
**Last Updated:** February 2, 2026

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Type Safety](#type-safety)
- [Validation](#validation)
- [Business Logic](#business-logic)
- [Relationship Population](#relationship-population)
- [Common Patterns](#common-patterns)
- [Hook Execution Flow](#hook-execution-flow)
- [Stripe Integration](#stripe-integration)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [API Reference](#api-reference)

---

## Overview

The Price collection provides Stripe-backed pricing with full content management capabilities. It combines:

- **Stripe Integration** - Real-time price validation and sync
- **Type Safety** - Runtime + compile-time validation with Zod
- **Business Rules** - Automatic enforcement of pricing policies
- **Relationship Population** - Efficient category and related price loading
- **Computed Fields** - Display-ready price formatting

### Key Features

✅ Stripe Price ID format validation
✅ Business rule enforcement (published prices must be active)
✅ Automatic price data enrichment
✅ Multi-currency support (USD, EUR, GBP, etc.)
✅ Recurring and one-time pricing
✅ Tiered pricing support
✅ Trial period handling
✅ Comprehensive test coverage (90+ tests)

---

## Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Price Collection                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────────────┐                                        │
│  │  Price Schema  │  Type Safety Layer                     │
│  │  (Contract)    │  - Zod validation                      │
│  └────────┬───────┘  - Business rules                      │
│           │                                                 │
│  ┌────────▼────────┐                                       │
│  │ beforeChange    │  Validation Hooks                     │
│  │ Hook            │  - Stripe ID validation               │
│  └────────┬────────┘  - Business rule checks               │
│           │          - Stripe API calls                     │
│           │                                                 │
│  ┌────────▼────────┐                                       │
│  │ Database        │  Storage Layer                        │
│  │ (CMS Generic)   │  - Price metadata                     │
│  └────────┬────────┘  - Stripe price JSON                  │
│           │                                                 │
│  ┌────────▼────────┐                                       │
│  │ afterRead       │  Enrichment Hooks                     │
│  │ Hooks           │  - Calculate display amounts          │
│  └────────┬────────┘  - Format intervals                   │
│           │          - Tiered pricing info                  │
│           │                                                 │
│  ┌────────▼────────┐                                       │
│  │ Populated       │  Response Layer                       │
│  │ Price + Fields  │  - Categories populated               │
│  └─────────────────┘  - Related prices                     │
│                       - Computed display fields             │
└─────────────────────────────────────────────────────────────┘
```

### File Structure

```
apps/cms/src/lib/collections/Prices/
├── index.ts                    # Collection configuration
├── access/
│   └── checkUserPurchases.ts   # Access control
├── hooks/
│   ├── beforeChange.ts         # Validation + Stripe sync
│   ├── calculatePrice.ts       # Price enrichment
│   ├── revalidatePrice.ts      # Cache invalidation
│   └── deletePriceFromCarts.ts # Cleanup on delete
├── examples/
│   └── populate-examples.ts    # Usage patterns
└── __tests__/
    ├── beforeChange.test.ts    # Validation tests
    ├── calculatePrice.test.ts  # Calculation tests
    ├── validation.test.ts      # Contract tests
    └── integration.test.ts     # End-to-end tests

packages/contracts/src/entities/
└── price.ts                    # Price contract + utilities
```

---

## Type Safety

### Price Contract

The Price contract provides runtime + compile-time type safety:

```typescript
import {
  PriceSchema,
  type Price,
  hasStripePrice,
  isPublishedPrice,
} from '@revealui/contracts/entities'

// Validate price data
const validatedPrice = PriceSchema.parse(priceData)

// Type guards
if (hasStripePrice(price)) {
  // price.stripePriceID and price.priceJSON are guaranteed non-null
  console.log(price.stripePriceID) // Type: string
}

if (isPublishedPrice(price)) {
  // Price is published AND has valid Stripe data
  console.log(price._status) // Type: 'published'
}
```

### Type Hierarchy

```typescript
// Base price (from CMS)
type Price = {
  id: number
  title: string
  stripePriceID: string | null
  priceJSON: StripePriceData | null
  _status: 'draft' | 'published'
  // ...
}

// Enriched price (after calculatePrice hook)
type EnrichedPrice = Price & {
  displayAmount?: string        // "$10.00"
  formattedPrice?: string       // "$10.00 / monthly"
  isActive?: boolean
  currency?: string             // "USD"
  interval?: string            // "monthly"
  tierInfo?: TierInfo
}

// With relationships populated
type PriceWithRelated = Price & {
  categories: Category[]
  relatedPrices: Price[]
}
```

---

## Validation

### Stripe Price ID Validation

Format: `price_` + 14-100 alphanumeric characters

```typescript
// ✅ Valid
'price_1MowQVLkdIwHu7ixraBm864M'
'price_abc123XYZ'

// ❌ Invalid
'prod_1234567890123456'  // Wrong prefix
'price_'                 // Too short
'price_abc!@#'          // Invalid characters
```

### Business Rules

**Rule 1: Published prices must have active Stripe price**

```typescript
// ❌ This will fail validation
{
  title: 'Product',
  _status: 'published',
  stripePriceID: null  // Required for published!
}
```

**Rule 2: Price amounts must be positive**

```typescript
// ❌ This will fail validation
{
  stripePriceID: 'price_123',
  _status: 'published',
  priceJSON: {
    unit_amount: -100  // Must be >= 0
  }
}
```

**Rule 3: Stripe price must be active when publishing**

```typescript
// ❌ This will fail validation
{
  stripePriceID: 'price_123',
  _status: 'published',
  priceJSON: {
    active: false  // Must be true for published
  }
}
```

### Validation Flow

```
User submits price
       ↓
beforeChange hook
       ↓
1. Check skipSync flag
       ├─ Yes → Skip validation
       └─ No → Continue
       ↓
2. Validate stripePriceID format
       ├─ Invalid → Throw error
       └─ Valid → Continue
       ↓
3. Fetch from Stripe API
       ├─ Not found → Throw error
       └─ Found → Continue
       ↓
4. Validate business rules
       ├─ Fails → Throw error
       └─ Passes → Continue
       ↓
5. Store validated priceJSON
       ↓
Save to database
```

---

## Business Logic

### Computed Fields

The `calculatePrice` hook enriches prices with display-ready fields:

```typescript
// Input: Basic price
{
  id: 1,
  title: "Pro Plan",
  stripePriceID: "price_123",
  priceJSON: {
    unit_amount: 4900,
    currency: "usd",
    type: "recurring",
    recurring: {
      interval: "month",
      interval_count: 1,
      trial_period_days: 7
    }
  }
}

// Output: Enriched price
{
  // ... all original fields ...
  displayAmount: "$49.00",
  formattedPrice: "$49.00 / monthly (7-day trial)",
  isActive: true,
  currency: "USD",
  interval: "monthly"
}
```

### Tiered Pricing

For usage-based pricing, tier information is automatically calculated:

```typescript
// Input: Tiered price
{
  priceJSON: {
    tiers: [
      { up_to: 100, unit_amount: 1000 },   // $10/unit for 0-100
      { up_to: 1000, unit_amount: 500 },   // $5/unit for 101-1000
      { up_to: "inf", unit_amount: 100 }   // $1/unit for 1001+
    ]
  }
}

// Output: With tier info
{
  tierInfo: {
    hasTiers: true,
    tierCount: 3,
    lowestTier: "$10.00",
    highestTier: "$1.00"
  },
  formattedPrice: "$10.00 - $1.00 / monthly (tiered)"
}
```

---

## Relationship Population

### Automatic Population

Use the `depth` parameter to automatically populate relationships:

```typescript
// Fetch price with categories and related prices
const price = await revealui.findByID({
  collection: 'prices',
  id: priceId,
  depth: 1,  // Populate 1 level deep
})

// Result includes populated relationships
console.log(price.categories)      // Array of Category objects
console.log(price.relatedPrices)   // Array of Price objects
```

### Manual Population

Use `revealui.populate()` for lazy loading:

```typescript
// Fetch without population (fast)
const prices = await revealui.find({
  collection: 'prices',
  depth: 0,
})

// Populate when needed
const firstPrice = await revealui.populate('prices', prices.docs[0], {
  depth: 1,
})
```

### Performance

The collection uses `maxDepth: 1` on `relatedPrices` to prevent deep nesting:

```typescript
{
  name: 'relatedPrices',
  type: 'relationship',
  relationTo: 'prices',
  hasMany: true,
  maxDepth: 1,  // Prevents circular references
}
```

See [examples/populate-examples.ts](../apps/cms/src/lib/collections/Prices/examples/populate-examples.ts) for more patterns.

---

## Common Patterns

### Pattern 1: Create Draft Price

```typescript
const draft = await revealui.create({
  collection: 'prices',
  data: {
    title: 'New Product',
    _status: 'draft',
    // No stripePriceID required for drafts
  },
})
```

### Pattern 2: Add Stripe Price and Publish

```typescript
// Add Stripe price
const withPrice = await revealui.update({
  collection: 'prices',
  id: draft.id,
  data: {
    stripePriceID: 'price_1MowQVLkdIwHu7ixraBm864M',
    // Hook automatically fetches and validates from Stripe
  },
})

// Publish (validation ensures it's active)
const published = await revealui.update({
  collection: 'prices',
  id: draft.id,
  data: {
    _status: 'published',
  },
})
```

### Pattern 3: Display Price in UI

```typescript
// Fetch with enriched data
const price = await revealui.findByID({
  collection: 'prices',
  id: priceId,
  depth: 1,
})

// Use computed fields for display
<div>
  <h3>{price.title}</h3>
  <p>{price.formattedPrice}</p>
  {price.interval && <span>Billed {price.interval}</span>}
  {price.tierInfo?.hasTiers && <span>Usage-based pricing</span>}
</div>
```

### Pattern 4: Generate AI Context

```typescript
import { generatePriceContextForAI } from '@/lib/collections/Prices/examples/populate-examples'

const context = await generatePriceContextForAI(revealui, priceId)

// Use in AI prompt
const response = await ai.generate({
  prompt: `Generate marketing copy for this product:\n\n${context}`,
})
```

---

## Hook Execution Flow

### Create/Update Flow

```
User saves price
       ↓
beforeChange Hook
       ├─ Validate stripePriceID format
       ├─ Fetch from Stripe API
       ├─ Validate business rules
       └─ Store priceJSON
       ↓
Database Write
       ↓
afterChange Hook
       └─ Revalidate cache
       ↓
Price saved
```

### Read Flow

```
User queries price
       ↓
Database Read
       ↓
afterRead Hooks
       ├─ populateArchiveBlock (existing)
       └─ calculatePrice (enrich)
           ├─ Parse priceJSON
           ├─ Calculate display amounts
           ├─ Format intervals
           └─ Calculate tier info
       ↓
Enriched price returned
```

### Delete Flow

```
User deletes price
       ↓
beforeDelete Hook
       (none configured)
       ↓
Database Delete
       ↓
afterDelete Hook
       └─ Remove from carts
       ↓
Price deleted
```

---

## Stripe Integration

### API Calls

The `beforeChange` hook makes Stripe API calls to validate prices:

```typescript
// Cached for 5 minutes
const stripePrice = await stripe.prices.retrieve(stripePriceID)
```

### Response Validation

Stripe responses are validated with `StripePriceDataSchema`:

```typescript
const StripePriceDataSchema = z.object({
  id: z.string(),
  object: z.literal('price'),
  active: z.boolean().optional(),
  currency: z.string().length(3),
  unit_amount: z.number().int().nonnegative().nullable(),
  type: z.enum(['one_time', 'recurring']).optional(),
  recurring: z.object({
    interval: z.enum(['day', 'week', 'month', 'year']),
    interval_count: z.number().int().positive(),
    trial_period_days: z.number().int().nonnegative().optional(),
  }).optional(),
  tiers: z.array(...).optional(),
})
```

### Error Handling

Common Stripe errors are caught and converted to user-friendly messages:

```typescript
// StripeInvalidRequestError
"Failed to fetch price from Stripe: No such price. Please verify the price ID is correct."

// Network errors
"Failed to validate price with Stripe: Network error"

// Validation errors
"Price validation failed: Cannot publish a price with inactive Stripe price"
```

---

## Testing

### Running Tests

```bash
# Run all price tests
pnpm --filter @revealui/cms test Prices

# Run specific test file
pnpm --filter @revealui/cms test beforeChange.test

# Watch mode
pnpm --filter @revealui/cms test --watch Prices
```

### Test Coverage

- **beforeChange.test.ts**: 20+ tests for validation
- **calculatePrice.test.ts**: 25+ tests for calculations
- **validation.test.ts**: 30+ tests for contracts
- **integration.test.ts**: 15+ tests for end-to-end flows

**Total**: 90+ tests, ~1,440 lines of test code

### Mocking Stripe

Tests mock Stripe API responses:

```typescript
import { vi } from 'vitest'

const mockStripeRetrieve = vi.fn()
vi.mock('services', () => ({
  protectedStripe: {
    prices: {
      retrieve: mockStripeRetrieve,
    },
  },
}))

// In tests
mockStripeRetrieve.mockResolvedValueOnce({
  id: 'price_123',
  currency: 'usd',
  unit_amount: 1000,
})
```

---

## Troubleshooting

### Issue: "Invalid Stripe Price ID"

**Cause**: stripePriceID doesn't match format `price_xxxxxxxx`

**Solution**:
```typescript
// ✅ Correct format
stripePriceID: 'price_1MowQVLkdIwHu7ixraBm864M'

// ❌ Wrong - product ID
stripePriceID: 'prod_1MowQVLkdIwHu7ix'
```

### Issue: "Published prices must have a valid Stripe Price ID"

**Cause**: Trying to publish without Stripe price configured

**Solution**:
1. Add valid stripePriceID first
2. Then change status to 'published'

```typescript
// Step 1: Add Stripe price
await revealui.update({
  collection: 'prices',
  id: priceId,
  data: { stripePriceID: 'price_123' },
})

// Step 2: Publish
await revealui.update({
  collection: 'prices',
  id: priceId,
  data: { _status: 'published' },
})
```

### Issue: "Cannot publish a price with inactive Stripe price"

**Cause**: The Stripe price is archived/inactive

**Solution**:
1. Reactivate the price in Stripe Dashboard
2. OR create a new active price and update stripePriceID

### Issue: Relationships not populating

**Cause**: `depth` parameter not set

**Solution**:
```typescript
// ❌ Without depth (no population)
const price = await revealui.findByID({
  collection: 'prices',
  id: priceId,
})

// ✅ With depth (populated)
const price = await revealui.findByID({
  collection: 'prices',
  id: priceId,
  depth: 1,
})
```

### Issue: Computed fields missing

**Cause**: Price doesn't have Stripe data

**Solution**:
The `calculatePrice` hook only runs when `hasStripePrice(price)` returns true. Ensure:
1. `stripePriceID` is set
2. `priceJSON` is valid JSON

---

## API Reference

### Price Type

```typescript
interface Price {
  id: number
  title: string
  publishedOn?: string | null
  stripePriceID?: string | null
  priceJSON?: StripePriceData | null
  enablePaywall?: boolean | null
  categories?: (number | Category)[] | null
  relatedPrices?: (number | Price)[] | null
  _status?: 'draft' | 'published' | null
  updatedAt: string
  createdAt: string
}
```

### EnrichedPrice Type

```typescript
interface EnrichedPrice extends Price {
  displayAmount?: string | null       // "$10.00"
  formattedPrice?: string | null      // "$10.00 / monthly"
  isActive?: boolean                  // true/false
  currency?: string                   // "USD", "EUR", etc.
  interval?: string | null            // "monthly", "yearly"
  tierInfo?: {
    hasTiers: boolean
    tierCount?: number
    lowestTier?: string
    highestTier?: string
  } | null
}
```

### Utility Functions

```typescript
// Type guards
hasStripePrice(price: Price): boolean
isPublishedPrice(price: Price): boolean
isRecurringPrice(price: Price): boolean
isOneTimePrice(price: Price): boolean
hasTieredPricing(price: Price): boolean

// Formatting
formatPriceAmount(amount: number, currency: string): string
getDisplayAmount(price: Price): string | null
getIntervalDescription(price: Price): string | null
```

---

## See Also

- [Populate API Documentation](./POPULATE_API.md)
- [Type System Documentation](./TYPE_SYSTEM.md)
- [Contract System Guide](./CONTRACT_SYSTEM_COMPLETE.md)
- [Stripe API Documentation](https://stripe.com/docs/api/prices)

---

*Last updated: February 2, 2026*
*Implementation: RevealUI CMS v0.1.0*
