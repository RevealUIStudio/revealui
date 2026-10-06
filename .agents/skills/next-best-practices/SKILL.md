---
name: next-best-practices
description: Next.js App Router best practices for routing, data fetching, rendering, and optimization.
---

# Next.js Best Practices

Refer to the official documentation for comprehensive guidance:

- https://nextjs.org/docs
- https://nextjs.org/docs/app/building-your-application/routing
- https://nextjs.org/docs/app/building-your-application/data-fetching

## Key Points

- Use Server Components by default; add `'use client'` only when the component needs browser APIs, event handlers, or React hooks like `useState`/`useEffect`
- In Next.js 15+, `params`, `searchParams`, `cookies()`, and `headers()` are async -- always `await` them
- Avoid data waterfalls by parallelizing fetches with `Promise.all` or leveraging Suspense boundaries to stream independent sections
- Use `generateMetadata` for dynamic SEO metadata and `next/image` with explicit `width`/`height` or `sizes` for all images
- Prefer Server Actions (`'use server'`) for mutations over client-side API calls to Route Handlers
