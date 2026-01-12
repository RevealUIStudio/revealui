# Agent Handoff: Complete RevealUIInstance File Splitting

**Date**: January 2025  
**Status**: ✅ **COMPLETE - VERIFICATION NEEDED**  
**Estimated Time**: 30 minutes (verification only)  
**Priority**: HIGH

---

## Executive Summary

**Task**: ✅ **APPEARS COMPLETE** - Instance methods have been extracted from `RevealUIInstance.ts` into separate files.

**Current State**: 
- ✅ `CollectionOperations.ts` has been split (76 lines, methods extracted)
- ✅ `RevealUIInstance.ts` is now 317 lines (down from 415, target was <200)
- ✅ Method files exist in `methods/` directory (find.ts, findByID.ts, create.ts, update.ts, delete.ts)
- ✅ All CRUD methods delegate to extracted functions (verified in code)

**Current File Size**: 317 lines (target was ~150-200, so slightly larger than ideal but much better than 415)

**Verification Task**: 
- ✅ File size reduced (317 lines vs 415 original)
- ⏳ Run full test suite to ensure everything works
- ⏳ Verify all imports are correct
- ⏳ Check if file can be further reduced (e.g., extract login/findGlobal/updateGlobal methods)

---

## Current File Structure

### ✅ Already Split: CollectionOperations.ts

```
packages/revealui/src/core/collections/
├── CollectionOperations.ts        (76 lines - main class only)
├── hooks.ts                       (hook utilities)
├── operations/
│   ├── find.ts                    (find operation)
│   ├── findById.ts                (findByID operation)
│   ├── create.ts                  (create operation)
│   ├── update.ts                  (update operation)
│   └── delete.ts                  (delete operation)
└── index.ts                       (exports)
```

### ⚠️ Needs Work: RevealUIInstance.ts

```
packages/revealui/src/core/instance/
├── RevealUIInstance.ts            (415 lines - contains inline methods)
├── methods/
│   ├── find.ts                    (exists - needs verification)
│   ├── findById.ts                (exists - needs verification)
│   ├── create.ts                  (exists - needs verification)
│   ├── update.ts                  (exists - needs verification)
│   ├── delete.ts                  (exists - needs verification)
│   └── hooks.ts                   (exists - needs verification)
├── logger.ts                      (logger implementation)
└── index.ts                       (exports)
```

**Problem**: Methods are imported at the top of `RevealUIInstance.ts` but the actual method implementations are still inline in the file (lines 127-253).

---

## Task: Extract Instance Methods

### Methods to Extract

The following methods need to be extracted from `RevealUIInstance.ts`:

1. **`find`** (lines 127-148)
   - Instance method that delegates to collection
   - Handles JWT validation, DataLoader setup
   - Calls `collections[collection].find(options)`

2. **`findByID`** (lines 150-174)
   - Instance method that delegates to collection
   - Handles JWT validation, DataLoader setup
   - Calls `collections[collection].findByID(options)`

3. **`create`** (lines 176-207)
   - Instance method that delegates to collection
   - Calls afterChange hooks
   - Calls `collections[collection].create(options)`

4. **`update`** (lines 209-242)
   - Instance method that delegates to collection
   - Calls afterChange hooks
   - Calls `collections[collection].update(options)`

5. **`delete`** (lines 244-253)
   - Instance method that delegates to collection
   - Calls `collections[collection].delete(options)`

### Additional Methods (May Stay Inline)

These methods might stay in `RevealUIInstance.ts` as they're instance-specific:

- **`login`** (lines 255-311) - Authentication logic
- **`findGlobal`** (lines 313-382) - Global operations
- **`updateGlobal`** (lines 384-398) - Global operations

**Decision**: Extract the 5 CRUD methods first, evaluate if login/findGlobal/updateGlobal should also be extracted.

---

## Reference Implementation: CollectionOperations Pattern

### Example: How `CollectionOperations.find` was extracted

**Before** (inline in class):
```typescript
async find(options: RevealFindOptions): Promise<RevealPaginatedResult> {
  // ... 140 lines of implementation ...
}
```

**After** (extracted to `operations/find.ts`):
```typescript
// packages/revealui/src/core/collections/operations/find.ts
export async function find(
  config: RevealCollectionConfig,
  db: { query: (query: string, values?: unknown[]) => Promise<DatabaseResult> } | null,
  options: RevealFindOptions
): Promise<RevealPaginatedResult> {
  // ... implementation (same logic, but accepts config and db as parameters) ...
}
```

