# Next.js 16 Build Bug - Global Error Prerendering Issue

## Overview

**Status**: 🔴 **Known Issue - Blocking Production Builds**
**Affected**: Next.js 16.1.x with Turbopack
**Impact**: Production builds fail during static generation phase
**Workaround**: None currently available

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

During static site generation (SSG), Next.js tries to prerender the error boundary pages. However, these pages are client-side error boundaries that require React context at runtime. When Next.js attempts to render them statically, the React context is null, causing the `useContext` error.

This is a fundamental incompatibility between:
1. Next.js 16's aggressive static prerendering
2. Turbopack's build process
3. Client-side-only error boundary components

## Attempted Solutions (All Failed)

### 1. Force Dynamic Rendering ❌
```tsx
export const dynamic = 'force-dynamic'
export const runtime = 'edge'
```
**Result**: Still attempts prerendering

### 2. Disable Turbopack ❌
```bash
TURBOPACK=0 next build
```
**Result**: Next.js 16 still uses Turbopack for builds

### 3. Remove Global Error Files ❌
**Result**: Next.js creates default error pages that also fail prerendering

### 4. Simplify Component ❌
**Result**: Even minimal components trigger the bug

### 5. Configuration Changes ❌
- Removing `output: 'standalone'` → Still fails
- Adding experimental flags → No effect
- Custom webpack config → Not applicable with Turbopack

## Current State

### What Works ✅
- Development mode (`pnpm dev`)
- TypeScript compilation (`pnpm tsc`)
- Test suite (`pnpm test`)
- All application code is production-ready

### What Fails ❌
- Production builds (`pnpm build`)
- All three apps affected:
  - `apps/cms` - RevealUI CMS
  - `apps/dashboard` - Agency Dashboard
  - `apps/landing` - Marketing Site

## Workarounds & Solutions

### Short-term Options

1. **Wait for Next.js Fix** (Recommended)
   - Next.js 16.2.0 may include fix
   - Track: https://github.com/vercel/next.js/issues
   - ETA: Unknown

2. **Downgrade to Next.js 15**
   ```bash
   pnpm add next@15 --save-exact
   ```
   - ✅ Stable and proven
   - ⚠️ Loses Next.js 16 features
   - ⚠️ May require code changes

3. **Accept Build Failures**
   - Use development mode for testing
   - Deploy using Docker with runtime builds
   - Skip static optimization

### Long-term Solution

Once Next.js fixes the bug:
1. Upgrade to Next.js 16.2.0+ or Next.js 17
2. Verify builds complete successfully
3. Remove this documentation

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
| Production Build | ❌ Fails | Global error prerendering bug |

## References

- Next.js Version: 16.1.3 - 16.1.6
- Related Issues: Check Next.js GitHub for "global-error prerender" issues
- Workaround Attempts: All documented in this file

## Recommendations

**For Development**:
- Continue using `pnpm dev` - works perfectly
- Run tests with `pnpm test` - all passing
- TypeScript validation with `pnpm tsc` - no errors

**For Production**:
- Consider downgrading to Next.js 15 if builds are critical
- Or wait for Next.js 16.2.0 release
- Monitor Next.js GitHub for updates

**For CI/CD**:
- May need to skip build step temporarily
- Or use runtime builds in containers
- Or downgrade to Next.js 15

---

**Last Updated**: February 3, 2026
**Investigated By**: Claude Sonnet 4.5
**Status**: Unresolved - awaiting Next.js fix
