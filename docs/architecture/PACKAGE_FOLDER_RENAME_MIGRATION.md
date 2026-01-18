# Package Folder Rename Migration: `packages/core` → `packages/core`

**Date:** 2025-01-27  
**Status:** 📋 **MIGRATION ANALYSIS COMPLETE**

---

## Executive Summary

**Current State:**
- **Folder:** `packages/core/`
- **Package Name:** `@revealui/core` ✅ (already correct)
- **Internal Structure:** `packages/core/src/core/`

**Proposed Change:**
- **Folder:** `packages/core/`
- **Package Name:** `@revealui/core` (no change)
- **Internal Structure:** `packages/core/src/` (core directory moves to root)

**Critical Issue:** **Naming Collision with "core" exports**
- `@revealui/db` exports `./core` subpath
- `@revealui/services` exports `./core` subpath
- After migration, folder name `packages/core/` may conflict with these subpath exports

---

## Current State Analysis

### Package Structure

```
packages/
├── revealui/          ← FOLDER NAME (needs rename)
│   ├── package.json   → name: "@revealui/core" ✅
│   └── src/
│       └── core/      ← Internal "core" directory
│           └── index.ts
├── db/
│   ├── package.json   → exports: { "./core": ... }
│   └── src/
│       └── core/      ← Exported as @revealui/db/core
├── services/
│   ├── package.json   → exports: { "./core": ... }
│   └── src/
│       └── core/      ← Exported as services/core
```

### Package Exports Analysis

#### 1. `@revealui/core` (packages/core)
```json
{
  "name": "@revealui/core",
  "exports": {
    ".": "./dist/index.js",
    "./core": "./dist/core/index.js",    ← Internal core subpath
    "./client": "./dist/client/index.js",
    "./types": "./dist/core/types/index.js",
    ...
  }
}
```

#### 2. `@revealui/db`
```json
{
  "name": "@revealui/db",
  "exports": {
    ".": "./dist/index.js",
    "./core": "./dist/core/index.js",    ← Collision risk!
    "./client": "./dist/client/index.js",
    "./core/agents": "./dist/core/agents.js",
    ...
  }
}
```

#### 3. `services` (not @revealui/services)
```json
{
  "name": "services",
  "exports": {
    ".": "./src/index.ts",
    "./core": "./src/core/index.ts",     ← Collision risk!
    "./client": "./src/client/index.ts"
  }
}
```

---

## Naming Collision Analysis

### Collision Risk: LOW ✅

**Why collisions are acceptable:**

1. **Different package names** - Exports are namespaced:
   - `@revealui/core` → RevealUI core framework's internal core
   - `@revealui/db/core` → Database schema core
   - `services/core` → Services server-side core

2. **Different purposes**:
   - `@revealui/core` → Framework core functionality
   - `@revealui/db/core` → Database schema definitions
   - `services/core` → Stripe/Supabase integrations

3. **TypeScript/bundlers handle it** - Module resolution uses package names, not folder names

**However:** After renaming folder to `packages/core/`, there's potential confusion:
- Developer might expect `packages/core/` to export `@revealui/core`
- But `@revealui/core` already exists and points to internal `src/core/`

---

## Migration Options

### **Option 1: Simple Folder Rename (Recommended)** ✅

**Approach:** Rename folder only, keep all exports unchanged

**Changes:**
- `packages/core/` → `packages/core/`
- All exports remain: `@revealui/core` still points to `src/core/`
- No export consolidation needed

**Pros:**
- ✅ Minimal changes
- ✅ No breaking changes
- ✅ Fast migration
- ✅ Existing exports continue to work

**Cons:**
- ⚠️ Folder name `packages/core/` but export is `@revealui/core` (confusing)
- ⚠️ Doesn't resolve "core" naming collision

**Migration Complexity:** 🟢 **LOW** (mostly path updates)

---

### **Option 2: Folder Rename + Export Consolidation** ⚠️

**Approach:** Rename folder AND consolidate "core" exports

**Changes:**
1. `packages/core/` → `packages/core/`
2. Move `packages/core/src/core/` → `packages/core/src/` (flatten)
3. Remove `./core` export from `@revealui/core/package.json`
4. Main export `.` becomes the core functionality

**Package.json Changes:**
```json
// BEFORE
{
  "exports": {
    ".": "./dist/index.js",
    "./core": "./dist/core/index.js",    ← REMOVE
    "./client": "./dist/client/index.js"
  }
}

// AFTER
{
  "exports": {
    ".": "./dist/index.js",             ← Now IS the core
    "./client": "./dist/client/index.js"
  }
}
```

**Pros:**
- ✅ Folder name matches package purpose (`packages/core/` = core package)
- ✅ Simpler exports (no `@revealui/core`)
- ✅ Main export `.` is the core

