# Bundle Optimization - Final Report & Recommendations

**Date:** 2026-02-06
**Current CMS Bundle:** 784.18 KB (gzipped)
**Target:** 500 KB
**Gap:** 284.18 KB (57% over target)

## Executive Summary

Phase 1 optimizations achieved minimal bundle size reduction (~1.6 KB) because Next.js/Turbopack already implements aggressive tree-shaking. The removed dependencies were already being eliminated by the build process.

**To reach the 500 KB target, we need Phase 2: Lazy Loading & Code Splitting** which targets runtime-loaded dependencies that cannot be automatically tree-shaken.

---

## Phase 1 Results (Completed)

### What We Did
1. ✅ Removed 5 unused dependencies
2. ✅ Enabled `optimizePackageImports` experimental feature
3. ✅ Fixed 7 workspace package references
4. ✅ Verified Stripe is server-side only
5. ✅ Configured bundle analyzer

### Bundle Size Impact
- **Before:** 785.82 KB
- **After:** 784.18 KB
- **Reduction:** 1.64 KB (0.2%)

### Why So Small?
- Next.js Turbopack already tree-shakes unused code
- Removed packages weren't in the bundle
- `optimizePackageImports` has minimal effect on already-optimized code

### Files Modified
- `apps/cms/package.json` - Removed 5 dependencies, fixed workspace refs
- `apps/cms/next.config.mjs` - Added optimizePackageImports, bundle analyzer
- 6 source files - Updated `services` → `@revealui/services` imports

---

## Known Large Dependencies (Analysis)

Based on package.json and typical bundle sizes:

| Package | Estimated Size (gzipped) | Usage | Lazy Load? |
|---------|-------------------------|-------|------------|
| `@sentry/nextjs` | ~100-120 KB | Error tracking | ✅ **Yes** - Production only |
| `lexical` + plugins | ~80-100 KB | Rich text editor | ✅ **Yes** - Edit pages only |
| `ai` + `@ai-sdk/openai` | ~70-90 KB | AI chat features | ✅ **Yes** - Chat route only |
| `@electric-sql/client` | ~60-80 KB | Real-time sync | ⚠️ Maybe - If not used everywhere |
| `@supabase/supabase-js` | ~50-70 KB | Backend client | ⚠️ Maybe - Check usage |
| `drizzle-orm` | ~40-50 KB | Database ORM | ❌ No - Needed everywhere |
| `next` framework | ~200-250 KB | Next.js runtime | ❌ No - Core framework |
| React 19 | ~50-60 KB | React runtime | ❌ No - Core framework |

**Total Lazy-Loadable:** ~310-390 KB potential savings

---

## Recommended Optimizations (Priority Order)

### 🔴 **PRIORITY 1: Lazy Load Sentry** (~100 KB savings)

**Current State:** Loaded on every page
**Target:** Load only in production environment

**Implementation:**

```typescript
// apps/cms/instrumentation.ts (NEW FILE)
export async function register() {
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_SENTRY_DSN) {
    // Import Sentry only in production
    const Sentry = await import('@sentry/nextjs')
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      // ... existing config from sentry.client.config.ts
    })
  }
}
```

**Changes Required:**
1. Create `apps/cms/instrumentation.ts`
2. Remove `sentry.client.config.ts` and `sentry.server.config.ts`
3. Remove Sentry wrapper from `next.config.mjs`

**Time:** 30-45 minutes
**Risk:** Low - Sentry still works, just loads dynamically

---

### 🟠 **PRIORITY 2: Dynamic Import Lexical Editor** (~80 KB savings)

**Current State:** Loaded on all CMS pages
**Target:** Load only on pages with editor

**Implementation:**

```typescript
// apps/cms/src/components/Editor.tsx
import dynamic from 'next/dynamic'

const LexicalEditor = dynamic(
  () => import('./LexicalEditor/index'),
  {
    loading: () => (
      <div className="animate-pulse bg-gray-200 h-96 rounded">
        Loading editor...
      </div>
    ),
    ssr: false // Editor is client-side only
  }
)

export function Editor(props) {
  return <LexicalEditor {...props} />
}
```

**Changes Required:**
1. Identify all Lexical imports
2. Wrap with `dynamic()` import
3. Add loading skeleton
4. Set `ssr: false` for client-only components

**Time:** 45-60 minutes
**Risk:** Low - Just changes import method

---

### 🟡 **PRIORITY 3: Code Split AI Features** (~70 KB savings)

**Current State:** AI SDK loaded in layout/global scope
**Target:** Separate chunk for `/chat` and `/api/chat` routes

**Implementation:**

