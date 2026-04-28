# marketing

Public marketing site for RevealUI — homepage, blog, pricing, fair-source, contact, etc. Lives at `revealui.com` (and the `community.revealui.com` host redirects to the Discourse forum via `vercel.json`).

## Stack

- Vite + React 19
- `@revealui/router` (file-based routing + SSR-capable, currently SPA mode)
- `@revealui/presentation` (UI primitives + design tokens)
- Tailwind CSS v4
- Geist + Geist Mono via `@fontsource-variable`
- `react-markdown` + `remark-gfm` for blog post rendering
- `@vercel/speed-insights` (client-side runtime)
- Cross-origin form posts to `apps/api` (no marketing-side API routes)
- OG images from `https://api.revealui.com/api/og?...` (Satori-rendered in apps/api)

## Develop

```bash
pnpm --filter marketing dev          # http://localhost:3000
pnpm --filter marketing typecheck
pnpm --filter marketing build
pnpm --filter marketing preview
```

`apps/api` should run on port 3004 for `/api/og`, `/api/contact`, `/api/newsletter` to work cross-origin in dev.

## Deploy

Vercel: push triggers preview, merge to `main` triggers production. Build configured in `vercel.json`. CF Pages-compatible by construction (Vite static + SPA fallback rewrites + redirect rules); CF Pages deployment not wired yet — defer per the existing CF posture.
