---
name: next-cache-components
description: Next.js Cache Components, 'use cache' directive, PPR, cacheLife, cacheTag, and migration from unstable_cache.
---

# Next.js Cache Components

Refer to the official documentation for comprehensive guidance:

- https://nextjs.org/docs/app/building-your-application/caching
- https://nextjs.org/docs/app/api-reference/directives/use-cache
- https://nextjs.org/docs/app/building-your-application/rendering/partial-prerendering

## Key Points

- Use the `'use cache'` directive at the top of a file or inside an async function to mark it as cacheable; this replaces the deprecated `unstable_cache` API
- Control cache duration with `cacheLife('hours')`, `cacheLife('days')`, or custom profiles defined in `next.config.ts` under `cacheLife`
- Use `cacheTag('tag-name')` inside cached functions and call `revalidateTag('tag-name')` from Server Actions to invalidate on demand
- Partial Prerendering (PPR) combines static shells with dynamic Suspense holes -- enable it incrementally with `experimental_ppr: true` in route config
- Only serializable arguments can cross the cache boundary; non-serializable values (JSX, classes, closures) must stay outside cached functions