```typescript
// apps/cms/src/app/chat/page.tsx
import dynamic from 'next/dynamic'

const AIChat = dynamic(() => import('@/components/AIChat'), {
  loading: () => <div>Loading AI...</div>,
  ssr: false
})

export default function ChatPage() {
  return <AIChat />
}
```

**Also check:**
- Remove AI imports from layout files
- Ensure AI SDK only imported in chat-specific code
- Consider moving to `/api/chat` server-side only

**Changes Required:**
1. Audit AI SDK imports (`ai`, `@ai-sdk/openai`, `@ai-sdk/react`)
2. Move to route-specific code
3. Use dynamic imports
4. Remove from global scope

**Time:** 60-90 minutes
**Risk:** Medium - Need to verify AI features still work

---

### 🟢 **PRIORITY 4: Review Electric SQL Usage** (~60 KB potential)

**Current State:** Electric SQL client in dependencies
**Question:** Is real-time sync used on all pages?

**Investigation Needed:**
1. Search for `@electric-sql/client` usage
2. Identify which pages need real-time sync
3. If limited to specific features, code split

**Implementation:** (If applicable)
```typescript
// Only import where needed
const { useElectricData } = await import('@electric-sql/react')
```

**Time:** 30-45 minutes investigation + 30-60 min implementation
**Risk:** Low if sync not critical everywhere

---

### 🔵 **PRIORITY 5: Optimize Supabase Client** (~20-30 KB)

**Current State:** Full Supabase client imported
**Options:**
1. Tree-shake unused Supabase features
2. Use Supabase Edge Functions instead of client-side calls
3. Move to server-side only where possible

**Investigation:**
```bash
# Find Supabase usage
grep -r "from '@supabase" apps/cms/src/
```

**Time:** 45-60 minutes
**Risk:** Low - Verify auth still works

---

## Implementation Roadmap

### Quick Wins (2-3 hours total)
1. Lazy load Sentry (30-45 min) → ~100 KB
2. Dynamic import Lexical (45-60 min) → ~80 KB
3. Code split AI (60-90 min) → ~70 KB

**Expected Result:** 784 KB → ~534 KB (still 34 KB over, but 93% of goal!)

### Extended Optimizations (3-4 hours more)
4. Review Electric SQL (60-90 min) → ~60 KB
5. Optimize Supabase (45-60 min) → ~20 KB
6. Additional code splitting (varies) → ~20-40 KB

**Expected Result:** 784 KB → ~444-464 KB ✅ **UNDER TARGET!**

---

## Alternative Approaches

### Option A: Accept Current Bundle Size
- Update `.size-limit.json` to 800 KB for CMS
- Focus optimization efforts elsewhere
- Still well-optimized compared to industry standards

### Option B: Further Investigation
- Use Next.js experimental analyzer: `next experimental-analyze`
- Identify other large dependencies
- Custom optimization strategy

### Option C: Replace Heavy Dependencies
- Replace Lexical with lighter editor (Tiptap, ProseMirror)
- Replace Supabase client with direct PostgreSQL
- Custom AI SDK wrapper (lighter than full SDK)

**Not Recommended:** Replacing core dependencies is high-risk

---

## Next Steps

### Recommended Path (Quick Wins)
1. **Implement Priority 1-3** (2-3 hours)
2. **Rebuild and measure** with `pnpm size`
3. **Verify ~250 KB reduction**
4. **If needed, continue to Priority 4-5**

### Commands
```bash
# After implementing changes
pnpm --filter cms build

# Measure bundle size
pnpm size

# Compare with current
# Current: 784.18 KB
# Target:  ~534 KB (after quick wins)
```

---

## Monitoring & Validation

### Bundle Size Limits
Update `.size-limit.json` after optimizations:
```json
{
  "name": "CMS - Main Bundle",
  "path": "apps/cms/.next/static/**/*.js",
  "limit": "550 KB",  // Conservative target after optimizations
  "webpack": false,
  "gzip": true
}
```

### CI/CD Integration
Add to GitHub Actions:
```yaml
- name: Check bundle size
  run: pnpm size
```

### Lighthouse Monitoring
```bash
pnpm lighthouse  # Monitor performance impact
```

---

## Conclusion

**Phase 1 Lessons:**
- Modern build tools already optimize well
- Removing unused deps ≠ bundle size reduction
- Need to target runtime-loaded dependencies

**Phase 2 Strategy:**
- Focus on lazy loading (Sentry, Lexical, AI)
- Code splitting by route
- Server-side where possible

**Expected Outcome:**
- Quick wins: 784 KB → ~534 KB (93% of goal)
- Extended: 784 KB → ~444 KB ✅ **Under target**

**Time Investment:**
- Quick wins: 2-3 hours
- Full optimization: 5-7 hours total

**Recommendation:** Implement Priority 1-3 (quick wins) first, then reassess.
