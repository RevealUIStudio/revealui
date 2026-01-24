# Duplicate Logic Analysis Across Packages

**Date:** After Migration Assessment  
**Status:** 🔍 **ANALYSIS COMPLETE - Multiple Duplications Found**

---

## Executive Summary

Analysis of the codebase revealed **multiple instances of duplicate logic** across packages and apps. The duplicates fall into several categories:

1. **Deep Merge/Clone Utilities** (3-4 implementations)
2. **Error Response Functions** (2 implementations)
3. **Validation Utilities** (multiple implementations)
4. **Type Guards** (scattered across packages)

**Recommendation:** Consolidate these into shared utility packages or existing shared packages.

---

## 🔴 Critical Duplications

### 1. **Deep Merge Functions** - 4 Implementations

#### **Location 1:** `packages/core/src/core/config/utils.ts`
```typescript
export function deepMerge<T extends object>(target: Partial<T>, source: T): T {
  return deepmerge(target, source, {
    arrayMerge: (_target, source) => source,
  }) as T
}
```
- **Uses:** `deepmerge` library
- **Purpose:** Config merging

#### **Location 2:** `apps/cms/src/lib/utilities/deepMerge.ts`
```typescript
export default function deepMerge<T extends Record<string, unknown>, R extends Record<string, unknown>>(
  target: T,
  source: R,
): T {
  // Manual implementation (49 lines)
}
```
- **Uses:** Manual implementation
- **Purpose:** Generic object merging

#### **Location 3:** `packages/dev/src/tailwind/create-config.ts`
```typescript
function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  // Manual implementation
}
```
- **Uses:** Manual implementation
- **Purpose:** Tailwind config merging

#### **Location 4:** `packages/core/src/core/revealui.ts`
```typescript
export function deepMergeSimple<T extends Record<string, unknown>>(...)
```
- **Uses:** Manual implementation
- **Purpose:** Simple object merging

**Impact:** ⚠️ **MEDIUM** - Different behaviors, inconsistent API

**Recommendation:** 
- Standardize on `packages/core/src/core/config/utils.ts` (uses library)
- Export from `@revealui/core` 
- Remove duplicates and import from core

---

### 2. **Deep Clone Functions** - 2-3 Implementations

#### **Location 1:** `packages/ai/src/memory/utils/deep-clone.ts`
```typescript
export function deepClone<T>(obj: T, visited = new WeakMap<object, unknown>()): T {
  // Full implementation (140 lines)
  // Handles: Date, RegExp, Map, Set, TypedArrays, ArrayBuffer, circular refs
}
```
- **Features:** Circular reference detection, Date/RegExp/Map/Set support
- **Purpose:** Memory management (UserPreferences)

#### **Location 2:** `packages/test/src/utils/test-helpers.ts`
```typescript
export function deepClone<T>(obj: T): T {
  // Simpler implementation
}
```
- **Features:** Basic deep clone
- **Purpose:** Test utilities

**Impact:** ⚠️ **LOW-MEDIUM** - Different feature sets

**Recommendation:**
- Use `packages/ai/src/memory/utils/deep-clone.ts` as the canonical implementation
- Move to `packages/core/src/core/utils/deep-clone.ts`
- Export from `@revealui/core/utils`

---

### 3. **Error Response Functions** - 2 Complete Implementations

#### **Location 1:** `apps/cms/src/lib/utils/error-response.ts`
```typescript
export function createErrorResponse(error: unknown, context?: Record<string, unknown>): NextResponse<ErrorResponse>
export function createValidationErrorResponse(...): NextResponse<ErrorResponse>
export function createApplicationErrorResponse(...): NextResponse<ErrorResponse>
export function createSuccessResponse<T>(data: T, statusCode?: number): NextResponse<T>
```
- **Uses:** `NextResponse` (Next.js)
- **Returns:** `NextResponse<T>`

#### **Location 2:** `apps/web/src/server/error-response.ts`
```typescript
export function createErrorResponse(error: unknown, context?: Record<string, unknown>): Response
export function createValidationErrorResponse(...): Response
export function createApplicationErrorResponse(...): Response
```
- **Uses:** Standard `Response` (Web standard)
- **Returns:** `Response`

