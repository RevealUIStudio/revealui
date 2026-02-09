# Bundle Optimization Guide

**Last Updated:** 2026-02-06
**Current Status:** CMS bundle is 785 KB (target: 500 KB) - 57% over target

## Overview

This document provides actionable strategies to reduce the CMS bundle size from 785 KB to the 500 KB target, a reduction of 285 KB (36%).

## Current Bundle Analysis

### Heavy Dependencies in CMS

| Dependency | Estimated Size | Usage | Optimization Potential |
|-----------|----------------|-------|----------------------|
| `@sentry/nextjs` | ~100 KB | Error tracking | ⭐⭐⭐ High - Lazy load |
| `lexical` + renderer | ~80 KB | Rich text editor | ⭐⭐⭐ High - Dynamic import |
| `@ai-sdk/openai` + `ai` | ~70 KB | AI features | ⭐⭐⭐ High - Code split |
| `@electric-sql/client` | ~60 KB | Real-time sync | ⭐⭐ Medium - Selective import |
| `@supabase/supabase-js` | ~50 KB | Backend client | ⭐⭐ Medium - Tree shake |
| `stripe` | ~40 KB | Payments | ⭐⭐⭐ High - Server-side only |
| React Compiler | ~30 KB | Build tool | ❌ Dev dependency |

**Potential Savings:** ~285 KB (enough to hit target!)

## Optimization Strategies

### 1. ⭐⭐⭐ PRIORITY: Lazy Load Sentry (Save ~100 KB)

**Issue:** Sentry is loaded on every page, even though errors are rare.

**Solution:** Use Next.js instrumentation hook to load Sentry only in production:

```typescript
// apps/cms/instrumentation.ts
export async function register() {
  if (process.env.NODE_ENV === 'production') {
    await import('./lib/sentry.config')
  }
}
```

```typescript
// apps/cms/lib/sentry.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // ... config
})
```

**Impact:** ~100 KB reduction ✅

---

### 2. ⭐⭐⭐ PRIORITY: Dynamic Import Lexical Editor (Save ~80 KB)

**Issue:** Lexical editor is loaded even on pages that don't edit content.

**Solution:** Use dynamic imports with loading state:

```typescript
// apps/cms/src/components/Editor.tsx
import dynamic from 'next/dynamic'

const LexicalEditor = dynamic(
  () => import('./LexicalEditor'),
  {
    loading: () => <EditorSkeleton />,
    ssr: false // Editor is client-side only
  }
)

export function Editor() {
  return <LexicalEditor />
}
```

**Impact:** ~80 KB reduction for non-editing pages ✅

---

### 3. ⭐⭐⭐ PRIORITY: Code Split AI Features (Save ~70 KB)

**Issue:** AI SDK is imported in layout, loaded on every page.

**Solution:** Create AI feature as a separate chunk:

```typescript
// apps/cms/src/app/chat/page.tsx
import dynamic from 'next/dynamic'

const AIChat = dynamic(() => import('@/components/AIChat'), {
  loading: () => <ChatSkeleton />
})
```

**Also:** Move AI SDK to optional dependency, only load on `/chat` routes.

**Impact:** ~70 KB reduction for non-AI pages ✅

---

### 4. ⭐⭐⭐ CRITICAL: Move Stripe to Server-Side Only (Save ~40 KB)

**Issue:** `stripe` package (server SDK) is being bundled in client.

**Solution:** Ensure Stripe is only imported in API routes and server components:

```typescript
// ❌ DON'T: Import in client components
import Stripe from 'stripe'

// ✅ DO: Import only in API routes or server actions
// apps/cms/src/app/api/stripe/route.ts
import Stripe from 'stripe'
```

**Check:** Run `pnpm why stripe` in CMS to find client imports.

**Impact:** ~40 KB reduction ✅

---

### 5. ⭐⭐ MEDIUM: Tree Shake Supabase Client (Save ~20 KB)

**Issue:** Importing full Supabase client when only using specific features.

**Solution:** Use modular imports:

```typescript
// ❌ DON'T
import { createClient } from '@supabase/supabase-js'

// ✅ DO (if possible - check Supabase docs)
import { createClient } from '@supabase/supabase-js/dist/module/SupabaseClient'
```

**Alternative:** Use Supabase's edge functions instead of client-side calls where possible.

**Impact:** ~20 KB reduction ✅

---

### 6. ⭐⭐ MEDIUM: Selective ElectricSQL Imports (Save ~30 KB)

**Issue:** Importing full Electric client.