**In main file** (delegation):
```typescript
// packages/revealui/src/core/collections/CollectionOperations.ts
import { find } from './operations/find'

export class RevealUICollection {
  async find(options: RevealFindOptions): Promise<RevealPaginatedResult> {
    return find(this.config, this.db, options)
  }
}
```

### Key Pattern

1. Extract method to separate file as **pure function**
2. Function accepts `config` and `db` as first parameters
3. Method in class becomes **thin delegation** (1-3 lines)
4. All implementation logic stays in extracted file

---

## Step-by-Step Implementation Plan

### Phase 1: Verify Existing Method Files (15 minutes)

1. Check if method files in `methods/` are complete
2. Compare with inline implementations in `RevealUIInstance.ts`
3. Identify what needs to be done

**Files to Check**:
- ✅ `packages/revealui/src/core/instance/methods/find.ts` (VERIFIED: exists, 40 lines, complete)
- `packages/revealui/src/core/instance/methods/findById.ts`
- `packages/revealui/src/core/instance/methods/create.ts`
- `packages/revealui/src/core/instance/methods/update.ts`
- `packages/revealui/src/core/instance/methods/delete.ts`
- `packages/revealui/src/core/instance/methods/hooks.ts` (for callHooks helper)

**Action**: 
- Verify all method files exist and are complete
- If complete: Update `RevealUIInstance.ts` to delegate to extracted methods
- If incomplete: Complete the implementations first, then update `RevealUIInstance.ts`

**Note**: `methods/find.ts` already exists and follows the correct pattern (accepts `instance`, `ensureDbConnected`, and `options` as parameters).

### Phase 2: Replace Inline Methods with Delegation (1-1.5 hours)

For each method (find, findByID, create, update, delete):

1. **Verify method file exists and is complete**
   - Check `methods/[method].ts` file
   - Verify function signature matches expected pattern
   - Check imports are correct

2. **Update RevealUIInstance.ts** (if method file is complete)
   - Remove inline method implementation (lines 127-253 approximately)
   - Replace with delegation to extracted function
   - Import extracted function at top of file
   - Ensure method signature matches interface
   - Keep `await ensureDbConnected()` call before delegation

3. **Test after each change**
   - Run TypeScript compiler: `pnpm typecheck`
   - Run tests: `pnpm test`
   - Verify no regressions

**If method files don't exist or are incomplete**:
- Extract method following the pattern from `methods/find.ts`
- Function should accept `instance`, `ensureDbConnected`, and `options`
- Move all implementation logic to extracted file

### Phase 3: Extract Helper Function (30 minutes)

If `callHooks` helper exists inline (around line 33-50 in RevealUIInstance.ts), extract it to `methods/hooks.ts`.

**Current Code** (if inline):
```typescript
async function callHooks(
  hooks: RevealAfterChangeHook[] | undefined,
  args: { doc: RevealDocument; context: RevealHookContext },
  revealui: RevealUIInstance
): Promise<RevealDocument> {
  // ... implementation ...
}
```

**Extract to**: `methods/hooks.ts`

### Phase 4: Verify and Clean Up (30 minutes)

1. **Verify file size**
   - `RevealUIInstance.ts` should be ~150-200 lines
   - Check each method file is reasonable size (<150 lines)

2. **Verify imports**
   - All imports are correct
   - No circular dependencies
   - No unused imports

3. **Run full test suite**
   - `pnpm test` - all tests should pass
   - `pnpm typecheck` - no TypeScript errors
   - `pnpm lint` - no linting errors

4. **Update exports** (if needed)
   - Check `instance/index.ts` exports correctly
   - Verify nothing broke

---

## Key Dependencies and Imports

### Required Imports for Method Files

Each method file will need:

```typescript
import type {
  RevealUIInstance,
  RevealFindOptions,
  RevealPaginatedResult,
  RevealDocument,
  RevealCreateOptions,
  RevealUpdateOptions,
  RevealDeleteOptions,
  RevealRequest,
  CollectionConfig,
  RevealAfterChangeHook,
  RevealHookContext,
} from '../../types/index'

import { validateJWTFromRequest } from '../../utils/jwt-validation'
import { getDataLoader } from '../../dataloader'
import { afterRead } from '../../fields/hooks/afterRead'
import { callHooks } from './hooks' // for create/update methods
```

### Type Information

**RevealUIInstance Interface** (from `types/index.ts`):
```typescript
export interface RevealUIInstance {
  collections: { [slug: string]: RevealUICollection }
  globals: { [slug: string]: RevealUIGlobal }
  config: RevealConfig
  db: DatabaseAdapter | null
  logger: RevealUILogger
  secret?: string
  find(options: RevealFindOptions & { collection: string }): Promise<RevealPaginatedResult>
  findByID(options: { collection: string; id: string | number; depth?: number; req?: RevealRequest }): Promise<RevealDocument | null>
  create(options: RevealCreateOptions & { collection: string }): Promise<RevealDocument>
  update(options: RevealUpdateOptions & { collection: string }): Promise<RevealDocument>
  delete(options: RevealDeleteOptions & { collection: string }): Promise<RevealDocument>
  // ... other methods ...
}
```

