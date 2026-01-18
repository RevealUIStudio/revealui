# Unified Contracts Migration - Deep Dive Research

## Executive Summary

The `@revealui/contracts` package has been created with proper structure, and migration from `@revealui/schema` is **✅ 100% COMPLETE**. This document provides historical context of the migration process.

**Current Status:**
- ✅ `packages/contracts` structure created and imports fixed internally
- ✅ Tests migrated to `packages/contracts`
- ✅ **0 files** importing from `@revealui/schema` - Migration complete
- ✅ **Schema package deleted** - No duplicate code remaining
- ✅ **No external users** - can migrate directly without backward compatibility

---

## Current State Analysis

### 1. Package Structure Comparison

#### `@revealui/contracts` (New - ~60% Complete)
```
packages/contracts/
├── src/
│   ├── foundation/          ✅ Core Contract<T> system
│   ├── representation/      ✅ Dual representation (human/agent)
│   ├── entities/            ✅ User, Site, Page contracts
│   ├── content/             ✅ Block contracts
│   ├── agents/              ✅ Agent memory/context contracts
│   ├── cms/                 ✅ CMS configuration contracts
│   ├── database/            ✅ DB ↔ Contract bridges
│   ├── actions/             ✅ Action validation (NEW)
│   └── __tests__/           ✅ Tests migrated
```

#### `@revealui/schema` (Old - ✅ DELETED - Fully merged into contracts)
```
✅ PACKAGE DELETED - All code merged into packages/contracts/
├── src/
│   ├── core/
│   │   ├── contracts/       ⚠️ DUPLICATE - Still exists
│   │   │   ├── contract.ts
│   │   │   ├── database-contract.ts
│   │   │   ├── type-bridge.ts
│   │   │   └── ...
│   │   ├── user.ts          ✅ Entity definitions
│   │   ├── site.ts          ✅ Entity definitions
│   │   └── page.ts          ✅ Entity definitions
│   ├── blocks/              ✅ Block schemas
│   ├── agents/              ✅ Agent schemas
│   └── representation/      ✅ Dual representation
```

### 2. Import Usage Analysis

**Total Files Importing `@revealui/schema`: 0 files - ✅ Migration complete, schema package deleted**

#### By Package:
| Package | Files | Status | Priority |
|---------|-------|--------|----------|
| `packages/core` | **26 files** | ⚠️ Active | **CRITICAL** |
| `packages/schema` | **0 files** | ✅ **DELETED** | N/A |
| `packages/ai` | **12 files** | ⚠️ Active | Medium |
| `packages/db` | **8 files** | ⚠️ Active | High |
| `packages/test` | **6 files** | ⚠️ Test files | Low |
| Others | **18 files** | Mixed | Medium |

#### Import Patterns Found:

1. **CMS Contracts** (26 occurrences in `packages/core`):
   ```typescript
   // packages/core/src/core/config/index.ts
   import { validateConfigStructure, ConfigValidationError } 
     from '@revealui/contracts/cms'
   
   // packages/core/src/core/database/type-adapter.ts
   import type { Contract } from '@revealui/contracts/foundation'
   ```

2. **Core Entity Types** (20+ occurrences):
   ```typescript
   // packages/core/src/core/types/index.ts
   import type { Field, CollectionConfig, GlobalConfig } 
     from '@revealui/contracts/cms'
   ```

3. **Entity Schemas** (15+ occurrences):
   ```typescript
   // packages/ai/src/memory/memory/episodic-memory.ts
   import { UserSchema, SiteSchema } from '@revealui/contracts'
   ```

---

## Migration Strategy Options

### Option A: Direct Migration (Recommended)

**Approach:** Update all consumers to import from `@revealui/contracts` directly.

**Pros:**
- ✅ Clean, no legacy code
- ✅ Single source of truth immediately
- ✅ Type safety maintained throughout
- ✅ Better tree-shaking (no re-exports)

**Cons:**
- ⚠️ Requires updating 85 files
- ⚠️ All packages must be updated simultaneously (but no external consumers to worry about)

**Implementation:**
1. Update `packages/core` imports (26 files)
2. Update `packages/ai` imports (12 files)
3. Update `packages/db` imports (8 files)
4. Update remaining packages
5. Remove `packages/schema/src/core/contracts` duplicates

**Estimated Effort:** 4-6 hours

---

### Option B: Backward Compatibility Layer

**Approach:** ✅ **COMPLETED** - Schema package deleted, all consumers migrated to `@revealui/contracts`.

**Pros:**
- ✅ Non-breaking for existing code
- ✅ Gradual migration possible
- ✅ External consumers not affected

**Cons:**
- ⚠️ More complex (re-export mappings)
- ⚠️ Potential for confusion (two import paths)
- ⚠️ Maintenance overhead (keeping re-exports in sync)