**Impact:** ⚠️ **HIGH** - Same API, different implementations, duplicated in 20+ files

**Analysis:**
- Both use `@revealui/core/utils/errors` (good!)
- Only difference: `NextResponse` vs `Response`
- Both have same function signatures and logic

**Recommendation:**
- Create adapter in `packages/core/src/core/utils/error-responses.ts`
- Export framework-agnostic functions
- Apps wrap with framework-specific adapters (thin layer)

---

### 4. **IsObject Utility** - 2+ Implementations

#### **Location 1:** `apps/cms/src/lib/utilities/isObject.ts`
```typescript
export function isObject(item: unknown): item is Record<string, unknown> {
  return item !== null && typeof item === 'object' && !Array.isArray(item)
}
```

#### **Location 2:** `packages/ai/src/memory/utils/validation.ts`
```typescript
// Similar logic embedded in validation functions
```

**Impact:** ⚠️ **LOW** - Simple utility, but should be consistent

**Recommendation:**
- Export from `@revealui/core/utils/type-guards`
- Single source of truth

---

## 🟡 Medium Priority Duplications

### 5. **Validation Utilities** - Multiple Scattered Implementations

#### **Locations:**
- `packages/ai/src/memory/utils/validation.ts` - Context validation (273 lines)
- `apps/cms/src/lib/validation/schemas.ts` - Form validation schemas
- `packages/contracts/src/cms/field.ts` - Field validation
- `packages/config/src/validator.ts` - Config validation

**Analysis:**
- Different purposes (context, forms, fields, config)
- Some duplication in error handling patterns
- Validation logic is domain-specific, but patterns could be shared

**Impact:** ⚠️ **LOW-MEDIUM** - Domain-specific but could share patterns

**Recommendation:**
- Keep domain-specific validation
- Extract common validation patterns to `@revealui/contracts/validation` or `@revealui/core/utils/validation`

---

### 6. **Type Guards** - Scattered Across Packages

#### **Locations:**
- `packages/contracts/src/content/index.ts` - Block type guards (schema merged)
- `packages/contracts/src/cms/field.ts` - Field type guards
- `packages/core/src/core/utils/type-guards.ts` - Core type guards

**Analysis:**
- Domain-specific guards (blocks, fields)
- Some overlap in field type checking

**Impact:** ⚠️ **LOW** - Domain-specific, appropriate separation

**Recommendation:**
- Keep domain-specific guards in respective packages
- Ensure core guards are in `@revealui/core/utils/type-guards`

---

## 📊 Duplication Summary

| Category | Instances | Severity | Priority |
|----------|-----------|----------|----------|
| **Deep Merge** | 4 | ⚠️ Medium | High |
| **Deep Clone** | 2-3 | ⚠️ Low-Medium | Medium |
| **Error Responses** | 2 | ⚠️ High | **Critical** |
| **IsObject** | 2+ | ⚠️ Low | Low |
| **Validation Utils** | 4+ | ⚠️ Low-Medium | Medium |
| **Type Guards** | 3+ | ⚠️ Low | Low |

---

## 🔧 Recommended Actions

### **Priority 1: Error Response Functions** (CRITICAL)

**Action:** Create unified error response utilities

1. **Create:** `packages/core/src/core/utils/error-responses.ts`
   ```typescript
   // Framework-agnostic core functions
   export function createErrorResponseData(error: unknown, context?: Record<string, unknown>): ErrorResponseData
   export function createValidationErrorData(...): ErrorResponseData
   export function createApplicationErrorData(...): ErrorResponseData
   ```

2. **Update CMS App:** Thin wrapper around core
   ```typescript
   // apps/cms/src/lib/utils/error-response.ts
   import { createErrorResponseData } from '@revealui/core/utils/error-responses'
   export function createErrorResponse(...): NextResponse {
     return NextResponse.json(createErrorResponseData(...), ...)
   }
   ```

