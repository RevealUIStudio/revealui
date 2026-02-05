# CMS TypeScript Strict Mode Refactoring Guide

**Status:** In Progress (6/15+ errors fixed)
**Priority:** Medium
**Estimated Remaining Effort:** 2-3 hours

## Problem Statement

The CMS application has systemic TypeScript strict mode compatibility issues stemming from type mismatches between RevealUI core types and CMS implementation patterns. The use of `as unknown` casts throughout the codebase fails in strict mode.

## Root Causes

### 1. RevealValue Type Incompatibility

**The Issue:**
```typescript
export type RevealValue =
  | string
  | number
  | boolean
  | null
  | Date
  | RevealValue[]
  | { [key: string]: RevealValue }
```

Custom types like `CartItem` don't have index signatures, making them incompatible with `RevealValue`.

**Current Pattern (Failing):**
```typescript
cart: cartWithoutProduct as unknown  // ❌ Fails in strict mode
```

**Fixed Pattern:**
```typescript
cart: cartWithoutProduct as unknown as RevealValue  // ✅ Works
```

### 2. FieldAccess Type Mismatches

**The Issue:**
Field access functions return `AccessResult` which can be a `Where` object, but field access expects boolean.

**Current Workaround:**
```typescript
read: checkUserPurchases as never  // ✅ Following Products pattern
```

### 3. Generic Type Constraints

**The Issue:**
Functions using generic `Record<string, unknown>` don't satisfy specific type constraints.

**Fixed Pattern:**
```typescript
where: where as unknown as RevealWhere  // ✅ Double cast required
```

## Fixed Errors (Reference)

### 1. Collection/Global Map Type Annotations
**File:** `apps/cms/src/app/api/chat/route.ts:58`

**Before:**
```typescript
collections: config.collections?.map(
  (c): CollectionMetadata => ({  // ❌ 'c' implicitly has 'any'
```

**After:**
```typescript
import type { RevealCollectionConfig, RevealGlobalConfig } from '@revealui/core'

collections: config.collections?.map(
  (c: RevealCollectionConfig): CollectionMetadata => ({  // ✅
```

### 2. RichTextContent Type Casting
**File:** `apps/cms/src/lib/blocks/MediaBlock/Component.tsx:97`

**Before:**
```typescript
content={(caption as unknown) || { root: {...} }}  // ❌
```

**After:**
```typescript
import RichText, { type RichTextContent } from '@/lib/components/RichText/index'

content={((caption as unknown) || { root: {...} }) as RichTextContent}  // ✅
```

### 3. RevealValue Casting
**File:** `apps/cms/src/lib/collections/Prices/hooks/deletePriceFromCarts.ts:81`

**Before:**
```typescript
cart: cartWithoutProduct as unknown  // ❌
```

**After:**
```typescript
import type { RevealValue } from '@revealui/core'

cart: cartWithoutProduct as unknown as RevealValue  // ✅
```

### 4. FieldAccess Compatibility
**File:** `apps/cms/src/lib/collections/Prices/index.ts:134`

**Before:**
```typescript
access: {
  read: checkUserPurchases as unknown  // ❌
}
```

**After:**
```typescript
access: {
  read: checkUserPurchases as never  // ✅ Follows Products pattern
}
```

### 5. RevealWhere Casting
**File:** `apps/cms/src/lib/collections/Products/examples/populate-examples.ts:169`

**Before:**
```typescript
where: where as unknown  // ❌
```

**After:**
```typescript
import type { RevealWhere } from '@revealui/core'

where: where as unknown as RevealWhere  // ✅
```

### 6. Return Type Double Casting
**File:** `apps/cms/src/lib/collections/Products/examples/populate-examples.ts:167`

**Before:**
```typescript
return (await revealui.find({...})) as { docs: Product[]; totalDocs: number }  // ❌
```

**After:**
```typescript
return (await revealui.find({...})) as unknown as { docs: Product[]; totalDocs: number }  // ✅
```

## Systematic Refactoring Approach

### Phase 1: Type Definition Audit (1 hour)

1. **Review RevealValue Usage**
   ```bash
   grep -r "as unknown" apps/cms/src --include="*.ts" --include="*.tsx"
   ```

2. **Identify Custom Types Missing Index Signatures**
   - CartItem
   - Product types
   - Other domain models

3. **Document Type Compatibility Matrix**
   | Source Type | Target Type | Cast Pattern |
   |-------------|-------------|--------------|
   | CartItem | RevealValue | `as unknown as RevealValue` |
   | Record<string, unknown> | RevealWhere | `as unknown as RevealWhere` |
   | FieldAccess<T> | FieldAccessFunction | `as never` |

### Phase 2: Implement Type Guards (30 minutes)