**Cons:**
- ❌ **Breaking change** - `@revealui/core` import will break
- ❌ Requires updating all imports from `@revealui/core` → `@revealui/core`
- ❌ Higher migration complexity

**Migration Complexity:** 🟡 **MEDIUM** (path updates + import updates)

**Breaking Changes:**
- `import { ... } from '@revealui/core'` → `import { ... } from '@revealui/core'`
- `import { ... } from '@revealui/core/...'` → `import { ... } from '@revealui/core/...'`

---

### **Option 3: Folder Rename + Rename Other "core" Exports** 🔴

**Approach:** Rename folder AND rename conflicting "core" exports in other packages

**Changes:**
1. `packages/core/` → `packages/core/`
2. `@revealui/db/core` → `@revealui/db/schema` (rename export)
3. `services/core` → `services/server` (rename export)

**Pros:**
- ✅ Eliminates all "core" naming collisions
- ✅ Clearer export names (`schema`, `server`)

**Cons:**
- ❌ **Multiple breaking changes** across all packages
- ❌ Highest migration complexity
- ❌ Requires updating imports in many files

**Migration Complexity:** 🔴 **HIGH** (path updates + multiple package export renames + import updates)

**Breaking Changes:**
- `import { ... } from '@revealui/db/core'` → `import { ... } from '@revealui/db/schema'`
- `import { ... } from 'services/core'` → `import { ... } from 'services/server'`

---

### **Option 4: Keep Folder as-is, Only Internal Refactoring** ⚠️

**Approach:** Keep `packages/core/` folder, but rename internal `src/core/` to `src/framework/`

**Changes:**
- Keep folder: `packages/core/`
- Rename: `packages/core/src/core/` → `packages/core/src/framework/`
- Update: `./core` export → `./framework` export

**Pros:**
- ✅ No folder rename needed
- ✅ Eliminates internal "core" naming

**Cons:**
- ❌ Doesn't address folder naming issue
- ❌ Still have `@revealui/core` export (confusing)

**Migration Complexity:** 🟡 **MEDIUM** (export path updates + internal refactor)

---

## Recommended Approach: **Option 1** (Simple Folder Rename)

### Rationale

1. **Minimal risk** - Only path references change, no import changes
2. **No breaking changes** - All exports continue to work
3. **Fast migration** - Mostly automated path updates
4. **Acceptable naming** - Folder name `core` is descriptive even if export is `@revealui/core`

### Migration Steps

#### Phase 1: Folder Rename

1. **Rename folder:**
   ```bash
   git mv packages/core packages/core
   ```

#### Phase 2: Update Path References

2. **Update TypeScript config paths:**
   - `tsconfig.json`
   - `apps/*/tsconfig.json`
   - `packages/*/tsconfig.json`
   - `packages/dev/src/ts/reveal.json`

3. **Update Vite config paths:**
   - `packages/dev/src/vite/vite.shared.ts`
   - `apps/*/vite.config.ts`
   - `packages/*/vite.config.ts`

4. **Update Turbo config:**
   - `turbo.json` (task names, outputs)

5. **Update documentation:**
   - All `.md` files referencing `packages/core`

6. **Update scripts:**
   - Any scripts with hardcoded `packages/core` paths

#### Phase 3: Verify

7. **Run typecheck:**
   ```bash
   pnpm typecheck:all
   ```

8. **Run build:**
   ```bash
   pnpm build:packages
   ```

9. **Run tests:**
   ```bash
   pnpm test
   ```

---

## Detailed Migration Checklist

### Files Requiring Updates

#### TypeScript Configs (15 files)
- [ ] `tsconfig.json` (root)
- [ ] `apps/cms/tsconfig.json`
- [ ] `apps/web/tsconfig.json`
- [ ] `apps/docs/tsconfig.json`
- [ ] `packages/core/tsconfig.json` → `packages/core/tsconfig.json`
- [ ] `packages/contracts/tsconfig.json`
- [ ] `packages/db/tsconfig.json`
- [ ] `packages/auth/tsconfig.json`
- [ ] `packages/ai/tsconfig.json`
- [ ] `packages/sync/tsconfig.json`
- [ ] `packages/services/tsconfig.json`
- [ ] `packages/test/tsconfig.json`
- [ ] `packages/config/tsconfig.json`
- [ ] `packages/dev/tsconfig.json`
- [ ] `packages/dev/src/ts/reveal.json`

#### Vite Configs (5+ files)
- [ ] `packages/dev/src/vite/vite.shared.ts`
- [ ] `apps/cms/vite.config.ts`
- [ ] `apps/web/vite.config.ts`
- [ ] `packages/services/vite.config.ts`
- [ ] `packages/test/vite.config.ts`

