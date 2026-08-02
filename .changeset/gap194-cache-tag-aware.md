---
'@revealui/cache': minor
---

Add tag-aware `createCachedFunction`, `revalidateTag`, and `revalidatePath` over `CacheStore` (GAP-194 Phase 3 Tier 0 step 3.7a). Explicit `keyParts` prevent zero-arg key collisions; tags drive `deleteByTags`. Process default store via `getDefaultCacheStore` / `setDefaultCacheStore`. Admin CMS data reads and tag invalidation migrate off `next/cache` unstable_cache; Next `revalidatePath` remains for Full Route Cache while admin is still on Next.js.