Create type guards for safe narrowing:

```typescript
// packages/core/src/types/guards.ts

export function isRevealValue(value: unknown): value is RevealValue {
  if (value === null) return true
  if (value instanceof Date) return true

  const type = typeof value
  if (['string', 'number', 'boolean'].includes(type)) return true

  if (Array.isArray(value)) {
    return value.every(isRevealValue)
  }

  if (type === 'object' && value !== null) {
    return Object.values(value).every(isRevealValue)
  }

  return false
}
```

### Phase 3: Add Index Signatures (30 minutes)

Update custom types to be RevealValue-compatible:

```typescript
// Before
export interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  items: Array<{
    product: string | number
    quantity?: number
  }>
}

// After
export interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  items: Array<{
    product: string | number
    quantity?: number
    [key: string]: unknown
  }>
  [key: string]: unknown  // ✅ Now compatible with RevealValue
}
```

### Phase 4: Replace Casts Systematically (1-2 hours)

1. **Search for all `as unknown` patterns**
2. **Replace with appropriate double casts**
3. **Add necessary type imports**
4. **Build and verify**

## Testing Strategy

### 1. Build Validation
```bash
pnpm --filter cms build
```

### 2. Type Coverage Check
```bash
pnpm --filter cms typecheck
```

### 3. Runtime Validation
Add runtime checks in development:

```typescript
if (process.env.NODE_ENV === 'development') {
  if (!isRevealValue(cart)) {
    console.warn('Invalid RevealValue:', cart)
  }
}
```

## Known Patterns

### Pattern 1: Collection/Global Maps
```typescript
config.collections?.map((c: RevealCollectionConfig): CollectionMetadata => ({...}))
```

### Pattern 2: Where Clauses
```typescript
where: where as unknown as RevealWhere
```

### Pattern 3: Field Access
```typescript
read: checkUserPurchases as never
```

### Pattern 4: Return Types
```typescript
return (await api.call()) as unknown as ExpectedType
```

### Pattern 5: RevealValue Assignments
```typescript
data: {
  field: value as unknown as RevealValue
}
```

## Potential Improvements

### Option A: Stricter Type Definitions
Update RevealUI core types to be more specific:

```typescript
// Instead of:
type RevealValue = string | number | ... | { [key: string]: RevealValue }

// Use:
type RevealValue =
  | RevealPrimitive
  | RevealArray
  | RevealObject

interface RevealObject {
  [key: string]: RevealValue
}
```

### Option B: Type Utility Functions
Create helper functions for safe casting:

```typescript
export function toRevealValue<T>(value: T): RevealValue {
  // Runtime validation
  if (!isRevealValue(value)) {
    throw new TypeError('Value is not compatible with RevealValue')
  }
  return value as unknown as RevealValue
}
```

### Option C: Generic Constraints
Add generic constraints to API functions:

```typescript
function update<T extends RevealDataObject>({
  collection,
  id,
  data,
}: {
  collection: string
  id: string | number
  data: T  // ✅ Type-safe
}): Promise<T>
```

## Migration Checklist

- [x] Audit existing `as unknown` usage
- [x] Fix chat/route.ts type annotations
- [x] Fix MediaBlock RichTextContent
- [x] Fix deletePriceFromCarts RevealValue
- [x] Fix Prices FieldAccess
- [x] Fix populate-examples RevealWhere
- [x] Fix populate-examples return type
- [ ] Identify remaining errors (est. 10-15)
- [ ] Create type guards
- [ ] Add index signatures to custom types
- [ ] Replace remaining `as unknown` casts
- [ ] Add runtime validation (dev mode)
- [ ] Update documentation

## Files Requiring Attention

Based on `as unknown` usage patterns, these files likely need updates:

```bash
# Find all files with 'as unknown'
grep -rl "as unknown" apps/cms/src --include="*.ts" --include="*.tsx"
```

Expected files:
- Collection configuration files
- Hook files (beforeChange, afterChange, etc.)
- API route handlers
- Block components
- Example/documentation files

## Success Criteria

1. ✅ CMS builds without TypeScript errors
2. ✅ All type casts are explicit and documented
3. ✅ No runtime type errors in development
4. ✅ Type coverage maintained at 100%
5. ✅ Code follows consistent casting patterns

## Notes

- Use `as never` for field access functions (following Products collection pattern)
- Use double cast `as unknown as TargetType` for type bridging
- Import types explicitly rather than using typeof
- Document any unusual casts with comments explaining why they're needed
- Consider contributing type improvements back to RevealUI core

## References

- [TypeScript Handbook - Type Assertions](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-assertions)
- [TypeScript Handbook - Type Guards](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- RevealUI Core Types: `packages/core/src/types/index.ts`
