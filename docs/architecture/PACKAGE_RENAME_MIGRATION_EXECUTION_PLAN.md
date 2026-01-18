# Package Rename Migration: Option 3 + Export Consolidation - Execution Plan

**Date:** 2025-01-27  
**Status:** 📋 **EXECUTION PLAN READY**

---

## Migration Scope

**Combined Approach: Option 3 + Export Consolidation**

1. ✅ Rename folder: `packages/core/` → `packages/core/`
2. ✅ Flatten structure: `packages/core/src/core/` → `packages/core/src/`
3. ✅ Remove `./core` export from `@revealui/core`
4. ✅ Rename `@revealui/db/core` → `@revealui/db/schema`
5. ✅ Rename `services/core` → `services/server`

---

## Impact Analysis

**Files affected:**
- **43 files** with imports from `@revealui/core`, `@revealui/db/core`, or `services/core`
- **149 total matches** across 53 files (some files have multiple imports)
- **90+ configuration files** (tsconfig, vite, turbo, etc.)
- **89+ documentation files**

**Breaking Changes:**
- `@revealui/core` → `@revealui/core` (43 files)
- `@revealui/db/core` → `@revealui/db/schema` (~30 files)
- `services/core` → `services/server` (~10 files)

---

## Migration Phases

### Phase 1: Prepare (Pre-Migration)

1. **Create migration branch**
2. **Backup current state**
3. **Document current imports**
4. **Run full test suite** (baseline)

### Phase 2: Folder & Structure Changes

1. **Rename folder:** `packages/core/` → `packages/core/`
2. **Flatten internal structure:** `src/core/` → `src/`
3. **Update package.json exports** (all packages)

### Phase 3: Update Imports (Automated)

1. **Update `@revealui/core` imports** → `@revealui/core`
2. **Update `@revealui/db/core` imports** → `@revealui/db/schema`
3. **Update `services/core` imports** → `services/server`

### Phase 4: Update Configuration Files

1. **TypeScript configs** (15 files)
2. **Vite configs** (5+ files)
3. **Turbo config** (1 file)
4. **Package.json scripts** (root + packages)

### Phase 5: Update Documentation

1. **Markdown files** (89+ files)
2. **README files**
3. **Rules/config files**

### Phase 6: Verify & Test

1. **TypeScript typecheck**
2. **Build all packages**
3. **Run full test suite**
4. **Manual verification**

---

## Detailed Execution Steps

### Phase 1: Prepare

```bash
# 1. Create migration branch
git checkout -b migrate/rename-revealui-to-core

# 2. Document current state (optional)
git log --oneline > migration-baseline.log

# 3. Run baseline tests
pnpm test
pnpm typecheck:all
pnpm build:packages
```

---

### Phase 2: Folder & Structure Changes

#### Step 2.1: Rename Folder

```bash
# Rename folder using git mv (preserves history)
git mv packages/core packages/core
```

#### Step 2.2: Flatten Internal Structure

```bash
# Move core contents to root
cd packages/core/src
mv core/* .
rmdir core

# Update any internal imports that reference ./core/
# (Will be handled in Phase 3)
```

#### Step 2.3: Update Package.json Exports

**File: `packages/core/package.json`**

```json
{
  "exports": {
    ".": "./dist/index.js",
    // REMOVE: "./core": "./dist/core/index.js"
    "./client": "./dist/client/index.js",
    "./types": "./dist/types/index.js",  // Update path from ./dist/core/types
    "./types/core": "./dist/types/core.d.ts",  // Update path
    "./types/schema": "./dist/types/schema.d.ts",  // Update path
    // ... update all other paths that reference ./dist/core/
  }
}
```

**File: `packages/db/package.json`**

```json
{
  "exports": {
    ".": "./dist/index.js",
    // RENAME: "./core" → "./schema"
    "./schema": "./dist/core/index.js",  // Keep internal path, change export name
    "./client": "./dist/client/index.js",
    "./schema/agents": "./dist/core/agents.js",  // Update from ./core/agents
    // ... update all ./core/* paths to ./schema/*
  }
}
```

**File: `packages/services/package.json`**

```json
{
  "exports": {
    ".": "./src/index.ts",
    // RENAME: "./core" → "./server"
    "./server": "./src/core/index.ts",  // Keep internal path, change export name
    "./client": "./src/client/index.ts"
  }
}
```

---

### Phase 3: Update Imports (Automated Scripts)

#### Step 3.1: Update `@revealui/core` → `@revealui/core`

**Find & Replace Pattern:**
```typescript
// BEFORE
import { ... } from '@revealui/core'
import { ... } from '@revealui/core/config'
import { ... } from '@revealui/core/...'

// AFTER
import { ... } from '@revealui/core'
import { ... } from '@revealui/core/config'
import { ... } from '@revealui/core/...'
```

**Files to update (43 files):**
- See grep results for complete list

#### Step 3.2: Update `@revealui/db/core` → `@revealui/db/schema`

**Find & Replace Pattern:**
```typescript
// BEFORE
import { ... } from '@revealui/db/core'
import { ... } from '@revealui/db/core/agents'

// AFTER
import { ... } from '@revealui/db/schema'
import { ... } from '@revealui/db/schema/agents'
```

#### Step 3.3: Update `services/core` → `services/server`