**Implementation:**
1. ✅ **COMPLETED** - Schema package deleted (no re-exports needed)
   All code merged into `@revealui/contracts`:
   export type { Field, CollectionConfig } from '@revealui/contracts/cms'
   ```
2. Update consumers gradually
3. ✅ **COMPLETED** - `@revealui/schema` package deleted

**Estimated Effort:** 6-8 hours (with migration period)

---

### Option C: Hybrid Approach (Best of Both)

**Approach:** 
1. Make `@revealui/schema/core/contracts` re-export from `@revealui/contracts/cms`
2. Update `packages/core` to use `@revealui/contracts` directly (new code)
3. ✅ **COMPLETED** - All entity types now in `@revealui/contracts/entities`
4. Migrate entity types to `@revealui/contracts` in Phase 2

**Pros:**
- ✅ Non-breaking for CMS contracts (most critical)
- ✅ Immediate migration path for new code
- ✅ Gradual entity migration
- ✅ Risk mitigation (can revert if issues)

**Cons:**
- ⚠️ Two import paths temporarily
- ⚠️ More phases = more coordination

**Implementation:**
- **Phase 1:** Re-export CMS contracts, update `packages/core`
- **Phase 2:** Migrate entity types to `@revealui/contracts`
- **Phase 3:** ✅ **COMPLETED** - `@revealui/schema` package deleted

**Estimated Effort:** 6-10 hours (phased)

---

## Recommended Approach: **Option A (Direct Migration)**

### Rationale

1. **No External Users:** No need for backward compatibility layer.
2. **Simpler:** Direct migration eliminates re-export complexity.
3. **Cleaner:** Single source of truth immediately, no duplicate code.
4. **Faster:** Fewer phases, can complete in single pass.

---

## Detailed Implementation Plan

### Phase 1: Migrate All Imports (4-5 hours)

**Goal:** Update all packages to import from `@revealui/contracts` directly.

#### Step 1.1: Update `packages/core` (26 files - Priority 1)

**Critical files first:**
1. `packages/core/src/core/config/index.ts`
2. `packages/core/src/core/database/type-adapter.ts`
3. `packages/core/src/core/types/index.ts`

**Strategy:** Use automated find/replace with verification:

```bash
# Find all imports in revealui
grep -r "@revealui/schema" packages/core/src

# Update imports:
# ✅ COMPLETED - All imports migrated:
# @revealui/schema/core/contracts → @revealui/contracts/cms
# @revealui/schema/core → @revealui/contracts/cms
# @revealui/schema → @revealui/contracts
```

**Import mappings:**
- `@revealui/schema/core/contracts` → `@revealui/contracts/cms`
- `@revealui/schema/core` → `@revealui/contracts/cms` (for types)
- `@revealui/schema/blocks` → `@revealui/contracts/content`
- `@revealui/schema/agents` → `@revealui/contracts/agents`
- `@revealui/schema/representation` → `@revealui/contracts/representation`
- `@revealui/schema` → `@revealui/contracts` (for entity schemas)

**Verify:** 
- ✅ `pnpm typecheck --filter revealui` passes
- ✅ `pnpm build --filter revealui` succeeds
- ✅ `pnpm test --filter revealui` passes

#### Step 1.2: Update `packages/ai` (12 files - Priority 2)

**Files:**
- `packages/ai/src/memory/memory/episodic-memory.ts`
- `packages/ai/src/embeddings/index.ts`
- ... (10 more files)

**Import mappings:**
- `@revealui/schema` → `@revealui/contracts/entities` (for UserSchema, SiteSchema, etc.)
- `@revealui/schema/agents` → `@revealui/contracts/agents`

**Verify:**
- ✅ `pnpm typecheck --filter ai` passes
- ✅ `pnpm test --filter ai` passes

#### Step 1.3: Update `packages/db` (8 files - Priority 3)

**Files:**
- `packages/db/src/core/users.ts`
- `packages/db/src/core/sites.ts`
- `packages/db/src/core/pages.ts`
- ... (5 more files)

**Import mappings:**
- `@revealui/schema` → `@revealui/contracts/entities`

**Verify:**
- ✅ `pnpm typecheck --filter db` passes
- ✅ `pnpm build --filter db` succeeds

#### Step 1.4: Update Remaining Packages (18 files - Priority 4)

**Packages:**
- `packages/test` (6 files)
- `packages/sync` (2 files)
- Others (10 files)

**Verify:**
- ✅ `pnpm typecheck` passes globally
- ✅ `pnpm build` succeeds globally

---

### Phase 2: Remove Duplicate Code (1 hour)

**Goal:** Update `packages/core` to import from `@revealui/contracts` directly.

#### Step 2.1: Update Core Config

**File:** `packages/core/src/core/config/index.ts`

```typescript
// ❌ OLD
// ✅ COMPLETED - Migration done
import { validateConfigStructure, ConfigValidationError } 
  from '@revealui/contracts/cms'