#### Build Configs (2 files)
- [ ] `turbo.json`
- [ ] `package.json` (root - build scripts)

#### Documentation (89+ files)
- [ ] All `.md` files in `docs/`
- [ ] `README.md` files
- [ ] `.cursorrules` / `.cursor/rules.md`

#### Scripts (10+ files)
- [ ] `scripts/types/copy-generated-types.ts`
- [ ] Any scripts with `packages/core` paths

---

## Path Reference Patterns

### Patterns to Find & Replace

**Find:**
```typescript
// TypeScript paths
"../../packages/core/src"
"../../packages/core/dist"
"packages/core/src"
"packages/core/dist"

// Vite aliases
path.resolve(packagesRoot, 'revealui/src')

// Scripts/docs
packages/core
```

**Replace:**
```typescript
// TypeScript paths
"../../packages/core/src"
"../../packages/core/dist"
"packages/core/src"
"packages/core/dist"

// Vite aliases
path.resolve(packagesRoot, 'core/src')

// Scripts/docs
packages/core
```

---

## Testing Strategy

### Pre-Migration

1. ✅ Document all current imports
2. ✅ Run full test suite
3. ✅ Verify builds succeed

### Post-Migration

1. ✅ TypeScript typecheck passes
2. ✅ All builds succeed
3. ✅ All tests pass
4. ✅ No import errors
5. ✅ No runtime errors

---

## Risk Assessment

### Low Risk ✅
- TypeScript path resolution (mostly automated)
- Build scripts (straightforward replacements)
- Documentation (non-breaking)

### Medium Risk ⚠️
- Vite config aliases (need careful testing)
- Turbo config (task names may break CI)
- Package.json workspace references (pnpm handles automatically)

### High Risk 🔴
- **None** if using Option 1 (simple folder rename)

---

## Alternative: Option 2 (Export Consolidation)

If you want to eliminate `@revealui/core` export:

### Additional Steps for Option 2

1. **Flatten directory structure:**
   ```bash
   # Move core contents to root
   mv packages/core/src/core/* packages/core/src/
   rmdir packages/core/src/core
   ```

2. **Update package.json exports:**
   ```json
   {
     "exports": {
       ".": "./dist/index.js",
       // REMOVE "./core": "./dist/core/index.js"
       "./client": "./dist/client/index.js",
       "./types": "./dist/types/index.js"  // Update path
     }
   }
   ```

3. **Update all imports:**
   ```typescript
   // BEFORE
   import { ... } from '@revealui/core'
   import { ... } from '@revealui/core/config'
   
   // AFTER
   import { ... } from '@revealui/core'
   import { ... } from '@revealui/core/config'
   ```

4. **Update TypeScript paths:**
   - Remove `@revealui/core` paths
   - Update `@revealui/core/types` paths (if moved)

### Breaking Changes (Option 2)

**Files affected:** ~100+ files (need to search for `@revealui/core` imports)

**Migration script needed:**
```bash
# Find all files importing from @revealui/core
grep -r "from '@revealui/core" packages/ apps/ --files-with-matches
```

---

## Recommendation Summary

### **Option 1: Simple Folder Rename** ✅ (Recommended)

**Complexity:** 🟢 Low  
**Breaking Changes:** ❌ None  
**Migration Time:** ~2-4 hours  
**Risk:** 🟢 Low

**When to use:**
- You want quick migration
- You can accept `@revealui/core` export name
- You don't want to break existing imports

---

### **Option 2: Folder Rename + Export Consolidation** ⚠️

**Complexity:** 🟡 Medium  
**Breaking Changes:** ✅ Yes (`@revealui/core` → `@revealui/core`)  
**Migration Time:** ~1-2 days  
**Risk:** 🟡 Medium

**When to use:**
- You want cleaner exports (no `core/core`)
- You're okay with breaking changes
- You can update all imports

---

## Decision Matrix

| Factor | Option 1 | Option 2 | Option 3 | Option 4 |
|--------|----------|----------|----------|----------|
| **Complexity** | 🟢 Low | 🟡 Medium | 🔴 High | 🟡 Medium |
| **Breaking Changes** | ❌ None | ✅ Yes | ✅ Yes | ✅ Yes |
| **Migration Time** | 2-4h | 1-2d | 2-3d | 1-2d |
| **Risk** | 🟢 Low | 🟡 Medium | 🔴 High | 🟡 Medium |
| **Naming Clarity** | ⚠️ Medium | ✅ High | ✅ High | ⚠️ Medium |

---

## Next Steps

1. **Review options** and decide on approach
2. **Create migration branch:** `git checkout -b rename/packages-revealui-to-core`
3. **Execute migration** based on chosen option
4. **Test thoroughly** before merging
5. **Update documentation** after migration

---

**Last Updated:** 2025-01-27  
**Status:** Ready for Decision
