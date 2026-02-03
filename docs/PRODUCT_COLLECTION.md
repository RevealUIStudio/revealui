# Products Collection Documentation

Complete guide for the RevealUI Products collection including Stripe integration, validation, business logic, and population strategies.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Type Safety](#type-safety)
4. [Validation](#validation)
5. [Business Logic](#business-logic)
6. [Relationship Population](#relationship-population)
7. [Common Patterns](#common-patterns)
8. [Hooks Reference](#hooks-reference)
9. [Stripe Integration](#stripe-integration)
10. [Testing](#testing)
11. [Troubleshooting](#troubleshooting)
12. [API Reference](#api-reference)

---

## Overview

The Products collection manages Stripe-backed products with content management capabilities. Each product represents a purchasable item with:

- **Stripe Integration** - Links to Stripe products (prod_xxx)
- **Price Management** - Associates multiple prices (one-time, recurring, multi-currency)
- **Content Blocks** - Flexible layout system for product pages
- **Paywall Support** - Gated content for product owners
- **Relationships** - Categories and related products
- **Type Safety** - Runtime (Zod) + compile-time (TypeScript) validation

### Key Features

- ✅ **Stripe Product Validation** - Format validation (prod_xxx) with Stripe API verification
- ✅ **Automatic Price Sync** - Fetches and stores price lists from Stripe
- ✅ **Business Rules** - Published products require valid active Stripe products
- ✅ **Computed Fields** - Price ranges, formatting, counts via enrichment hook
- ✅ **Type Safety** - Zod schemas + TypeScript types
- ✅ **Relationship Population** - Auto-populate categories and related products
- ✅ **Comprehensive Tests** - 170+ tests covering all scenarios

---

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────┐
│   USER INPUT                                │
│   Create/Update Product                     │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│   BEFORE CHANGE HOOK                        │
│   1. Validate Stripe Product ID format      │
│   2. Fetch Stripe product data              │
│   3. Fetch associated price list            │
│   4. Validate business rules                │
│   5. Store price list JSON                  │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│   DATABASE                                  │
│   Store validated product                   │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│   AFTER READ HOOK                           │
│   1. Parse price list JSON                  │
│   2. Calculate price range                  │
│   3. Format display prices                  │
│   4. Add computed fields                    │
│   5. Populate relationships (if depth > 0)  │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│   ENRICHED PRODUCT                          │
│   - formattedPriceRange: "$9.99 - $99.99"  │
│   - priceCount: 3                           │
│   - isActive: true                          │
│   - hasPaywall: false                       │
│   - populated relationships                 │
└─────────────────────────────────────────────┘
```

### Package Structure

```
packages/
├── contracts/
│   └── src/
│       └── entities/
│           └── product.ts          # Zod schemas, types, contracts
│
apps/cms/
└── src/lib/collections/Products/
    ├── index.ts                     # Collection config
    ├── hooks/
    │   ├── beforeChange.ts          # Validation + Stripe sync
    │   ├── enrichProduct.ts         # Computed fields
    │   ├── revalidateProduct.ts     # Cache revalidation
    │   └── deleteProductFromCarts.ts
    ├── examples/
    │   └── populate-examples.ts     # Population patterns
    ├── access/
    │   └── checkUserPurchases.ts    # Paywall access control
    └── __tests__/
        ├── beforeChange.test.ts     # Validation tests
        ├── enrichProduct.test.ts    # Enrichment tests
        ├── validation.test.ts       # Contract tests
        └── integration.test.ts      # Integration tests
```

---

## Type Safety

### Dual Type System

Products use a **dual type system** providing both runtime and compile-time safety:

```typescript
// Runtime validation with Zod
import { ProductSchema } from '@revealui/contracts/entities'

const result = ProductSchema.safeParse(data)
if (result.success) {
  const product = result.data // Validated at runtime
}

// Compile-time types
import type { Product } from '@revealui/contracts/entities'

function processProduct(product: Product) {
  // TypeScript checks at compile time
  console.log(product.title) // ✓ OK
  console.log(product.invalid) // ✗ Compile error
}
```

### Core Types

#### Product

```typescript
interface Product {
  // Identity
  id: number
  title: string

  // Stripe Integration
  stripeProductID: StripeProductID | null // prod_xxx
  priceJSON: StripePriceList | null // Parsed price list

  // Content
  layout: ProductBlock[] | null
  publishedOn: string | null

  // Paywall
  enablePaywall: boolean | null
  paywall: ProductBlock[] | null

  // Relationships
  categories: Array<number | Category> | null
  relatedProducts: Array<number | Product> | null

  // Metadata
  skipSync: boolean | null
  _status: 'draft' | 'published'
  createdAt: string
  updatedAt: string
}
```

#### Stripe Types

```typescript
// Stripe Product ID (prod_xxx)
type StripeProductID = string // Validated: /^prod_[a-zA-Z0-9]+$/

// Stripe Product Data
interface StripeProductData {
  id: string
  object: 'product'
  active: boolean
  name: string
  description: string | null
  metadata: Record<string, string>
  images: string[]
  features: Array<{ name: string }>
  default_price: string | null
  shippable: boolean
  url: string | null
}

// Stripe Price List
interface StripePriceList {
  object: 'list'
  data: Array<{
    id: string
    object: 'price'
    active: boolean
    currency: string // ISO 4217 (3 chars)
    unit_amount: number | null // In cents
    type: 'one_time' | 'recurring'
    recurring?: {
      interval: 'day' | 'week' | 'month' | 'year'
      interval_count: number
    }
  }>
  has_more: boolean
}
```

#### Enriched Product

```typescript
interface EnrichedProduct extends Product {
  // Price information
  priceRange: {
    min: number | null
    max: number | null
    currency: string | null
  } | null
  formattedPriceRange: string | null // e.g., "$9.99 - $99.99"
  priceCount: number
  defaultPriceId: string | null

  // Status flags
  isActive: boolean
  hasPaywall: boolean
  hasPrices: boolean
}
```

---

## Validation

### Schema Validation

All product data is validated using Zod schemas:

```typescript
import { ProductSchema } from '@revealui/contracts/entities'

// Validate product
const result = ProductSchema.safeParse(productData)
if (!result.success) {
  console.error(result.error.errors)
}
```

### Stripe Product ID Format

```typescript
import { StripeProductIDSchema } from '@revealui/contracts/entities'

// Valid formats
StripeProductIDSchema.parse('prod_1234567890123456') // ✓
StripeProductIDSchema.parse('prod_MowQVLkdIwHu7i') // ✓

// Invalid formats
StripeProductIDSchema.parse('price_123456') // ✗ Wrong prefix
StripeProductIDSchema.parse('prod_123') // ✗ Too short
StripeProductIDSchema.parse('123456') // ✗ Missing prefix
```

### Business Rules

#### Rule 1: Published Products Need Stripe Product

```typescript
// ✓ Valid: Published with Stripe product
{
  title: 'My Product',
  stripeProductID: 'prod_1234567890123456',
  _status: 'published'
}

// ✗ Invalid: Published without Stripe product
{
  title: 'My Product',
  stripeProductID: null,
  _status: 'published'
}
// Error: "Published products must have a valid Stripe Product ID"

// ✓ Valid: Draft without Stripe product
{
  title: 'My Product',
  stripeProductID: null,
  _status: 'draft'
}
```

#### Rule 2: Published Products Need Active Stripe Product

```typescript
// beforeChange hook validates:
if (data._status === 'published' && !stripeProduct.active) {
  throw new Error('Cannot publish product: Stripe product is not active')
}
```

### Validation in Hooks

The `beforeChange` hook performs comprehensive validation:

```typescript
import { beforeProductChange } from '@/lib/collections/Products/hooks/beforeChange'

// Hook validates:
// 1. Stripe Product ID format
// 2. Stripe product exists and is valid
// 3. Price list structure
// 4. Business rules (published = active)
```

---

## Business Logic

### Product Lifecycle

#### 1. Create Draft

```typescript
// Create product without Stripe (draft)
const product = await revealui.create({
  collection: 'products',
  data: {
    title: 'New Product',
    _status: 'draft',
  },
})
```

#### 2. Link Stripe Product

```typescript
// Add Stripe product ID
const updated = await revealui.update({
  collection: 'products',
  id: product.id,
  data: {
    stripeProductID: 'prod_1234567890123456',
  },
})

// beforeChange hook:
// - Validates prod_xxx format
// - Fetches product from Stripe
// - Validates product data
// - Fetches and stores price list
```

#### 3. Publish Product

```typescript
// Publish product
const published = await revealui.update({
  collection: 'products',
  id: product.id,
  data: {
    _status: 'published',
  },
})

// beforeChange hook validates:
// - Has valid Stripe product ID
// - Stripe product is active
```

### Price Management

#### Automatic Price Sync

Products automatically sync prices from Stripe:

```typescript
// When stripeProductID is set/changed:
const prices = await stripe.prices.list({
  product: stripeProductID,
  limit: 100,
})

product.priceJSON = JSON.stringify(prices)
```

#### Price Filtering

Get available (active) prices:

```typescript
import { getAvailablePrices } from '@revealui/contracts/entities'

const availablePrices = getAvailablePrices(product)
// Returns only active prices
```

#### Price Range Calculation

```typescript
import { getPriceRange, formatPriceRange } from '@revealui/contracts/entities'

const range = getPriceRange(product)
// { min: 999, max: 9999, currency: 'usd' }

const formatted = formatPriceRange(product)
// "$9.99 - $99.99"
```

### Paywall Logic

#### Enable Paywall

```typescript
const product = await revealui.create({
  collection: 'products',
  data: {
    title: 'Premium Product',
    enablePaywall: true,
    paywall: [
      {
        blockType: 'content',
        content: 'Exclusive content for buyers',
      },
    ],
  },
})
```

#### Access Control

```typescript
// In collection config
{
  name: 'paywall',
  type: 'blocks',
  access: {
    read: checkUserPurchases, // Custom access function
  },
}
```

---

## Relationship Population

### Automatic Population

Use the `depth` parameter for automatic population:

```typescript
// No population (depth: 0)
const product = await revealui.findByID({
  collection: 'products',
  id: 1,
  depth: 0,
})
// product.categories = [1, 2, 3] (IDs only)

// Populate direct relationships (depth: 1)
const product = await revealui.findByID({
  collection: 'products',
  id: 1,
  depth: 1,
})
// product.categories = [{ id: 1, name: 'Category 1' }, ...]
// product.relatedProducts = [{ id: 2, title: 'Related' }, ...]

// Populate nested relationships (depth: 2)
const product = await revealui.findByID({
  collection: 'products',
  id: 1,
  depth: 2,
})
// product.relatedProducts[0].categories = [{ id: 1, name: 'Cat' }, ...]
```

### Lazy Loading

Load relationships on-demand:

```typescript
import {
  getProductLazy,
  loadCategories,
  loadRelatedProducts,
} from '@/lib/collections/Products/examples/populate-examples'

// Load product without relationships
const product = await getProductLazy(revealui, 1)

// Load relationships conditionally
if (product.enablePaywall) {
  const categories = await loadCategories(revealui, product)
  const related = await loadRelatedProducts(revealui, product)
}
```

### Batch Loading

Load multiple products with relationships:

```typescript
import { getProductsBatch } from '@/lib/collections/Products/examples/populate-examples'

const { docs, totalDocs } = await getProductsBatch(revealui, {
  where: {
    _status: { equals: 'published' },
  },
  depth: 1,
  limit: 10,
})
```

### Selective Population

Populate only specific fields:

```typescript
import { getProductSelectivePopulate } from '@/lib/collections/Products/examples/populate-examples'

const product = await getProductSelectivePopulate(revealui, 1)
// product.relatedProducts contains only { id, title, stripeProductID }
// Optimizes response size and performance
```

---

## Common Patterns

### Pattern 1: Create Product Flow

```typescript
// 1. Create draft
const draft = await revealui.create({
  collection: 'products',
  data: {
    title: 'New Product',
    _status: 'draft',
  },
})

// 2. Add Stripe product (triggers price sync)
const withStripe = await revealui.update({
  collection: 'products',
  id: draft.id,
  data: {
    stripeProductID: 'prod_1234567890123456',
  },
})

// 3. Add content
const withContent = await revealui.update({
  collection: 'products',
  id: draft.id,
  data: {
    layout: [
      {
        blockType: 'content',
        content: 'Product description...',
      },
    ],
  },
})

// 4. Publish
const published = await revealui.update({
  collection: 'products',
  id: draft.id,
  data: {
    _status: 'published',
  },
})
```

### Pattern 2: Product Listing with Price Ranges

```typescript
import { enrichProductsBatch } from '@/lib/collections/Products/hooks/enrichProduct'

// Fetch products
const { docs } = await revealui.find({
  collection: 'products',
  where: {
    _status: { equals: 'published' },
  },
})

// Enrich with price information
const enriched = await enrichProductsBatch(docs)

// Display
enriched.forEach((product) => {
  console.log(product.title)
  console.log(product.formattedPriceRange) // "$9.99 - $99.99"
  console.log(`${product.priceCount} pricing options`)
})
```

### Pattern 3: Check Product Purchasability

```typescript
import {
  enrichProductManually,
  isProductPurchasable,
} from '@/lib/collections/Products/hooks/enrichProduct'

const product = await revealui.findByID({
  collection: 'products',
  id: 1,
})

const enriched = await enrichProductManually(product)

if (isProductPurchasable(enriched)) {
  // Product is published, active, and has prices
  console.log('Available for purchase')
  console.log(`Price: ${enriched.formattedPriceRange}`)
} else {
  console.log('Not available')
}
```

### Pattern 4: AI Context Gathering

```typescript
import { getProductContextForAI } from '@/lib/collections/Products/examples/populate-examples'

const context = await getProductContextForAI(revealui, 1)

// Returns structured data for AI:
// {
//   product: Product,
//   categoryNames: ['Electronics', 'Gadgets'],
//   relatedProductTitles: ['Related 1', 'Related 2'],
//   priceCount: 3,
//   hasPaywall: true
// }

const prompt = `
  Recommend products similar to:
  Title: ${context.product.title}
  Categories: ${context.categoryNames.join(', ')}
  Price options: ${context.priceCount}
`
```

### Pattern 5: Multi-Currency Products

```typescript
// Products automatically handle multiple currencies
// Price list contains all currencies from Stripe

const product = await revealui.findByID({
  collection: 'products',
  id: 1,
})

const enriched = await enrichProductManually(product)

// Price range uses first currency
console.log(enriched.priceRange)
// { min: 1000, max: 2000, currency: 'usd' }

// Access all prices
const prices = getAvailablePrices(enriched)
prices.forEach((price) => {
  console.log(`${price.currency}: ${price.unit_amount}`)
})
// usd: 1000
// eur: 900
// gbp: 800
```

---

## Hooks Reference

### beforeChange Hook

**Purpose**: Validate Stripe product and sync price list

**When it runs**: Before creating or updating products

**What it does**:
1. Validates Stripe Product ID format (prod_xxx)
2. Fetches product data from Stripe
3. Validates product data structure
4. Fetches associated price list
5. Validates price list structure
6. Stores price list as JSON
7. Enforces business rules

**Skip behavior**:
```typescript
// Set skipSync: true to bypass Stripe validation
const product = await revealui.update({
  collection: 'products',
  id: 1,
  data: {
    skipSync: true, // Skips Stripe validation
    someOtherField: 'value',
  },
})
// Hook automatically resets skipSync to false
```

**Error handling**:
```typescript
// Throws descriptive errors
try {
  await revealui.create({
    collection: 'products',
    data: {
      title: 'Product',
      stripeProductID: 'invalid_id',
    },
  })
} catch (error) {
  console.error(error.message)
  // "Invalid Stripe Product ID: ..."
}
```

### enrichProduct Hook

**Purpose**: Add computed display fields

**When it runs**: After reading products (afterRead)

**What it does**:
1. Parses priceJSON (if string)
2. Calculates price range (min/max)
3. Formats price range for display
4. Counts active prices
5. Determines default price ID
6. Sets active/paywall/prices flags

**Added fields**:
```typescript
interface EnrichedProduct extends Product {
  priceRange: { min, max, currency } | null
  formattedPriceRange: string | null // "$9.99 - $99.99"
  priceCount: number
  defaultPriceId: string | null
  isActive: boolean
  hasPaywall: boolean
  hasPrices: boolean
}
```

**Manual enrichment**:
```typescript
import { enrichProductManually } from '@/lib/collections/Products/hooks/enrichProduct'

const enriched = await enrichProductManually(product)
```

### Other Hooks

- **revalidateProduct**: Revalidates Next.js cache after changes
- **deleteProductFromCarts**: Removes product from user carts when deleted
- **populateArchiveBlock**: Populates archive block relationships

---

## Stripe Integration

### Product Sync Flow

```
┌──────────────────────┐
│  RevealUI Product    │
│  stripeProductID set │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  beforeChange Hook   │
└──────────┬───────────┘
           │
           ├─────► 1. Validate format (prod_xxx)
           │
           ├─────► 2. Fetch from Stripe
           │       GET /v1/products/:id
           │
           ├─────► 3. Validate product data
           │       (active, name, etc.)
           │
           ├─────► 4. Fetch price list
           │       GET /v1/prices?product=:id
           │
           ├─────► 5. Validate price list
           │       (currencies, amounts, etc.)
           │
           └─────► 6. Store as priceJSON
```

### Caching Strategy

Products use LRU caching to minimize Stripe API calls:

```typescript
// Cache configuration
const productCache = new LRUCache<string, Stripe.Product>({
  maxSize: 100, // Max 100 products
  ttlMs: 5 * 60 * 1000, // 5 minute TTL
})

const pricesCache = new LRUCache<string, Stripe.ApiList<Stripe.Price>>({
  maxSize: 100,
  ttlMs: 5 * 60 * 1000,
})
```

**Cache behavior**:
- First request: Fetch from Stripe, cache result
- Subsequent requests (within 5 min): Return cached data
- After 5 min: Fetch fresh data from Stripe

**Benefits**:
- Reduces API calls (cost optimization)
- Faster response times
- Prevents rate limiting

### Stripe Product States

| Stripe State | RevealUI Behavior |
|-------------|-------------------|
| Active | ✓ Can publish product |
| Inactive | ✗ Cannot publish (enforced) |
| Archived | ✗ Fetch fails, cannot save |
| Deleted | ✗ Fetch fails, cannot save |

### Price List Format

Products store the full Stripe price list response:

```typescript
product.priceJSON = {
  "object": "list",
  "data": [
    {
      "id": "price_1",
      "object": "price",
      "active": true,
      "currency": "usd",
      "unit_amount": 1000,
      "type": "one_time"
    },
    {
      "id": "price_2",
      "object": "price",
      "active": true,
      "currency": "usd",
      "unit_amount": 10000,
      "type": "recurring",
      "recurring": {
        "interval": "month",
        "interval_count": 1
      }
    }
  ],
  "has_more": false
}
```

---

## Testing

### Test Coverage

The Products collection has **170+ tests** across 4 test files:

| File | Tests | Coverage |
|------|-------|----------|
| `beforeChange.test.ts` | ~40 | Validation hook |
| `enrichProduct.test.ts` | ~40 | Enrichment hook |
| `validation.test.ts` | ~60 | Contract schemas |
| `integration.test.ts` | ~30 | Full lifecycle |

### Running Tests

```bash
# Run all product tests
pnpm test Products

# Run specific test file
pnpm test beforeChange.test.ts

# Run with coverage
pnpm test:coverage Products

# Watch mode
pnpm test:watch Products
```

### Test Examples

#### Validation Tests

```typescript
import { ProductSchema } from '@revealui/contracts/entities'

it('should reject published product without Stripe product', () => {
  const result = ProductSchema.safeParse({
    title: 'Product',
    stripeProductID: null,
    _status: 'published',
  })

  expect(result.success).toBe(false)
  expect(result.error.errors[0].message).toContain('Stripe Product ID')
})
```

#### Hook Tests

```typescript
import { beforeProductChange } from '@/lib/collections/Products/hooks/beforeChange'

it('should fetch and validate Stripe product', async () => {
  mockStripeRetrieve.mockResolvedValueOnce(validStripeProduct)
  mockStripePricesList.mockResolvedValueOnce(validPriceList)

  const result = await beforeProductChange({
    req: mockReq,
    data: product,
    operation: 'create',
  })

  expect(mockStripeRetrieve).toHaveBeenCalledWith('prod_1234567890123456')
  expect(result.priceJSON).toBeDefined()
})
```

#### Integration Tests

```typescript
it('should complete full create → validate → enrich → publish flow', async () => {
  // Create draft
  const draft = await beforeProductChange({ ... })

  // Add Stripe product
  const withStripe = await beforeProductChange({ ... })

  // Publish
  const published = await beforeProductChange({ ... })

  // Enrich
  const enriched = await enrichProduct({ ... })

  expect(enriched.isActive).toBe(true)
  expect(enriched.formattedPriceRange).toBeDefined()
})
```

---

## Troubleshooting

### Common Issues

#### Issue: "Invalid Stripe Product ID"

**Cause**: Product ID doesn't match `prod_xxx` format

**Solution**:
```typescript
// ✗ Wrong
stripeProductID: 'price_123' // Wrong prefix
stripeProductID: 'prod_' // Too short
stripeProductID: '123456' // Missing prefix

// ✓ Correct
stripeProductID: 'prod_1234567890123456'
```

#### Issue: "Failed to validate Stripe product"

**Cause**: Product doesn't exist in Stripe or API error

**Solution**:
1. Verify product exists in Stripe dashboard
2. Check Stripe API key is correct
3. Ensure product is not deleted
4. Check network connectivity

```typescript
// Test Stripe connection
try {
  const product = await stripe.products.retrieve('prod_xxx')
  console.log('Product exists:', product.name)
} catch (error) {
  console.error('Stripe error:', error.message)
}
```

#### Issue: "Cannot publish product: Stripe product is not active"

**Cause**: Trying to publish when Stripe product is inactive

**Solution**:
1. Activate product in Stripe dashboard
2. Or keep product as draft in RevealUI

```typescript
// Check product status in Stripe
const stripeProduct = await stripe.products.retrieve('prod_xxx')
console.log('Active:', stripeProduct.active)

// Activate in Stripe
await stripe.products.update('prod_xxx', {
  active: true,
})
```

#### Issue: Price List Not Syncing

**Cause**: skipSync flag set or API error

**Solution**:
```typescript
// Ensure skipSync is false
const product = await revealui.update({
  collection: 'products',
  id: 1,
  data: {
    skipSync: false,
    stripeProductID: 'prod_xxx', // This triggers sync
  },
})

// Check priceJSON was populated
console.log(product.priceJSON)
```

#### Issue: "Published products must have a valid Stripe Product ID"

**Cause**: Trying to publish product without Stripe product

**Solution**:
```typescript
// Add Stripe product first
const updated = await revealui.update({
  collection: 'products',
  id: 1,
  data: {
    stripeProductID: 'prod_1234567890123456',
  },
})

// Then publish
const published = await revealui.update({
  collection: 'products',
  id: 1,
  data: {
    _status: 'published',
  },
})
```

### Debug Mode

Enable logging in hooks:

```typescript
// In beforeChange.ts
const logs = true // Change to true

// Now all validation steps are logged
```

### Validation Debugging

```typescript
import { ProductSchema } from '@revealui/contracts/entities'

const result = ProductSchema.safeParse(productData)

if (!result.success) {
  // Detailed error information
  console.log(result.error.errors)
  // [
  //   {
  //     path: ['stripeProductID'],
  //     message: 'Invalid Stripe Product ID format',
  //     code: 'custom'
  //   }
  // ]
}
```

---

## API Reference

### Type Guards

```typescript
import {
  hasStripeProduct,
  isPublishedProduct,
  hasProductPrices,
  hasProductImages,
} from '@revealui/contracts/entities'

// Check if product has Stripe product
if (hasStripeProduct(product)) {
  // product.stripeProductID is string (not null)
  console.log(product.stripeProductID)
}

// Check if product is published
if (isPublishedProduct(product)) {
  // Product is published AND has valid Stripe product
  console.log('Live product')
}

// Check if product has prices
if (hasProductPrices(product)) {
  // product.priceJSON is StripePriceList (not null)
  const prices = product.priceJSON.data
}
```

### Utility Functions

```typescript
import {
  getAvailablePrices,
  getPriceCount,
  getPriceRange,
  getDefaultPriceId,
  formatPriceRange,
} from '@revealui/contracts/entities'

// Get active prices only
const prices = getAvailablePrices(product)
// [{ id: 'price_1', active: true, ... }]

// Count active prices
const count = getPriceCount(product)
// 3

// Get price range
const range = getPriceRange(product)
// { min: 999, max: 9999, currency: 'usd' }

// Get default price ID (first active price)
const defaultId = getDefaultPriceId(product)
// 'price_1234567890123456'

// Format price range
const formatted = formatPriceRange(product)
// "$9.99 - $99.99"
```

### Enrichment Functions

```typescript
import {
  enrichProductManually,
  enrichProductsBatch,
  getPriceStatistics,
  isProductPurchasable,
  getProductDisplayName,
} from '@/lib/collections/Products/hooks/enrichProduct'

// Enrich single product
const enriched = await enrichProductManually(product)

// Enrich multiple products
const enrichedList = await enrichProductsBatch(products)

// Get price statistics
const stats = getPriceStatistics(enriched)
// {
//   hasValidPricing: true,
//   minPrice: 999,
//   maxPrice: 9999,
//   currency: 'usd',
//   totalPrices: 3,
//   formattedRange: '$9.99 - $99.99'
// }

// Check if purchasable
const canPurchase = isProductPurchasable(enriched)
// true if published, active, and has prices

// Get display name with price
const displayName = getProductDisplayName(enriched)
// "Product Name ($9.99 - $99.99)"
```

### Population Functions

```typescript
import {
  getProductWithRelationships,
  getProductLazy,
  loadCategories,
  loadRelatedProducts,
  getProductsBatch,
  getProductSelectivePopulate,
  getProductDeepPopulate,
  getProductContextForAI,
  enrichProductForAPI,
} from '@/lib/collections/Products/examples/populate-examples'

// See "Relationship Population" section for usage
```

### Contracts

```typescript
import {
  ProductContract,
  CreateProductContract,
  UpdateProductContract,
} from '@revealui/contracts/entities'

// Validate with contract
const result = ProductContract.schema.safeParse(data)

// Get contract metadata
console.log(ProductContract.name) // 'Product'
console.log(ProductContract.version) // '1'
```

---

## Best Practices

### 1. Always Validate Before Publishing

```typescript
// ✓ Good: Validate Stripe product exists before publishing
const draft = await revealui.create({ ... })
const withStripe = await revealui.update({
  id: draft.id,
  data: { stripeProductID: 'prod_xxx' },
})
// Wait for validation to complete
const published = await revealui.update({
  id: draft.id,
  data: { _status: 'published' },
})

// ✗ Bad: Publish without Stripe product
const draft = await revealui.create({ ... })
await revealui.update({
  id: draft.id,
  data: { _status: 'published' }, // Error!
})
```

### 2. Use Enrichment for Display

```typescript
// ✓ Good: Enrich before display
const product = await revealui.findByID({ ... })
const enriched = await enrichProductManually(product)
console.log(enriched.formattedPriceRange)

// ✗ Bad: Manual price formatting
const product = await revealui.findByID({ ... })
const priceJSON = JSON.parse(product.priceJSON)
const min = Math.min(...priceJSON.data.map(p => p.unit_amount))
// Complex, error-prone
```

### 3. Use Type Guards

```typescript
// ✓ Good: Use type guards
if (hasStripeProduct(product)) {
  await syncWithStripe(product.stripeProductID) // Type-safe
}

// ✗ Bad: Manual null checks
if (product.stripeProductID) {
  await syncWithStripe(product.stripeProductID)
}
```

### 4. Lazy Load When Possible

```typescript
// ✓ Good: Lazy load conditional relationships
const product = await getProductLazy(revealui, 1)
if (needsCategories) {
  const categories = await loadCategories(revealui, product)
}

// ✗ Bad: Always populate everything
const product = await revealui.findByID({
  id: 1,
  depth: 2, // Expensive!
})
```

### 5. Handle Errors Gracefully

```typescript
// ✓ Good: Handle validation errors
try {
  await revealui.update({
    collection: 'products',
    id: 1,
    data: { stripeProductID: userInput },
  })
} catch (error) {
  console.error('Validation failed:', error.message)
  // Show user-friendly error
}

// ✗ Bad: No error handling
await revealui.update({
  collection: 'products',
  id: 1,
  data: { stripeProductID: userInput }, // May fail
})
```

---

## Migration Guide

### From Manual Product Management

If you're migrating from manual product management:

1. **Add Stripe Product IDs** to existing products
2. **Trigger price sync** by updating stripeProductID
3. **Update queries** to use enriched fields
4. **Update UI** to use formatted price ranges

```typescript
// Migration script example
const products = await revealui.find({
  collection: 'products',
  where: { stripeProductID: { exists: false } },
})

for (const product of products.docs) {
  // Map existing product to Stripe product
  const stripeProductID = await findStripeProduct(product.title)

  if (stripeProductID) {
    await revealui.update({
      collection: 'products',
      id: product.id,
      data: { stripeProductID },
    })
    // Price sync happens automatically
  }
}
```

---

## Related Documentation

- [Prices Collection](./PRICE_COLLECTION.md)
- [Stripe Integration Guide](./STRIPE_INTEGRATION.md)
- [Type System Architecture](./TYPE_SYSTEM.md)
- [Population Strategies](./POPULATION.md)
- [Testing Guide](./TESTING.md)

---

## Support

For issues or questions:

1. Check [Troubleshooting](#troubleshooting)
2. Review test files for examples
3. Open an issue on GitHub
4. Contact the team

---

**Last Updated**: 2026-02-02
**Version**: 1.0.0