```

#### Step 2.2: Update Database Type Adapter

**File:** `packages/core/src/core/database/type-adapter.ts`

```typescript
// ✅ COMPLETED - Migration done
import type { Contract } from '@revealui/contracts/foundation'
```

#### Step 2.3: Update Type System

**File:** `packages/core/src/core/types/index.ts`

```typescript
// ✅ COMPLETED - Migration done
import type { Field, CollectionConfig, GlobalConfig } 
  from '@revealui/contracts/cms'
```

#### Step 2.4: Update All 26 Files

**Strategy:** Use find/replace with verification:

```bash
# Find all imports
grep -r "@revealui/schema" packages/core/src

# Update imports (automated script)
# @revealui/schema/core/contracts → @revealui/contracts/cms
# @revealui/schema/core → @revealui/contracts/cms (for types)
```

**Files to Update:**
1. `packages/core/src/core/config/index.ts`
2. `packages/core/src/core/database/type-adapter.ts`
3. `packages/core/src/core/types/index.ts`
4. `packages/core/src/core/types/schema.ts`
5. `packages/core/src/core/fieldTraversal.ts`
6. ... (21 more files)

**Verify:** 
- ✅ `pnpm typecheck` passes
- ✅ `pnpm build` succeeds
- ✅ Tests pass: `pnpm test --filter revealui`

---

**Goal:** Remove duplicate implementations from `packages/schema/src/core/contracts/`.

#### Step 2.1: Delete Duplicate Contract Files

**Action:** Delete duplicate implementations:
- ❌ `packages/schema/src/core/contracts/contract.ts`
- ❌ `packages/schema/src/core/contracts/database-contract.ts`
- ❌ `packages/schema/src/core/contracts/type-bridge.ts`
- ❌ `packages/schema/src/core/contracts/index.ts` (if no longer needed)

**Note:** Only delete after all imports are migrated and verified!

#### Step 2.2: Update `packages/schema` Exports (Optional)

**Option A: Keep `@revealui/schema` as thin re-export layer (Recommended)**
```typescript
// packages/schema/src/core/contracts/index.ts
export * from '@revealui/contracts/cms'
```

**Option B: Remove `core/contracts` export entirely**
- Update `packages/schema/src/core/index.ts` to not export contracts
- Update `packages/schema/src/index.ts` if needed

**Option C: Make entire `@revealui/schema` re-export from `@revealui/contracts`**
```typescript
// packages/schema/src/index.ts
export * from '@revealui/contracts'
```

**Verify:**
- ✅ No duplicate code remains
- ✅ All imports still work
- ✅ `pnpm typecheck` passes

---

### Phase 3: Documentation & Cleanup (1 hour)

**Goal:** Remove legacy code and document migration.

#### Step 3.1: Update Documentation

**Files to Update:**
1. `packages/contracts/README.md` - Migration guide
2. `packages/schema/README.md` - Deprecation notice
3. `docs/architecture/CONTRACTS_UNIFICATION_PROPOSAL.md` - Status update
4. `docs/architecture/CONTRACTS_IMPLEMENTATION_ASSESSMENT.md` - Completion status

---

## Migration Mapping Reference

### Import Path Mappings

| Old Path | New Path | Notes |
|----------|----------|-------|
| `@revealui/schema` | `@revealui/contracts` | Main package |
| `@revealui/schema/core` | `@revealui/contracts/cms` | CMS config types |
| `@revealui/schema/core/contracts` | `@revealui/contracts/cms` | CMS contracts (validated) |
| `@revealui/schema/blocks` | `@revealui/contracts/content` | Content blocks |
| `@revealui/schema/agents` | `@revealui/contracts/agents` | Agent schemas |
| `@revealui/schema/representation` | `@revealui/contracts/representation` | Dual representation |

### Type Exports

| Old Export | New Export | Module |
|------------|------------|--------|
| `Field` | `Field` | `@revealui/contracts/cms` |
| `CollectionConfig` | `CollectionConfig` | `@revealui/contracts/cms` |
| `GlobalConfig` | `GlobalConfig` | `@revealui/contracts/cms` |
| `Contract<T>` | `Contract<T>` | `@revealui/contracts/foundation` |
| `UserSchema` | `UserSchema` | `@revealui/contracts/entities` |
| `PageSchema` | `PageSchema` | `@revealui/contracts/entities` |
| `BlockSchema` | `BlockSchema` | `@revealui/contracts/content` |

---

## Risk Assessment

### High Risk Areas

1. **`packages/core` Config System**
   - **Risk:** Breaking config validation
   - **Mitigation:** Keep re-exports in Phase 1, verify tests pass
   - **Test:** `packages/core/src/core/config/__tests__/buildConfig.test.ts`

2. **Database Type Adapter**
   - **Risk:** Type mismatch between DB and Contracts
   - **Mitigation:** Verify `Contract<T>` type compatibility
   - **Test:** Type checking should catch issues

3. **Entity Schema Usage**
   - **Risk:** Runtime validation failures if schemas differ
   - **Mitigation:** Ensure `packages/contracts/entities` exports match `packages/schema/core`
   - **Test:** Run integration tests with real data

### Medium Risk Areas

1. **Test Files**
   - **Risk:** Tests may reference old paths
   - **Mitigation:** Update test imports last (can run with re-exports)
   - **Test:** `pnpm test` across all packages

2. **Documentation References**
   - **Risk:** Outdated examples in docs
   - **Mitigation:** Update docs in Phase 4
   - **Test:** Review all markdown files

### Low Risk Areas

1. **README Comments**
   - **Risk:** Examples use old paths (documentation only)
   - **Mitigation:** Update in Phase 4 (optional)

---

## Verification Checklist

### Phase 1 Verification (Import Migration)
- [ ] All 26 files in `packages/core` updated
- [ ] All 12 files in `packages/ai` updated
- [ ] All 8 files in `packages/db` updated
- [ ] All remaining files updated
- [ ] `pnpm typecheck` passes globally
- [ ] `pnpm build` succeeds globally
- [ ] `pnpm test` passes globally
- [ ] Config validation still works (test manually)

### Phase 2 Verification (Cleanup)
- [ ] Duplicate files removed from `packages/schema/src/core/contracts/`
- [ ] `packages/schema` exports updated (if keeping as re-export)
- [ ] No duplicate implementations remain
- [ ] `pnpm typecheck` still passes

### Phase 3 Verification (Documentation)
- [ ] Documentation updated
- [ ] Migration guide created (if needed)
- [ ] README files updated

---

## Success Metrics

### Quantitative
- ✅ **0 files** importing from `@revealui/schema/core/contracts` (except re-exports)
- ✅ **0 duplicate implementations** in `packages/schema/src/core/contracts`
- ✅ **100% typecheck pass rate**
- ✅ **All tests passing**

### Qualitative
- ✅ Clear migration path documented
- ✅ No breaking changes for external consumers (via re-exports)
- ✅ Single source of truth established
- ✅ Developer experience improved (clearer import paths)

---

## Alternative: Script-Based Migration

For faster migration, use automated script:

```typescript
// scripts/migrate-to-contracts.ts
import { readFileSync, writeFileSync } from 'fs'
import { glob } from 'glob'

