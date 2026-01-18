# Fix: `apps/.revealui` Directory Creation Issue

**Date**: January 2025  
**Issue**: `.revealui` directory is being created in `apps/` folder instead of root

## Root Cause

The issue occurs in `apps/cms/revealui.config.ts` at line 147:

```typescript
url: path.resolve(dirname, '../../.revealui/cache/revealui.db'),
```

**Problem**: When `path.resolve()` is used with a relative path (`../../`), if the current working directory (`process.cwd()`) is `apps/` instead of the project root, the path resolution can create the directory in the wrong location.

### How It Happens

1. **File Location**: `apps/cms/revealui.config.ts`
2. **dirname**: `apps/cms` (relative from file location)
3. **Path Resolution**: `path.resolve('apps/cms', '../../.revealui/cache/revealui.db')`
4. **When cwd is root**: Resolves correctly to `.revealui/cache/revealui.db` ✅
5. **When cwd is apps/**: Resolves incorrectly to `apps/.revealui/cache/revealui.db` ❌

### When This Occurs

- Running commands from `apps/` directory (e.g., `cd apps && pnpm dev`)
- Next.js build process where `process.cwd()` might be different
- Test execution where working directory varies
- Development server starting from `apps/` context

## Solution

Use an **absolute path** from the project root instead of a relative path from the config file location.

### Option 1: Use Project Root Resolution (Recommended)

Update `apps/cms/revealui.config.ts`:

```typescript
// Before (line 147):
url: path.resolve(dirname, '../../.revealui/cache/revealui.db'),

// After:
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(dirname, '../../..')  // Go up to project root
url: path.resolve(rootDir, '.revealui/cache/revealui.db'),
```

**Better**: Calculate from project root:

```typescript
// At top of file, after dirname is set:
const rootDir = path.resolve(dirname, '../..')  // Project root from apps/cms
const cacheDbPath = path.resolve(rootDir, '.revealui/cache/revealui.db')

// Later in config:
url: cacheDbPath,
```

### Option 2: Use Absolute Path from File URL

```typescript
const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const rootDir = path.resolve(dirname, '../..')  // Always resolves to root

// In config:
url: path.resolve(rootDir, '.revealui/cache/revealui.db'),
```

### Option 3: Use Environment Variable or Config

Add a `REVEALUI_CACHE_DIR` environment variable that defaults to root `.revealui/cache`:

```typescript
const cacheDir = process.env.REVEALUI_CACHE_DIR || path.resolve(process.cwd(), '.revealui/cache')
url: path.resolve(cacheDir, 'revealui.db'),
```

**Note**: This still depends on `process.cwd()` which can vary.

### Recommended Fix

**Best approach**: Use absolute path resolution from the config file location:

```typescript
// apps/cms/revealui.config.ts

import path from 'node:path'
import { fileURLToPath } from 'node:url'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Calculate project root (always absolute from file location)
const projectRoot = path.resolve(dirname, '../..')

// Use absolute path for cache
const cacheDbPath = path.resolve(projectRoot, '.revealui/cache/revealui.db')

// Later in config:
db: config.database.url
  ? universalPostgresAdapter({
      connectionString: config.database.url,
    })
  : sqliteAdapter({
      client: {
        url: cacheDbPath,  // Use absolute path
      },
    }),
```

## Why This Fixes It

- `path.resolve()` with an **absolute first argument** always resolves relative to that path, not `process.cwd()`
- `projectRoot` is always absolute (resolved from `__dirname`)
- The path will always resolve to the project root `.revealui/cache/` regardless of where the command is run from

## Testing

After applying the fix:

1. **Delete** `apps/.revealui/` directory:
   ```bash
   rm -rf apps/.revealui
   ```

2. **Test from root**:
   ```bash
   cd /home/joshua-v-dev/projects/RevealUI
   pnpm dev
   ```
   - Should create `.revealui/cache/revealui.db` in root ✅

3. **Test from apps/**:
   ```bash
   cd apps
   pnpm dev
   ```
   - Should still create `.revealui/cache/revealui.db` in root ✅
   - Should NOT create `apps/.revealui/` ❌

4. **Verify path resolution**:
   ```typescript
   // Add temporary logging
   console.log('Cache DB Path:', cacheDbPath)
   // Should always show absolute path to root .revealui/cache/revealui.db
   ```

## Additional Prevention

### Update `.gitignore`

Ensure both locations are ignored (already done):

```gitignore
# RevealUI cache files (SQLite database)
.revealui/cache/*.db
.revealui/cache/*.db-shm
.revealui/cache/*.db-wal

# Also ignore apps/.revealui if it gets created (belt and suspenders)
apps/.revealui/cache/*.db*
```

### Add Pre-commit Hook (Optional)

Add a check to prevent `apps/.revealui/` from being committed:

```bash
# .husky/pre-commit or similar
if [ -d "apps/.revealui" ]; then
  echo "⚠️  Warning: apps/.revealui/ directory found. This should not exist."
  echo "   It should be at root: .revealui/cache/"
  echo "   Consider removing it: rm -rf apps/.revealui"
fi
```

## Related Files

- `apps/cms/revealui.config.ts` - Main config file (needs fix)
- `apps/cms/src/__tests__/setup.ts` - Test setup (already correct: `../../../.revealui/cache`)
- `packages/core/src/core/database/sqlite.ts` - Creates directory (uses resolved path)
- `.gitignore` - Already ignores both locations

## Summary

The issue is caused by relative path resolution that depends on `process.cwd()`. The fix is to use absolute path resolution from the config file location to the project root, ensuring the cache directory is always created in the correct location regardless of where commands are run from.