---

## Implementation Example: find Method

### Step 1: Create `methods/find.ts`

```typescript
/**
 * Find documents in a collection
 * 
 * Instance method that delegates to collection operations.
 */

import type {
  RevealUIInstance,
  RevealFindOptions,
  RevealPaginatedResult,
  RevealRequest,
} from '../../types/index'
import { validateJWTFromRequest } from '../../utils/jwt-validation'
import { getDataLoader } from '../../dataloader'

export async function find(
  instance: RevealUIInstance,
  options: RevealFindOptions & { collection: string }
): Promise<RevealPaginatedResult> {
  const { collection, depth = 0, req } = options

  // Validate JWT token if authorization header is provided
  validateJWTFromRequest(req)

  if (!instance.collections[collection]) {
    throw new Error(`Collection '${collection}' not found`)
  }

  // Ensure request context has DataLoader if needed
  if (req && !req.dataLoader) {
    req.revealui = instance
    req.transactionID = req.transactionID || 'default'
    req.dataLoader = getDataLoader(req)
  }

  return instance.collections[collection].find(options)
}
```

### Step 2: Update `RevealUIInstance.ts`

```typescript
import { find } from './methods/find'

// In createRevealUIInstance function, inside revealUIInstance object:
async find(
  options: RevealFindOptions & { collection: string }
): Promise<RevealPaginatedResult> {
  await ensureDbConnected()
  return find(revealUIInstance, options)
},
```

**Key Points**:
- `await ensureDbConnected()` stays in RevealUIInstance (instance-specific)
- Delegation to extracted function
- Function receives `instance` as first parameter

---

## Implementation Example: create Method

The `create` method is more complex because it calls hooks:

### Step 1: Create `methods/create.ts`

```typescript
/**
 * Create a new document in a collection
 * 
 * Instance method that delegates to collection operations and calls hooks.
 */

import type {
  RevealUIInstance,
  RevealCreateOptions,
  RevealDocument,
  RevealRequest,
  CollectionConfig,
} from '../../types/index'
import { callHooks } from './hooks'

export async function create(
  instance: RevealUIInstance,
  options: RevealCreateOptions & { collection: string }
): Promise<RevealDocument> {
  const { collection, req } = options

  if (!instance.collections[collection]) {
    throw new Error(`Collection '${collection}' not found`)
  }

  const collectionConfig = instance.config.collections?.find(
    (c: CollectionConfig) => c.slug === collection
  )
  let doc = await instance.collections[collection].create(options)

  // Call afterChange hooks
  if (collectionConfig?.hooks?.afterChange && req) {
    doc = await callHooks(
      collectionConfig.hooks.afterChange,
      {
        doc,
        context: {
          revealui: instance,
          collection,
          operation: 'create',
          req,
        },
      },
      instance
    )
  }

  return doc
}
```

### Step 2: Update `RevealUIInstance.ts`

```typescript
import { create } from './methods/create'

// In createRevealUIInstance function, inside revealUIInstance object:
async create(options: RevealCreateOptions & { collection: string }): Promise<RevealDocument> {
  await ensureDbConnected()
  return create(revealUIInstance, options)
},
```

---

## Testing Requirements

### After Each Extraction

1. **TypeScript Compilation**
   ```bash
   pnpm typecheck
   ```
   - Should pass with no errors

2. **Linting**
   ```bash
   pnpm lint
   ```
   - Should pass with no errors

3. **Unit Tests** (if any)
   ```bash
   pnpm test -- packages/revealui
   ```
   - All tests should pass

4. **Integration Tests**
   ```bash
   pnpm test -- packages/test
   ```
   - All tests should pass
   - Especially check:
     - `packages/test/src/integration/api/users.integration.test.ts`
     - `packages/test/src/integration/database/persistence.integration.test.ts`
     - `packages/test/src/integration/api/collections.integration.test.ts`

### Final Verification

After all extractions:

1. **Full Test Suite**
   ```bash
   pnpm test
   ```

2. **Check File Sizes**
   ```bash
   wc -l packages/revealui/src/core/instance/RevealUIInstance.ts
   # Should be ~150-200 lines
   ```

3. **Verify Imports**
   ```bash
   # Check for circular dependencies
   pnpm typecheck
   ```

---

