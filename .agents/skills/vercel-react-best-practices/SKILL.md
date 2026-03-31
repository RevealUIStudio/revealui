---
name: vercel-react-best-practices
description: React and Next.js performance best practices including rendering, memoization, and bundle optimization.
---

# React & Next.js Performance Best Practices

Refer to the official documentation for comprehensive guidance:

- https://nextjs.org/docs/app/building-your-application/optimizing
- https://react.dev/reference/react/memo
- https://react.dev/reference/react/useMemo

## Key Points

- Minimize client-side JavaScript by keeping components as Server Components by default; only add `'use client'` when hooks or browser APIs are required
- Use `React.memo`, `useMemo`, and `useCallback` sparingly and only when profiling reveals unnecessary re-renders; premature memoization adds complexity without measurable benefit
- Leverage `next/dynamic` with `{ ssr: false }` for heavy client-only components (charts, editors) to reduce initial bundle size and improve Time to Interactive
- Use `next/image` for all images (automatic format optimization, lazy loading, responsive `srcSet`) and `next/font` to eliminate layout shift from font loading
- Split large pages into independent Suspense boundaries so slow data sources do not block the entire page render; stream content progressively to the client
