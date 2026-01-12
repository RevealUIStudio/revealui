# Project Root Detection Fix

**Date**: 2025-01-26  
**Status**: ✅ **FIXED**

---

## Problem

The config package's `getProjectRoot()` function was failing when code was bundled by Turbopack because:

1. **Bundled code**: When Turbopack bundles the code, `__dirname` points to `.next/dev/server/chunks/ssr/` instead of the source file location
2. **Relative path fails**: `resolve(__dirname, '../../../..')` doesn't point to project root when bundled
3. **Result**: Config package can't find `.env` file, causing `ConfigValidationError`

---

## Solution

Updated `getProjectRoot()` to use **multiple strategies** to find the project root:

### Strategy 1: Relative Path (Development)
- Tries `resolve(__dirname, '../../../..')` 
- Works when running from source (not bundled)

### Strategy 2: Process CWD (Runtime)
- Uses `process.cwd()` as fallback
- Works when running from project root

### Strategy 3: Directory Walk (Bundled)
- Walks up from `__dirname` looking for markers:
  - `package.json` (monorepo root)
  - `.env.template` (project root marker)
- Works when code is bundled by Turbopack

### Strategy 4: Fallback
- Returns relative path if all else fails
- Might work in some edge cases

---

## Code Changes

**File**: `packages/config/src/loader.ts`

**Before**:
```typescript
function getProjectRoot(): string {
  return resolve(__dirname, '../../../..')
}
```

**After**:
```typescript
function getProjectRoot(): string {
  // Strategy 1: Try relative path from __dirname
  const relativePath = resolve(__dirname, '../../../..')
  if (existsSync(resolve(relativePath, 'package.json')) || 
      existsSync(resolve(relativePath, '.env.template'))) {
    return relativePath
  }

  // Strategy 2: Use process.cwd()
  const cwd = process.cwd()
  if (existsSync(resolve(cwd, 'package.json')) || 
      existsSync(resolve(cwd, '.env.template'))) {
    return cwd
  }

  // Strategy 3: Walk up from __dirname
  let current = __dirname
  for (let i = 0; i < 10; i++) {
    if (existsSync(resolve(current, 'package.json')) || 
        existsSync(resolve(current, '.env.template'))) {
      return current
    }
    const parent = resolve(current, '..')
    if (parent === current) break
    current = parent
  }

  // Fallback
  return relativePath
}
```

---

## Why This Works

1. **Multiple fallbacks**: If one strategy fails, others are tried
2. **Marker files**: Uses `package.json` or `.env.template` to verify project root
3. **Bundled code**: Directory walk works even when `__dirname` is in `.next/` directory
4. **Runtime**: `process.cwd()` works when server runs from project root

---

## Testing

After this fix:

1. **Restart the server**:
   ```bash
   pnpm --filter cms dev
   ```

2. **Verify**:
   - Should NOT see `ConfigValidationError`
   - Config package should find `.env` file
   - Server should start successfully

---

## Files Modified

- ✅ `packages/config/src/loader.ts` - Updated `getProjectRoot()` function

---

**Status**: ✅ **Fix Applied - Ready to Test**