**Solution:** Review Electric usage and use only needed modules:

```typescript
// Review apps/cms usage of @electric-sql
// Potentially replace with native PostgreSQL subscriptions if simpler
```

**Impact:** ~30 KB reduction ⚠️ (requires architecture review)

---

## Quick Wins (Implement First)

### A. Enable Next.js Bundle Analyzer

```typescript
// apps/cms/next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true'
})

module.exports = withBundleAnalyzer({
  // ... existing config
})
```

**Usage:**
```bash
cd apps/cms && ANALYZE=true pnpm build
```

**Impact:** Visibility into actual bundle composition

---

### B. Configure Next.js SWC Minification

Ensure SWC minifier is enabled (faster + smaller than Terser):

```typescript
// apps/cms/next.config.js
module.exports = {
  swcMinify: true, // Should already be default in Next.js 16
  experimental: {
    optimizePackageImports: [
      '@revealui/presentation',
      '@revealui/core',
    ]
  }
}
```

**Impact:** ~10-20 KB additional reduction

---

### C. Remove Unused Dependencies

Run dependency analysis:

```bash
pnpm dlx depcheck apps/cms
```

Potential candidates for removal:
- `prism-react-renderer` - Is syntax highlighting actually used?
- `@tailwindcss/aspect-ratio` - Now built into Tailwind v4
- `@tailwindplus/elements` - Custom components, check usage

**Impact:** ~15-30 KB reduction

---

## Implementation Roadmap

### Phase 1: Immediate (30 minutes)
1. ✅ Install bundle analyzer
2. 🔨 Move Stripe to server-side only
3. 🔨 Remove unused dependencies

**Expected Reduction:** ~60 KB → 725 KB

---

### Phase 2: Quick (2-3 hours)
1. 🔨 Lazy load Sentry
2. 🔨 Dynamic import Lexical editor
3. 🔨 Code split AI features

**Expected Reduction:** ~250 KB → 475 KB ✅ **UNDER TARGET!**

---

### Phase 3: Optimization (Optional, 4-6 hours)
1. 🔨 Tree shake Supabase
2. 🔨 Review Electric usage
3. 🔨 Audit and optimize internal packages

**Expected Reduction:** ~50 KB → 425 KB (15% under target)

---

## Verification Commands

```bash
# Check bundle sizes
pnpm size

# Analyze bundle with webpack
cd apps/cms && ANALYZE=true pnpm build

# Check what's importing a package
pnpm why <package-name>

# Find client-side imports of server packages
grep -r "import.*from 'stripe'" apps/cms/src/

# Check unused dependencies
pnpm dlx depcheck apps/cms
```

---

## Success Metrics

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| CMS Bundle | 785 KB | 500 KB | 🔴 57% over |
| After Phase 1 | ~725 KB | 500 KB | 🟡 45% over |
| After Phase 2 | ~475 KB | 500 KB | ✅ 5% under |
| After Phase 3 | ~425 KB | 500 KB | ✅ 15% under |

---

## Additional Considerations

### Route-Based Code Splitting

Next.js 16 automatically splits by route. Ensure pages are organized to maximize this:

```
apps/cms/src/app/
├── (auth)/           # Auth-only bundle
├── (dashboard)/      # Dashboard bundle (no editor)
├── (editor)/         # Editor bundle (Lexical)
└── (chat)/           # AI chat bundle
```

### Image Optimization

Already using Next.js Image component ✅

### Font Optimization

Using `next/font` with Geist ✅

### Third-Party Script Loading

Use `next/script` with `strategy="lazyOnload"` for analytics:

```typescript
<Script
  src="https://cdn.vercel-insights.com/v1/script.js"
  strategy="lazyOnload"
/>
```

---

## Monitoring

Add bundle size monitoring to CI:

```yaml
# .github/workflows/bundle-size.yml
name: Bundle Size
on: [pull_request]
jobs:
  size:
    runs-on: ubuntu-latest
    steps:
      - uses: andresz1/size-limit-action@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

---

## Conclusion

**Current Status:** 785 KB (57% over target)

**After Phase 2:** ~475 KB ✅ **UNDER TARGET**

**Estimated Time:** 2-3 hours for Phase 2

**Recommended Approach:**
1. Start with bundle analyzer to confirm assumptions
2. Implement Phase 1 quick wins (30 min)
3. Implement Phase 2 lazy loading (2-3 hours)
4. Verify with `pnpm size`

**Next Steps:** Run bundle analyzer and create issues for each optimization task.