**Find & Replace Pattern:**
```typescript
// BEFORE
import { ... } from 'services/core'
import { ... } from 'services/core/...'

// AFTER
import { ... } from 'services/server'
import { ... } from 'services/server/...'
```

---

### Phase 4: Update Configuration Files

#### Step 4.1: TypeScript Configs (15 files)

**Pattern:**
```json
// BEFORE
"@revealui/core": ["../../packages/core/src/core/index.ts"]
"@revealui/db/core": ["../../packages/db/src/core/index.ts"]
"packages/core/src": ...

// AFTER
"@revealui/core": ["../../packages/core/src/index.ts"]  // Main export
"@revealui/db/schema": ["../../packages/db/src/core/index.ts"]  // Keep internal path
"packages/core/src": ...
```

**Files:**
- `tsconfig.json` (root)
- `apps/cms/tsconfig.json`
- `apps/web/tsconfig.json`
- `apps/docs/tsconfig.json`
- `packages/core/tsconfig.json` (renamed from revealui)
- `packages/*/tsconfig.json` (all other packages)
- `packages/dev/src/ts/reveal.json`

#### Step 4.2: Vite Configs (5+ files)

**Pattern:**
```typescript
// BEFORE
'@revealui/core': path.resolve(packagesRoot, 'revealui/src')
'@revealui/core': path.resolve(packagesRoot, 'revealui/src/core')

// AFTER
'@revealui/core': path.resolve(packagesRoot, 'core/src')  // Main export
// Remove '@revealui/core' alias
```

**Files:**
- `packages/dev/src/vite/vite.shared.ts`
- `apps/cms/vite.config.ts`
- `apps/web/vite.config.ts`
- `packages/services/vite.config.ts`
- `packages/test/vite.config.ts`

#### Step 4.3: Turbo Config

**Pattern:**
```json
// BEFORE
"reveal:build": {
  "outputs": ["packages/core/dist/**"]
}

// AFTER
"core:build": {
  "outputs": ["packages/core/dist/**"]
}
```

**File:**
- `turbo.json`

#### Step 4.4: Package.json Scripts

**Pattern:**
```json
// BEFORE
"build:all-packages": "... --filter packages/core ..."

// AFTER
"build:all-packages": "... --filter packages/core ..."
```

**Files:**
- `package.json` (root)

---

### Phase 5: Update Documentation

**Find & Replace in all `.md` files:**

```markdown
# BEFORE
packages/core
@revealui/core
@revealui/db/core
services/core

# AFTER
packages/core
@revealui/core
@revealui/db/schema
services/server
```

**Files:**
- All `.md` files in `docs/`
- `README.md` files
- `.cursorrules` / `.cursor/rules.md`

---

### Phase 6: Verify & Test

```bash
# 1. TypeScript typecheck
pnpm typecheck:all

# 2. Build all packages
pnpm build:packages

# 3. Run tests
pnpm test

# 4. Verify no broken imports
grep -r "@revealui/core" packages/ apps/ || echo "✅ No remaining @revealui/core imports"
grep -r "@revealui/db/core" packages/ apps/ || echo "✅ No remaining @revealui/db/core imports"
grep -r "services/core" packages/ apps/ || echo "✅ No remaining services/core imports"
```

---

## Migration Checklist

### Phase 1: Prepare
- [ ] Create migration branch
- [ ] Run baseline tests
- [ ] Document current state

### Phase 2: Folder & Structure
- [ ] Rename `packages/core/` → `packages/core/`
- [ ] Flatten `src/core/` → `src/`
- [ ] Update `packages/core/package.json` exports
- [ ] Update `packages/db/package.json` exports (`./core` → `./schema`)
- [ ] Update `packages/services/package.json` exports (`./core` → `./server`)

### Phase 3: Update Imports (43+ files)
- [ ] Update `@revealui/core` → `@revealui/core` imports
- [ ] Update `@revealui/db/core` → `@revealui/db/schema` imports
- [ ] Update `services/core` → `services/server` imports

### Phase 4: Configuration Files
- [ ] Update TypeScript configs (15 files)
- [ ] Update Vite configs (5+ files)
- [ ] Update Turbo config
- [ ] Update package.json scripts

### Phase 5: Documentation
- [ ] Update markdown files (89+ files)
- [ ] Update README files
- [ ] Update rules/config files

### Phase 6: Verify
- [ ] TypeScript typecheck passes
- [ ] All packages build successfully
- [ ] All tests pass
- [ ] No remaining old import patterns
- [ ] Manual verification complete

---

## Rollback Plan

If migration fails:

```bash
# Revert all changes
git reset --hard HEAD

# Or revert specific commits
git revert <commit-hash>
```

**Note:** Since we're using `git mv`, folder rename preserves history and can be reverted.

---

## Estimated Timeline

- **Phase 1:** 15 minutes
- **Phase 2:** 1-2 hours
- **Phase 3:** 2-4 hours (automated with find/replace)
- **Phase 4:** 2-3 hours
- **Phase 5:** 1-2 hours
- **Phase 6:** 1-2 hours

**Total:** ~8-14 hours

---

## Risk Mitigation

1. **Commit after each phase** - Easier to rollback if needed
2. **Run tests after each phase** - Catch issues early
3. **Use automated scripts** - Reduce human error
4. **Keep migration branch separate** - Don't merge until verified

---

**Ready to execute?** Proceed with Phase 1.
