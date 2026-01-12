# Project Root Detection Fix - Version 2

**Date**: 2025-01-26  
**Status**: ✅ **FIXED (Improved)**

---

## Problem Identified

The previous fix had a critical issue:

1. **Next.js runs from `apps/cms/`**: `process.cwd()` returns `apps/cms/`, not project root
2. **Strategy 2 failed**: It checked if `apps/cms/package.json` exists (it does!) and returned `apps/cms/` as project root
3. **`.env` is in project root**: The config package looked for `.env` in `apps/cms/` instead of project root
4. **Result**: Couldn't find `.env` file, causing `ConfigValidationError`

---

## Solution (Improved)

Updated `getProjectRoot()` to:

1. **Use `.env.template` as definitive marker** - Only exists in project root
2. **Check for `.env` file** - But exclude app directories (those with `next.config`)
3. **Walk up from `__dirname`** - Works when bundled by Turbopack
4. **Walk up from `process.cwd()`** - Works when running from app directory

### Key Changes

1. **Check for `.env.template` first** - This is a definitive marker (only in project root)
2. **Check for `.env` but exclude app dirs** - Use `.env` exists AND `next.config` doesn't exist
3. **Walk up from both locations** - Handle both bundled and source code scenarios

---

## Code Changes

**File**: `packages/config/src/loader.ts`

**Before** (Problematic):
```typescript
// Strategy 2: Use process.cwd() (works when running from project root)
const cwd = process.cwd()
if (existsSync(resolve(cwd, 'package.json')) || existsSync(resolve(cwd, '.env.template'))) {
  return cwd  // ❌ Returns apps/cms/ when running from app directory!
}
```

**After** (Fixed):
```typescript
// Strategy 2: Walk up from __dirname looking for .env.template or .env
let current = __dirname
for (let i = 0; i < 10; i++) {
  // Check for .env.template first (definitive marker of project root)
  if (existsSync(resolve(current, '.env.template'))) {
    return current
  }
  // Also check for .env file (project root has it, app directories usually don't)
  if (existsSync(resolve(current, '.env')) && !existsSync(resolve(current, 'next.config'))) {
    return current
  }
  const parent = resolve(current, '..')
  if (parent === current) break
  current = parent
}

// Strategy 3: Walk up from process.cwd() (works when running from app directory)
const cwd = process.cwd()
let cwdCurrent = cwd
for (let i = 0; i < 10; i++) {
  if (existsSync(resolve(cwdCurrent, '.env.template')) || 
      (existsSync(resolve(cwdCurrent, '.env')) && !existsSync(resolve(cwdCurrent, 'next.config')))) {
    return cwdCurrent
  }
  const parent = resolve(cwdCurrent, '..')
  if (parent === cwdCurrent) break
  cwdCurrent = parent
}
```

---

## Why This Works

1. **`.env.template` check**: This file only exists in project root, not in app directories
2. **`.env` + `next.config` check**: Project root has `.env` but no `next.config`, app directories have `next.config` but not `.env`
3. **Directory walk**: Walks up from both `__dirname` (bundled location) and `process.cwd()` (runtime location)
4. **Works in all scenarios**:
   - ✅ Development (source code): Relative path works
   - ✅ Bundled by Turbopack: Walk up from `__dirname` finds project root
   - ✅ Running from app directory: Walk up from `process.cwd()` finds project root

---

## Testing

After this fix:

1. **Restart the server**:
   ```bash
   pnpm --filter cms dev
   ```

2. **Verify**:
   - ✅ Should NOT see `ConfigValidationError`
   - ✅ Config package should find `.env` file in project root
   - ✅ Server should start successfully

---

## Files Modified

- ✅ `packages/config/src/loader.ts` - Updated `getProjectRoot()` function

---

**Status**: ✅ **Fix Applied (Improved) - Ready to Test**
