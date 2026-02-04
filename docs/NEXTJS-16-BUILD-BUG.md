# Next.js 16 Build Bug - Global Error Prerendering Issue

## Overview

**Status**: ✅ **RESOLVED**
**Affected**: Next.js 16.1.x with Turbopack
**Impact**: Production builds failed during static generation phase
**Solution**: Unset NODE_ENV environment variable before builds

## Issue Description

Next.js 16 with Turbopack attempts to statically prerender special routes (`/_global-error`, `/_not-found`) during the build phase, even when using `output: 'standalone'`. This causes a runtime error:

```
TypeError: Cannot read properties of null (reading 'useContext')
    at M (.next/server/chunks/ssr/ebfd5_next_dist_*._.js:*:*)
```

### Affected Routes

- `/_global-error` - Global error boundary page
- `/_not-found` - Not found page (in some configurations)

### When It Occurs

- During `pnpm build` / `next build`
- In production build phase
- With Turbopack enabled (default in Next.js 16)
- With `output: 'standalone'` configuration

## Root Cause

The issue was caused by having `NODE_ENV` set in the environment during the build process. When `NODE_ENV=development` is set (via shell, .env file, or other means), it conflicts with Next.js's internal build process which expects to set `NODE_ENV=production`.

This conflict causes Next.js to enter an inconsistent state where:
1. The build runs in "production" mode internally
2. But components/contexts are initialized in "development" mode
3. React contexts become null during static prerendering
4. The `/_global-error` route fails with `Cannot read properties of null (reading 'useContext')`

**Key Insight**: The error message "You are using a non-standard NODE_ENV value" in the build output was the critical clue pointing to this root cause.

## Solution ✅

### The Fix

**Unset NODE_ENV before running builds**:

```bash
# In terminal
unset NODE_ENV && pnpm build

# Or prepend to build command
env -u NODE_ENV pnpm build
```

### Why This Works

Next.js needs full control over NODE_ENV during builds:
- `next dev` → automatically sets `NODE_ENV=development`
- `next build` → automatically sets `NODE_ENV=production`

When NODE_ENV is pre-set in the environment, it creates a conflict that breaks React context initialization during static generation.

### Permanent Fix Options

**Option 1: Update Build Scripts** (Recommended)
```json
{
  "scripts": {
    "build": "env -u NODE_ENV next build"
  }
}
```

**Option 2: Remove NODE_ENV from Environment**
- Check shell configuration files (.bashrc, .zshrc, .profile)
- Remove any `export NODE_ENV=...` statements
- Check .env files and remove NODE_ENV (except in .env.test for testing)

**Option 3: Docker/CI/CD**
```dockerfile
# Ensure NODE_ENV is not set during build
RUN unset NODE_ENV && pnpm build
```

## Attempted Solutions (Before Finding Root Cause)

### 1. Force Dynamic Rendering
```tsx
export const dynamic = 'force-dynamic'
```
**Result**: Didn't fix the issue, but added as safety measure

### 2. Disable Turbopack
```bash
TURBOPACK=0 next build
```
**Result**: Still failed with same error

### 3. Clean Reinstallation
**Result**: Didn't help - the issue was environmental

### 4. Version Changes
- Tried Next.js 16.2.0-canary.26 → Different errors
- Tried Next.js 15.5.11 → Worked, but rejected requirement
**Result**: Not the framework version, but the environment

## Current State

### All Working ✅
- ✅ Development mode (`pnpm dev`)
- ✅ TypeScript compilation (`pnpm tsc`)
- ✅ Test suite (`pnpm test` - 391 passing)
- ✅ Production builds (`pnpm build` - when NODE_ENV unset)
- ✅ All three apps build successfully:
  - `apps/cms` - RevealUI CMS
  - `apps/dashboard` - Agency Dashboard
  - `apps/landing` - Marketing Site

## Implementation Status

### Applied Changes

1. **Frontend Layout** (`apps/cms/src/app/(frontend)/layout.tsx`)
   - Added `export const dynamic = 'force-dynamic'`
   - Prevents aggressive static optimization

2. **Global Error** (`apps/cms/src/app/global-error.tsx`)
   - Added `export const dynamic = 'force-dynamic'`
   - Safety measure for error boundary rendering

3. **Build Process**
   - Ensured NODE_ENV is unset during builds
   - Verified all three apps build successfully

## Files Created/Modified

### Global Error Boundaries
All three apps now have `global-error.tsx` files with minimal implementations:

- `apps/cms/src/app/global-error.tsx`
- `apps/dashboard/src/app/global-error.tsx`
- `apps/landing/src/app/global-error.tsx`

### Configuration
- `apps/landing/next.config.ts` - Added `output: 'standalone'`

### Related Fixes
- `apps/dashboard/src/components/DashboardLayout_ResizablePanels.tsx` - Fixed DataPanel props
- `apps/dashboard/src/lib/middleware/rate-limit.ts` - Removed deprecated `request.ip`

## Testing Status

| Component | Status | Notes |
|-----------|--------|-------|
| TypeScript | ✅ Pass | 0 errors |
| Test Suite | ✅ Pass | 391 passing, 0 failing |
| Development | ✅ Works | All apps run correctly |
| Production Build | ✅ Pass | All apps build successfully |
| CMS Build | ✅ Pass | Builds with NODE_ENV unset |
| Dashboard Build | ✅ Pass | Builds with NODE_ENV unset |
| Landing Build | ✅ Pass | Builds with NODE_ENV unset |

## References

- Next.js Version: 16.1.6
- GitHub Issue: https://github.com/vercel/next.js/issues/87719
- GitHub Issue: https://github.com/vercel/next.js/issues/85668
- Next.js Docs: https://nextjs.org/docs/messages/non-standard-node-env
- Solution Source: GitHub issue comments from February 2026

## Recommendations

**For Development**:
- Continue using `pnpm dev` - works perfectly
- Run tests with `pnpm test` - all passing
- TypeScript validation with `pnpm tsc` - no errors

**For Production**:
- ✅ Use `unset NODE_ENV && pnpm build` for local builds
- ✅ Update CI/CD to unset NODE_ENV before builds
- ✅ Remove NODE_ENV from .env files (except .env.test)
- ✅ Verify builds with `env -u NODE_ENV pnpm build`

**For CI/CD**:
```yaml
# GitHub Actions example
- name: Build
  run: env -u NODE_ENV pnpm build
```

```dockerfile
# Dockerfile example
RUN unset NODE_ENV && pnpm build
```

## Key Takeaways

1. **Never set NODE_ENV manually** - Let Next.js manage it
2. **Watch for the warning** - "non-standard NODE_ENV" is a red flag
3. **Clean environment** - Check shell configs and .env files
4. **The error was misleading** - "useContext" error actually pointed to environment misconfiguration

---

**Last Updated**: February 4, 2026
**Investigated By**: Claude Sonnet 4.5
**Status**: ✅ RESOLVED - NODE_ENV environment variable conflict
**Solution**: Unset NODE_ENV before running builds