3. **Update Web App:** Thin wrapper around core
   ```typescript
   // apps/web/src/server/error-response.ts
   import { createErrorResponseData } from '@revealui/core/utils/error-responses'
   export function createErrorResponse(...): Response {
     return new Response(JSON.stringify(createErrorResponseData(...)), ...)
   }
   ```

**Impact:** Removes duplication from 20+ files using error responses

---

### **Priority 2: Deep Merge** (HIGH)

**Action:** Standardize on one implementation

1. **Keep:** `packages/core/src/core/config/utils.ts` (uses `deepmerge` library)
2. **Export:** Add to `@revealui/core` exports
3. **Remove:** Other implementations
4. **Update:** All consumers to import from `@revealui/core`

**Impact:** Consistent behavior, smaller bundle (uses library)

---

### **Priority 3: Deep Clone** (MEDIUM)

**Action:** Consolidate implementations

1. **Move:** `packages/ai/src/memory/utils/deep-clone.ts` → `packages/core/src/core/utils/deep-clone.ts`
2. **Export:** From `@revealui/core/utils`
3. **Update:** Test helpers to use core implementation

**Impact:** Single implementation with full feature set

---

### **Priority 4: IsObject** (LOW)

**Action:** Add to core type guards

1. **Add:** `packages/core/src/core/utils/type-guards.ts`
   ```typescript
   export function isObject(item: unknown): item is Record<string, unknown>
   ```
2. **Update:** All consumers to import from core

**Impact:** Single source of truth

---

## 📋 Detailed Findings

### Deep Merge Comparison

| Location | Implementation | Array Merge | Circular Ref Detection | Library |
|----------|---------------|-------------|----------------------|---------|
| `revealui/core/config` | deepmerge lib | Custom (source wins) | ✅ | ✅ deepmerge |
| `apps/cms/utilities` | Manual | Source overwrites | ❌ | ❌ |
| `dev/tailwind` | Manual | Source overwrites | ❌ | ❌ |
| `revealui/core/revealui` | Manual (Simple) | Source overwrites | ❌ | ❌ |

**Verdict:** `packages/core/src/core/config/utils.ts` is the best (uses library, handles edge cases)

---

### Error Response Comparison

| Location | Framework | Return Type | Functions | Lines |
|----------|-----------|-------------|-----------|-------|
| `apps/cms/lib/utils` | Next.js | `NextResponse<T>` | 4 functions | 83 |
| `apps/web/server` | Web Standard | `Response` | 3 functions | 82 |

**Analysis:**
- ✅ Both use `@revealui/core/utils/errors` (good!)
- ⚠️ Logic is nearly identical (just wrapper differences)
- ⚠️ Used in 20+ files across both apps

**Verdict:** Should be unified with framework-specific adapters

---

## 🎯 Impact Assessment

### **If Fixed:**

1. **Error Responses:** 
   - Remove ~80 lines of duplicate code
   - Simplify 20+ files using error responses
   - Single source of truth for error format

2. **Deep Merge:**
   - Remove ~150 lines of duplicate code
   - Consistent behavior across codebase
   - Smaller bundle (use library)

3. **Deep Clone:**
   - Remove ~50 lines of duplicate code
   - Full feature set available everywhere

**Total Estimated Reduction:** ~280+ lines of duplicate code

---

## 💡 Implementation Strategy

### **Phase 1: Error Responses** (1-2 hours)
1. Create core error response utilities
2. Update CMS app wrapper
3. Update Web app wrapper
4. Migrate consumers

### **Phase 2: Deep Merge** (1 hour)
1. Export from `@revealui/core`
2. Update consumers
3. Remove duplicates

### **Phase 3: Deep Clone** (30 minutes)
1. Move to core utils
2. Update consumers
3. Remove duplicates

### **Phase 4: Minor Utilities** (30 minutes)
1. Add `isObject` to type guards
2. Update consumers

**Total Estimated Time:** 3-4 hours

---

**Last Updated:** After codebase analysis  
**Status:** 🔍 **ANALYSIS COMPLETE - Ready for Implementation**