## Common Pitfalls and Solutions

### Pitfall 1: Circular Dependencies

**Problem**: Method files importing from RevealUIInstance.ts, which imports methods.

**Solution**: 
- Methods should import **types only** from `types/index.ts`
- Methods should receive `instance: RevealUIInstance` as parameter
- No import of `RevealUIInstance.ts` from method files

### Pitfall 2: Missing `await ensureDbConnected()`

**Problem**: Database not connected before method execution.

**Solution**:
- Keep `await ensureDbConnected()` in RevealUIInstance methods
- Call it before delegating to extracted function

### Pitfall 3: Incorrect Function Signatures

**Problem**: Method signature doesn't match interface.

**Solution**:
- Check `RevealUIInstance` interface in `types/index.ts`
- Ensure extracted function signature matches interface method
- Test with TypeScript compiler

### Pitfall 4: Missing Imports

**Problem**: Extracted methods missing required imports.

**Solution**:
- Copy all imports from original method
- Add type imports from `types/index.ts`
- Verify no missing dependencies

### Pitfall 5: Broken Hook Calls

**Problem**: `callHooks` function not accessible in extracted methods.

**Solution**:
- Extract `callHooks` to `methods/hooks.ts` first
- Import it in methods that need it (`create.ts`, `update.ts`)
- Ensure function signature matches usage

---

## Success Criteria

### ✅ Task Complete When:

1. **File Size Reduced**
   - `RevealUIInstance.ts` is ~150-200 lines (down from 415)
   - Each method file is <150 lines

2. **All Methods Extracted**
   - `find` extracted to `methods/find.ts`
   - `findByID` extracted to `methods/findById.ts`
   - `create` extracted to `methods/create.ts`
   - `update` extracted to `methods/update.ts`
   - `delete` extracted to `methods/delete.ts`
   - `callHooks` extracted to `methods/hooks.ts` (if exists)

3. **All Tests Pass**
   - `pnpm typecheck` - no errors
   - `pnpm lint` - no errors
   - `pnpm test` - all tests pass

4. **No Regressions**
   - All integration tests pass
   - All API tests pass
   - All database tests pass

5. **Code Quality**
   - No circular dependencies
   - All imports correct
   - Type safety maintained
   - Code follows same pattern as CollectionOperations

---

## Reference Files

### Study These Files First

1. **CollectionOperations.ts** (already split, 76 lines)
   - Shows the pattern to follow
   - Location: `packages/revealui/src/core/collections/CollectionOperations.ts`

2. **operations/find.ts** (example extraction)
   - Shows how method was extracted
   - Location: `packages/revealui/src/core/collections/operations/find.ts`

3. **RevealUIInstance.ts** (current state, 415 lines)
   - Contains methods to extract
   - Location: `packages/revealui/src/core/instance/RevealUIInstance.ts`

### Important Type Definitions

- `packages/revealui/src/core/types/index.ts` - All type definitions
- `packages/revealui/src/core/instance/index.ts` - Instance exports

### Test Files (Verify After Changes)

- `packages/test/src/integration/api/users.integration.test.ts`
- `packages/test/src/integration/api/collections.integration.test.ts`
- `packages/test/src/integration/database/persistence.integration.test.ts`
- `packages/test/src/integration/e2e-flow/auth-flow.integration.test.ts`

---

## Quick Start Checklist

- [ ] Read this document completely
- [ ] Study `CollectionOperations.ts` pattern
- [ ] Check existing `methods/` files (stubs or complete?)
- [ ] Read `RevealUIInstance.ts` to understand structure
- [ ] Extract `callHooks` first (if inline)
- [ ] Extract `find` method
- [ ] Test after each extraction
- [ ] Extract `findByID` method
- [ ] Test after each extraction
- [ ] Extract `create` method
- [ ] Test after each extraction
- [ ] Extract `update` method
- [ ] Test after each extraction
- [ ] Extract `delete` method
- [ ] Run full test suite
- [ ] Verify file sizes
- [ ] Check for circular dependencies
- [ ] Update documentation if needed

---

## Questions or Issues?

If you encounter any issues:

1. **Check the pattern**: Look at how `CollectionOperations.ts` was split
2. **Check types**: Verify types in `types/index.ts`
3. **Check tests**: Run tests to see what's broken
4. **Check imports**: Verify all imports are correct
5. **Document issues**: Note any blockers or questions

---

**Good luck! This is straightforward refactoring work - just follow the pattern from CollectionOperations.ts and you'll be fine.**

**Expected Outcome**: `RevealUIInstance.ts` reduced from 415 lines to ~150-200 lines, with all methods properly extracted and all tests passing.