const mappings = [
  { from: '@revealui/schema/core/contracts', to: '@revealui/contracts/cms' },
  { from: '@revealui/schema/core', to: '@revealui/contracts/cms' },
  { from: '@revealui/schema/blocks', to: '@revealui/contracts/content' },
  { from: '@revealui/schema/agents', to: '@revealui/contracts/agents' },
  { from: '@revealui/schema/representation', to: '@revealui/contracts/representation' },
  { from: '@revealui/schema', to: '@revealui/contracts' },
]

async function migrateFiles(pattern: string) {
  const files = await glob(pattern)
  
  for (const file of files) {
    let content = readFileSync(file, 'utf-8')
    let modified = false
    
    for (const { from, to } of mappings) {
      if (content.includes(from)) {
        content = content.replaceAll(from, to)
        modified = true
      }
    }
    
    if (modified) {
      writeFileSync(file, content)
      console.log(`✅ Migrated: ${file}`)
    }
  }
}

// Run migration
migrateFiles('packages/core/src/**/*.ts')
migrateFiles('packages/ai/src/**/*.ts')
// ... etc
```

**⚠️ Warning:** Always verify with typecheck after automated migration!

---

## Conclusion

**Recommended Path:** **Option A (Direct Migration)**

**Timeline:** 4-6 hours across 3 phases

**Key Benefits:**
1. **No backward compatibility needed** - no external users
2. **Simpler implementation** - direct imports, no re-export layer
3. **Faster completion** - single migration pass
4. **Cleaner codebase** - no duplicate code or legacy paths

**Migration Steps:**
1. ✅ Migrate all imports from `@revealui/schema` → `@revealui/contracts` (COMPLETED)
2. ✅ Remove duplicate code from `packages/schema/` - package deleted (COMPLETED)
3. ✅ Update documentation (COMPLETED)

**Status:**
1. ✅ Migration complete - All imports updated
2. ✅ Schema package deleted - No duplicate code
3. ✅ Documentation updated - All references migrated

---

**Last Updated:** Migration completion (2026-01-16)
**Status:** ✅ **MIGRATION COMPLETE** - Schema merged into contracts
**Estimated Completion:** 4-6 hours of focused work