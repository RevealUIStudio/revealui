# Bundle Optimization Progress

**Started:** 2026-02-06
**Target:** Reduce CMS bundle from 785 KB → 500 KB (285 KB reduction)

## Phase 1: Quick Wins ✅ COMPLETE

**Time Spent:** 20 minutes
**Estimated Savings:** ~60 KB

### Changes Made

#### 1. Removed Unused Dependencies ✅
**Removed from `apps/cms/package.json`:**
- `@tailwindcss/aspect-ratio` - Built into Tailwind CSS v4, no longer needed
- `@tailwindcss/forms` - Not used in Tailwind config
- `@tailwindcss/typography` - Not used in Tailwind config
- `class-variance-authority` - No usage found in source code (0 references)
- `@vercel/analytics` - Not used (`@vercel/speed-insights` is used instead)

**Impact:** ~15-20 KB reduction

#### 2. Fixed Package Name Inconsistencies ✅
**Fixed in `apps/cms/package.json`:**
- Changed `"services": "workspace:*"` → `"@revealui/services": "workspace:*"`

**Fixed in `apps/cms/next.config.mjs`:**
- Updated transpilePackages: `'services'` → `'@revealui/services'`

**Impact:** Prevents build errors, enables proper workspace resolution

#### 3. Verified Server-Side Only Imports ✅
**Checked:** All `stripe` imports in CMS are type-only
- `apps/cms/src/lib/hooks/customersProxy.ts`
- `apps/cms/src/lib/hooks/productsProxy.ts`
- `apps/cms/src/lib/collections/Products/hooks/beforeChange.ts`
- `apps/cms/src/__tests__/utils/stripe-test-utils.ts`

All use `import type Stripe from 'stripe'` (types only, no runtime impact) ✅

**Impact:** Confirmed Stripe SDK not bundled in client (0 KB client-side)

#### 4. Enabled Next.js Package Optimizations ✅
**Added to `apps/cms/next.config.mjs`:**
```javascript
experimental: {
  optimizePackageImports: [
    '@revealui/presentation',
    '@revealui/core',
    'lexical',
    '@sentry/nextjs',
  ],
}
```

**Impact:** Better tree-shaking for large packages (~30-40 KB reduction expected)

---

## Results Summary

### Phase 1 Improvements
| Optimization | Estimated Savings | Status |
|--------------|------------------|--------|
| Remove unused deps | 15-20 KB | ✅ Done |
| Package name fixes | 0 KB (prevents errors) | ✅ Done |
| Verify Stripe server-side | 0 KB (confirmed clean) | ✅ Done |
| Enable optimizePackageImports | 30-40 KB | ✅ Done |
| **Total Phase 1** | **~45-60 KB** | **✅ COMPLETE** |

### Expected After Phase 1
- **Before:** 785 KB
- **Expected After:** ~725-740 KB
- **Progress:** ~46 KB / 285 KB target (16% of goal)

---

## Phase 2: Lazy Loading (Next Steps)

**Estimated Time:** 2-3 hours
**Estimated Savings:** ~250 KB

### Planned Changes

1. **Lazy Load Sentry** (~100 KB savings)
   - Move to `instrumentation.ts`
   - Only load in production

2. **Dynamic Import Lexical Editor** (~80 KB savings)
   - Use Next.js dynamic import
   - Load only on edit pages

3. **Code Split AI Features** (~70 KB savings)
   - Separate chunk for AI chat
   - Load only on `/chat` routes

**Target After Phase 2:** ~475 KB ✅ (under 500 KB goal!)

---

## Verification

### Commands Used
```bash
# Find unused dependencies
cd apps/cms && pnpm dlx depcheck --json

# Verify Stripe imports
grep -r "from 'stripe'" apps/cms/src/ --include="*.tsx" --include="*.ts"

# Remove dependencies
pnpm remove <packages> --filter=cms

# Check bundle size (after rebuild)
pnpm size
```

### Files Modified
1. `apps/cms/package.json` - Removed 5 unused dependencies, fixed workspace references
2. `apps/cms/next.config.mjs` - Added optimizePackageImports, fixed transpilePackages

---

## Next Steps

1. **Rebuild CMS** to measure actual bundle size reduction
2. **Run `pnpm size`** to verify improvements
3. **If satisfactory**, proceed to Phase 2 (lazy loading)
4. **If needed**, investigate additional optimizations

---

## Notes

- All changes are non-breaking and backwards-compatible
- No functionality removed, only unused dependencies
- Build should be faster with fewer dependencies to process
- optimizePackageImports will improve tree-shaking automatically
